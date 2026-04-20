import {
  DEFAULT_TRACK_ID,
  PING_INTERVAL_MS,
  RACE_LAPS,
  buildSocketUrl,
  createUuid,
} from '../../shared/multiplayer.js'

const LAP_SUBMISSION_RETRY_MS = 1500
const MAX_LAP_SUBMISSION_ATTEMPTS = 4

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
    localPlayerAllTimeBestLapMs: null,
    pendingLapSubmission: null,
    lastLapSubmission: null,
    lastError: null,
  }
}

export function createMultiplayerClient({ identityProvider }) {
  const listeners = new Set()
  let socket = null
  let pingTimer = null
  let lapSubmissionRetryTimer = null
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

  function clearLapSubmissionRetryTimer() {
    if (lapSubmissionRetryTimer) {
      globalThis.clearTimeout(lapSubmissionRetryTimer)
      lapSubmissionRetryTimer = null
    }
  }

  function resetConnectionState() {
    clearLapSubmissionRetryTimer()
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

  function createLapSubmissionResult(status, details = {}) {
    return {
      status,
      clientLapId: details.clientLapId ?? null,
      lapNumber: details.lapNumber ?? null,
      lapMs: details.lapMs ?? null,
      officialLapMs: details.officialLapMs ?? null,
      bestLapMs: details.bestLapMs ?? null,
      attempts: details.attempts ?? 0,
      optimisticBestLapMs: details.optimisticBestLapMs ?? null,
      message: details.message ?? '',
      resolvedAt: details.resolvedAt ?? Date.now(),
    }
  }

  function isLapSubmissionError(code) {
    return [
      'not_joined',
      'race_not_started',
      'invalid_lap_number',
      'invalid_lap_time',
    ].includes(code)
  }

  function getConnectedPlayer(players, anonymousPlayerId) {
    return players.find((player) => player.anonymousPlayerId === anonymousPlayerId) ?? null
  }

  function getServerBackedPersonalBest(players = state.connectedPlayers) {
    const identity = identityProvider()
    const localPlayer = getConnectedPlayer(players, identity.anonymousPlayerId)
    return Number.isFinite(localPlayer?.allTimeBestLapMs) && localPlayer.allTimeBestLapMs > 0
      ? localPlayer.allTimeBestLapMs
      : null
  }

  function getEffectiveLocalPlayerBestLapMs(serverBestLapMs, pendingLapSubmission = state.pendingLapSubmission) {
    const optimisticBestLapMs = pendingLapSubmission?.optimisticBestLapMs
    if (
      Number.isFinite(optimisticBestLapMs) &&
      optimisticBestLapMs > 0 &&
      (!Number.isFinite(serverBestLapMs) || optimisticBestLapMs < serverBestLapMs)
    ) {
      return optimisticBestLapMs
    }

    return serverBestLapMs
  }

  function finalizeLapSubmission(status, details = {}) {
    clearLapSubmissionRetryTimer()

    const fallbackPersonalBest = getServerBackedPersonalBest()
    const nextBestLapMs =
      Number.isFinite(details.bestLapMs) && details.bestLapMs > 0
        ? details.bestLapMs
        : fallbackPersonalBest

    setState({
      pendingLapSubmission: null,
      localPlayerAllTimeBestLapMs: nextBestLapMs,
      lastLapSubmission: createLapSubmissionResult(status, details),
      lastError: status === 'rejected'
        ? details.message ?? 'Lap time was not accepted by the server.'
        : null,
    })
  }

  function scheduleLapSubmissionRetry(clientLapId) {
    clearLapSubmissionRetryTimer()
    lapSubmissionRetryTimer = globalThis.setTimeout(() => {
      sendPendingLapSubmission(clientLapId)
    }, LAP_SUBMISSION_RETRY_MS)
  }

  function sendPendingLapSubmission(expectedClientLapId) {
    const pendingLapSubmission = state.pendingLapSubmission
    if (!pendingLapSubmission || pendingLapSubmission.clientLapId !== expectedClientLapId) {
      return
    }

    if (pendingLapSubmission.attempts >= MAX_LAP_SUBMISSION_ATTEMPTS) {
      finalizeLapSubmission('rejected', {
        clientLapId: pendingLapSubmission.clientLapId,
        lapNumber: pendingLapSubmission.lapNumber,
        lapMs: pendingLapSubmission.lapMs,
        attempts: pendingLapSubmission.attempts,
        optimisticBestLapMs: pendingLapSubmission.optimisticBestLapMs,
        message: 'Could not confirm lap save after multiple attempts.',
      })
      return
    }

    const sent = sendMessage({
      type: 'lap_completed',
      clientLapId: pendingLapSubmission.clientLapId,
      lapNumber: pendingLapSubmission.lapNumber,
      lapMs: pendingLapSubmission.lapMs,
    })

    if (!sent) {
      scheduleLapSubmissionRetry(expectedClientLapId)
      return
    }

    setState({
      pendingLapSubmission: {
        ...pendingLapSubmission,
        attempts: pendingLapSubmission.attempts + 1,
        lastAttemptAt: Date.now(),
      },
    })
    scheduleLapSubmissionRetry(expectedClientLapId)
  }

  function handleServerMessage(message) {
    switch (message.type) {
      case 'joined':
        clearLapSubmissionRetryTimer()
        setState({
          connectionStatus: 'connected',
          roomStatus: message.roomStatus ?? 'lobby',
          roomId: message.roomId,
          trackId: message.trackId ?? DEFAULT_TRACK_ID,
          raceLaps: message.raceLaps ?? RACE_LAPS,
          countdownMs: message.countdownMs ?? null,
          localPlayerAllTimeBestLapMs: null,
          pendingLapSubmission: null,
          lastLapSubmission: null,
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

        const serverBestLapMs = getServerBackedPersonalBest(players)
        setState({
          roomStatus: message.roomStatus ?? state.roomStatus,
          connectedPlayers: players,
          localPlayerAllTimeBestLapMs: getEffectiveLocalPlayerBestLapMs(serverBestLapMs),
          remotePlayers,
        })
        break
        }
      case 'countdown_started':
        clearLapSubmissionRetryTimer()
        setState({
          roomStatus: 'countdown',
          countdownStartedAt:
            (message.startsAt ?? Date.now()) - (message.countdownMs ?? 0),
          countdownMs: message.countdownMs ?? state.countdownMs,
          pendingLapSubmission: null,
          lastLapSubmission: null,
        })
        break
      case 'race_started':
        clearLapSubmissionRetryTimer()
        setState({
          roomStatus: 'racing',
          raceStartedAt: message.startedAt ?? Date.now(),
          pendingLapSubmission: null,
          lastLapSubmission: null,
        })
        break
      case 'player_ready':
        setState({
          roomStatus: 'racing',
          raceStartedAt: message.startedAt ?? Date.now(),
          lastError: null,
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
        if (isLapSubmissionError(message.code) && state.pendingLapSubmission) {
          finalizeLapSubmission('rejected', {
            clientLapId: state.pendingLapSubmission.clientLapId,
            lapNumber: state.pendingLapSubmission.lapNumber,
            lapMs: state.pendingLapSubmission.lapMs,
            attempts: state.pendingLapSubmission.attempts,
            optimisticBestLapMs: state.pendingLapSubmission.optimisticBestLapMs,
            message: message.message ?? 'Lap time was not accepted by the server.',
          })
          break
        }

        setState({
          lastError: message.message ?? 'Unknown websocket error.',
        })
        break
      case 'pong':
        break
      case 'lap_completed': {
        const localIdentity = identityProvider()
        const isLocalLap =
          message.anonymousPlayerId === localIdentity.anonymousPlayerId

        if (!isLocalLap) {
          break
        }

        finalizeLapSubmission('accepted', {
          clientLapId: message.clientLapId ?? state.pendingLapSubmission?.clientLapId,
          lapNumber: message.lapNumber ?? state.pendingLapSubmission?.lapNumber,
          lapMs: state.pendingLapSubmission?.lapMs ?? null,
          officialLapMs: message.lapMs ?? null,
          bestLapMs: message.bestLapMs ?? state.localPlayerAllTimeBestLapMs,
          attempts: state.pendingLapSubmission?.attempts ?? 0,
          optimisticBestLapMs: state.pendingLapSubmission?.optimisticBestLapMs ?? null,
          message: 'Lap time saved to the leaderboard.',
        })
        break
      }
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
      clearLapSubmissionRetryTimer()
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
    clearLapSubmissionRetryTimer()
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
    const clientLapId = createUuid()
    const optimisticBestLapMs =
      Number.isFinite(lapEvent.bestLapMs) && lapEvent.bestLapMs > 0
        ? lapEvent.bestLapMs
        : null

    setState({
      pendingLapSubmission: {
        clientLapId,
        lapNumber: lapEvent.lapNumber ?? null,
        lapMs: lapEvent.lapMs ?? null,
        optimisticBestLapMs,
        attempts: 0,
        submittedAt: Date.now(),
        lastAttemptAt: null,
      },
      localPlayerAllTimeBestLapMs: getEffectiveLocalPlayerBestLapMs(
        getServerBackedPersonalBest(),
        {
          optimisticBestLapMs,
        },
      ),
      lastLapSubmission: null,
      lastError: null,
    })
    sendPendingLapSubmission(clientLapId)
  }

  function reportRaceFinished(raceEvent) {
    sendMessage({
      type: 'race_finished',
      ...raceEvent,
    })
  }

  function reportPlayerReady() {
    sendMessage({
      type: 'player_ready',
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
      localPlayerAllTimeBestLapMs: state.localPlayerAllTimeBestLapMs,
      pendingLapSubmission: state.pendingLapSubmission
        ? { ...state.pendingLapSubmission }
        : null,
      lastLapSubmission: state.lastLapSubmission ? { ...state.lastLapSubmission } : null,
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
    reportPlayerReady,
    reportRaceFinished,
    sendPlayerState,
    subscribe,
  }
}
