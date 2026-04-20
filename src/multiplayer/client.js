import {
  DEFAULT_TRACK_ID,
  PING_INTERVAL_MS,
  RACE_LAPS,
  buildSocketUrl,
} from '../../shared/multiplayer.js'

function createInitialState() {
  return {
    connectionStatus: 'disconnected',
    roomStatus: 'offline',
    roomId: null,
    trackId: DEFAULT_TRACK_ID,
    raceLaps: RACE_LAPS,
    countdownMs: null,
    countdownStartedAt: null,
    raceStartedAt: null,
    connectedPlayers: [],
    remotePlayers: new Map(),
    lastError: null,
  }
}

export function createMultiplayerClient({ identityProvider }) {
  const listeners = new Set()
  let socket = null
  let pingTimer = null
  let state = createInitialState()

  function emit() {
    const snapshot = getState()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function setState(partialState) {
    state = {
      ...state,
      ...partialState,
    }
    emit()
  }

  function clearPingTimer() {
    if (pingTimer) {
      window.clearInterval(pingTimer)
      pingTimer = null
    }
  }

  function resetConnectionState() {
    state = {
      ...createInitialState(),
      trackId: state.trackId,
      raceLaps: state.raceLaps,
    }
  }

  function sendMessage(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(payload))
    return true
  }

  function isActiveSocket(candidate) {
    return socket === candidate
  }

  function handleServerMessage(message) {
    switch (message.type) {
      case 'joined':
        setState({
          connectionStatus: 'connected',
          roomStatus: message.roomStatus ?? 'lobby',
          roomId: message.roomId,
          trackId: message.trackId ?? DEFAULT_TRACK_ID,
          raceLaps: message.raceLaps ?? RACE_LAPS,
          countdownMs: message.countdownMs ?? null,
          lastError: null,
        })
        break
      case 'player_list':
        {
          const players = Array.isArray(message.players) ? message.players : []
          const activePlayerIds = new Set(
            players.map((player) => player.anonymousPlayerId),
          )
          const remotePlayers = new Map(state.remotePlayers)
          for (const anonymousPlayerId of remotePlayers.keys()) {
            if (!activePlayerIds.has(anonymousPlayerId)) {
              remotePlayers.delete(anonymousPlayerId)
            }
          }

          for (const player of players) {
            const existingPlayer = remotePlayers.get(player.anonymousPlayerId)
            if (!existingPlayer) continue

            remotePlayers.set(player.anonymousPlayerId, {
              ...existingPlayer,
              displayName: player.displayName ?? existingPlayer.displayName,
              bestLapMs: player.bestLapMs ?? existingPlayer.bestLapMs ?? null,
              allTimeBestLapMs:
                player.allTimeBestLapMs ?? existingPlayer.allTimeBestLapMs ?? null,
            })
          }

        setState({
          roomStatus: message.roomStatus ?? state.roomStatus,
          connectedPlayers: players,
          remotePlayers,
        })
        break
        }
      case 'countdown_started':
        setState({
          roomStatus: 'countdown',
          countdownStartedAt:
            (message.startsAt ?? Date.now()) - (message.countdownMs ?? 0),
          countdownMs: message.countdownMs ?? state.countdownMs,
        })
        break
      case 'race_started':
        setState({
          roomStatus: 'racing',
          raceStartedAt: message.startedAt ?? Date.now(),
        })
        break
      case 'state_snapshot': {
        const remotePlayers = new Map(state.remotePlayers)
        const localIdentity = identityProvider()
        const receivedAt = Date.now()
        const connectedPlayersById = new Map(
          state.connectedPlayers.map((player) => [player.anonymousPlayerId, player]),
        )

        if (Array.isArray(message.players)) {
          for (const player of message.players) {
            if (player.anonymousPlayerId === localIdentity.anonymousPlayerId) continue
            const existingPlayer = remotePlayers.get(player.anonymousPlayerId) ?? {}
            const connectedPlayer = connectedPlayersById.get(player.anonymousPlayerId) ?? {}
            remotePlayers.set(player.anonymousPlayerId, {
              ...existingPlayer,
              ...player,
              allTimeBestLapMs:
                connectedPlayer.allTimeBestLapMs ??
                existingPlayer.allTimeBestLapMs ??
                null,
              receivedAt,
            })
          }
        }

        setState({ remotePlayers })
        break
      }
      case 'race_finished':
        setState({
          roomStatus: 'finished',
          connectedPlayers: state.connectedPlayers.map((player) =>
            player.anonymousPlayerId === message.anonymousPlayerId
              ? {
                  ...player,
                  finished: true,
                  finishPlace: message.place,
                  bestLapMs: message.bestLapMs ?? player.bestLapMs,
                }
              : player,
          ),
        })
        break
      case 'error':
        setState({
          lastError: message.message ?? 'Unknown websocket error.',
        })
        break
      case 'pong':
      case 'lap_completed':
        break
      default:
        console.warn('Unknown multiplayer message', message)
    }
  }

  function connect({ roomId, trackId = DEFAULT_TRACK_ID } = {}) {
    disconnect()

    const identity = identityProvider()
    const socketUrl = buildSocketUrl(roomId)
    const nextSocket = new WebSocket(socketUrl)
    socket = nextSocket

    setState({
      connectionStatus: 'connecting',
      roomStatus: 'offline',
      roomId,
      trackId,
      lastError: null,
      remotePlayers: new Map(),
      connectedPlayers: [],
    })

    nextSocket.addEventListener('open', () => {
      if (!isActiveSocket(nextSocket)) return

      sendMessage({
        type: 'join',
        anonymousPlayerId: identity.anonymousPlayerId,
        displayName: identity.displayName,
        trackId,
      })

      clearPingTimer()
      pingTimer = window.setInterval(() => {
        sendMessage({
          type: 'ping',
          clientTime: Date.now(),
        })
      }, PING_INTERVAL_MS)
    })

    nextSocket.addEventListener('message', (event) => {
      if (!isActiveSocket(nextSocket)) return

      try {
        const message = JSON.parse(event.data)
        handleServerMessage(message)
      } catch (error) {
        console.warn('Failed to parse multiplayer message', error)
      }
    })

    nextSocket.addEventListener('close', () => {
      if (!isActiveSocket(nextSocket)) return

      clearPingTimer()
      socket = null
      const lastError =
        state.connectionStatus === 'error' ? state.lastError : null
      setState({
        ...createInitialState(),
        trackId: state.trackId,
        raceLaps: state.raceLaps,
        connectionStatus:
          state.connectionStatus === 'error' ? 'error' : 'disconnected',
        roomId,
        lastError,
      })
    })

    nextSocket.addEventListener('error', () => {
      if (!isActiveSocket(nextSocket)) return

      setState({
        connectionStatus: 'error',
        lastError: 'Could not connect to the room.',
      })
    })
  }

  function disconnect() {
    clearPingTimer()
    if (socket) {
      socket.close(1000, 'Client disconnected')
      socket = null
    }

    resetConnectionState()
    emit()
  }

  function refreshIdentity() {
    const identity = identityProvider()
    if (!identity.displayName) return

    sendMessage({
      type: 'join',
      anonymousPlayerId: identity.anonymousPlayerId,
      displayName: identity.displayName,
      trackId: state.trackId,
    })
  }

  function sendPlayerState(playerState) {
    if (state.roomStatus !== 'racing') return
    const identity = identityProvider()
    sendMessage({
      type: 'player_state',
      anonymousPlayerId: identity.anonymousPlayerId,
      ...playerState,
    })
  }

  function reportLapCompleted(lapEvent) {
    sendMessage({
      type: 'lap_completed',
      ...lapEvent,
    })
  }

  function reportRaceFinished(raceEvent) {
    sendMessage({
      type: 'race_finished',
      ...raceEvent,
    })
  }

  function subscribe(listener) {
    listeners.add(listener)
    listener(getState())

    return () => {
      listeners.delete(listener)
    }
  }

  function getState() {
    return {
      ...state,
      remotePlayers: new Map(state.remotePlayers),
      connectedPlayers: [...state.connectedPlayers],
    }
  }

  function getRemotePlayers() {
    return [...state.remotePlayers.values()]
  }

  return {
    connect,
    disconnect,
    getRemotePlayers,
    getState,
    refreshIdentity,
    reportLapCompleted,
    reportRaceFinished,
    sendPlayerState,
    subscribe,
  }
}
