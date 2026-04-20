import { DurableObject } from 'cloudflare:workers'

import {
  DEFAULT_TRACK_ID,
  MAX_MESSAGES_PER_WINDOW,
  MAX_VALID_LAP_MS,
  MAX_VALID_RACE_MS,
  MAX_WS_MESSAGE_BYTES,
  MESSAGE_WINDOW_MS,
  MIN_VALID_LAP_MS,
  PING_INTERVAL_MS,
  RACE_LAPS,
  ROOM_COUNTDOWN_MS,
  ROOM_MAX_PLAYERS,
  SNAPSHOT_BROADCAST_INTERVAL_MS,
  coerceFiniteInteger,
  coerceFiniteNumber,
  isAnonymousPlayerId,
  sanitizeDisplayName,
  sanitizeQuaternion,
  sanitizeTrackId,
  sanitizeVector3,
} from '../../shared/multiplayer.js'

const ROOM_STATE_KEY = 'room-state'
const MAX_STORED_ACCEPTED_LAPS = 6
const ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000

function createRoomState(roomId) {
  return {
    roomId,
    trackId: DEFAULT_TRACK_ID,
    status: 'lobby',
    countdownStartedAt: null,
    raceStartedAt: null,
    finishedAt: null,
    finishers: [],
    cleanupScheduledAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function createConnectionAttachment({ connectionId, ipAddress }) {
  return {
    connectionId,
    ipAddress,
    connectedAt: Date.now(),
    joined: false,
    anonymousPlayerId: null,
    displayName: null,
    trackId: DEFAULT_TRACK_ID,
    raceStartedAt: null,
    currentLapNumber: 0,
    currentLapStartedAt: null,
    bestLapMs: null,
    raceMs: null,
    finished: false,
    finishPlace: null,
    acceptedLapSubmissions: [],
    lastJoinedAt: null,
    lastPingAt: null,
  }
}

function sanitizeClientLapId(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || normalized.length > 100) {
    return null
  }

  return normalized
}

export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.ctx = ctx
    this.env = env
    this.roomState = null
    this.roomStatePromise = null
    this.connections = new Map()
    this.lastSnapshotBroadcastAt = 0

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() ?? createConnectionAttachment({
        connectionId: crypto.randomUUID(),
        ipAddress: 'unknown',
      })
      this.connections.set(socket, {
        attachment,
        joinedPlayerState: null,
        previousProgress: null,
        lastProgress: null,
        messageWindowStartedAt: Date.now(),
        messageCount: 0,
      })
    }
  }

  async fetch(request) {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const roomId = url.pathname.endsWith('/summary')
      ? pathParts.at(-2)
      : pathParts.at(-1)
    const upgrade = request.headers.get('Upgrade')

    if (request.method === 'GET' && url.pathname.endsWith('/summary')) {
      return Response.json(await this.getRoomSummary(roomId))
    }

    if (upgrade !== 'websocket') {
      return new Response('Expected websocket upgrade', { status: 400 })
    }

    const roomState = await this.getRoomState(roomId)
    const activePlayers = this.getJoinedSockets()

    if (activePlayers.length >= ROOM_MAX_PLAYERS) {
      return new Response('Room is full', { status: 429 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const attachment = createConnectionAttachment({
      connectionId: crypto.randomUUID(),
      ipAddress:
        request.headers.get('CF-Connecting-IP') ??
        request.headers.get('x-forwarded-for') ??
        'unknown',
    })

    this.ctx.acceptWebSocket(server)
    server.serializeAttachment(attachment)
    this.connections.set(server, {
      attachment,
      joinedPlayerState: null,
      previousProgress: null,
      lastProgress: null,
      messageWindowStartedAt: Date.now(),
      messageCount: 0,
    })

    console.log(
      JSON.stringify({
        event: 'ws_connected',
        roomId: roomState.roomId,
        connectionId: attachment.connectionId,
        activeSockets: this.ctx.getWebSockets().length,
      }),
    )

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async alarm() {
    const roomState = await this.getRoomState()
    const now = Date.now()

    if (roomState.cleanupScheduledAt && now >= roomState.cleanupScheduledAt) {
      if (this.connections.size === 0) {
        await this.clearRoomStorage()
        return
      }

      roomState.cleanupScheduledAt = null
      await this.persistRoomState()
    }

    const connectedPlayers = this.getJoinedSockets()

    if (roomState.status !== 'countdown' || !roomState.raceStartedAt) {
      return
    }

    if (connectedPlayers.length === 0) {
      roomState.status = 'lobby'
      roomState.countdownStartedAt = null
      roomState.raceStartedAt = null
      await this.scheduleRoomCleanup()
      return
    }

    roomState.status = 'racing'
    roomState.updatedAt = now

    for (const socket of connectedPlayers) {
      const connection = this.connections.get(socket)
      if (!connection) continue

      connection.attachment.raceStartedAt = roomState.raceStartedAt
      connection.attachment.currentLapNumber = 1
      connection.attachment.currentLapStartedAt = roomState.raceStartedAt
      connection.attachment.bestLapMs = null
      connection.attachment.raceMs = null
      connection.attachment.finished = false
      connection.attachment.finishPlace = null
      connection.attachment.acceptedLapSubmissions = []
      socket.serializeAttachment(connection.attachment)
    }

    await this.persistRoomState()
    this.broadcast({
      type: 'race_started',
      roomId: roomState.roomId,
      trackId: roomState.trackId,
      raceLaps: RACE_LAPS,
      startedAt: roomState.raceStartedAt,
    })
    this.broadcastPlayerList()
  }

  async webSocketMessage(socket, message) {
    const connection = this.getConnection(socket)
    if (!connection) return

    if (typeof message !== 'string') {
      this.sendError(socket, 'invalid_payload', 'Only text messages are supported.')
      return
    }

    if (message.length > MAX_WS_MESSAGE_BYTES) {
      this.sendError(socket, 'message_too_large', 'Message too large.')
      socket.close(1009, 'Message too large')
      return
    }

    if (!this.recordMessage(connection)) {
      this.sendError(socket, 'rate_limited', 'Too many messages sent too quickly.')
      socket.close(1011, 'Rate limited')
      return
    }

    let payload
    try {
      payload = JSON.parse(message)
    } catch {
      this.sendError(socket, 'invalid_json', 'Could not parse JSON payload.')
      return
    }

    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
      this.sendError(socket, 'invalid_payload', 'Missing message type.')
      return
    }

    switch (payload.type) {
      case 'join':
        await this.handleJoin(socket, payload)
        break
      case 'player_ready':
        await this.handlePlayerReady(socket)
        break
      case 'player_state':
        await this.handlePlayerState(socket, payload)
        break
      case 'lap_completed':
        await this.handleLapCompleted(socket, payload)
        break
      case 'race_finished':
        await this.handleRaceFinished(socket, payload)
        break
      case 'ping':
        connection.attachment.lastPingAt = Date.now()
        socket.send(
          JSON.stringify({
            type: 'pong',
            serverTime: Date.now(),
            echo: payload.clientTime ?? null,
          }),
        )
        break
      default:
        this.sendError(socket, 'unknown_type', `Unsupported message type "${payload.type}".`)
        break
    }
  }

  async webSocketClose(socket, code, reason) {
    const connection = this.connections.get(socket)
    if (connection) {
      console.log(
        JSON.stringify({
          event: 'ws_closed',
          roomId: this.roomState?.roomId ?? 'unknown',
          connectionId: connection.attachment.connectionId,
          anonymousPlayerId: connection.attachment.anonymousPlayerId,
          code,
          reason,
        }),
      )
    }

    this.connections.delete(socket)
    if (this.connections.size === 0) {
      await this.handleRoomBecameIdle()
    }
    this.broadcastPlayerList()
  }

  async handleJoin(socket, payload) {
    let roomState = await this.getRoomState()
    const connection = this.getConnection(socket)
    if (!connection) return

    const isNewJoin = !connection.attachment.joined
    const anonymousPlayerId = isAnonymousPlayerId(payload.anonymousPlayerId)
      ? payload.anonymousPlayerId
      : null
    const displayName = sanitizeDisplayName(payload.displayName)
    const trackId = sanitizeTrackId(payload.trackId ?? DEFAULT_TRACK_ID) ?? DEFAULT_TRACK_ID

    if (!anonymousPlayerId || !displayName) {
      this.sendError(socket, 'invalid_identity', 'A valid anonymous player ID and display name are required.')
      return
    }

    if (roomState.cleanupScheduledAt) {
      await this.cancelRoomCleanup()
    }

    if (roomState.status === 'finished' && this.getJoinedSockets().length <= 1) {
      this.roomState = createRoomState(roomState.roomId)
      this.roomState.trackId = trackId
      roomState = this.roomState
    }

    if (
      roomState.trackId &&
      roomState.trackId !== DEFAULT_TRACK_ID &&
      roomState.trackId !== trackId
    ) {
      this.sendError(socket, 'track_mismatch', 'This room is already running a different track.')
      return
    }

    this.roomState.trackId = trackId

    for (const [otherSocket, otherConnection] of this.connections.entries()) {
      if (
        otherSocket !== socket &&
        otherConnection.attachment.anonymousPlayerId === anonymousPlayerId
      ) {
        otherSocket.close(1008, 'Replaced by a newer connection')
        this.connections.delete(otherSocket)
      }
    }

    connection.attachment.joined = true
    connection.attachment.anonymousPlayerId = anonymousPlayerId
    connection.attachment.displayName = displayName
    connection.attachment.trackId = trackId
    connection.attachment.lastJoinedAt = Date.now()
    if (isNewJoin) {
      this.resetConnectionRaceState(connection)
    }
    if (roomState.status === 'lobby') {
      this.roomState.status = 'racing'
      this.roomState.countdownStartedAt = null
      this.roomState.raceStartedAt = connection.attachment.lastJoinedAt
    }
    socket.serializeAttachment(connection.attachment)

    await this.persistRoomState()

    socket.send(
      JSON.stringify({
        type: 'joined',
        roomId: roomState.roomId,
        trackId: this.roomState.trackId,
        roomStatus: this.roomState.status,
        raceLaps: RACE_LAPS,
        countdownMs: ROOM_COUNTDOWN_MS,
        serverTime: Date.now(),
        player: {
          anonymousPlayerId,
          displayName,
        },
      }),
    )

    this.broadcastPlayerList()
    console.log(
      JSON.stringify({
        event: 'player_joined',
        roomId: roomState.roomId,
        anonymousPlayerId,
        displayName,
        roomStatus: this.roomState.status,
      }),
    )
  }

  async handlePlayerReady(socket) {
    const roomState = await this.getRoomState()
    const connection = this.getConnection(socket)
    if (!connection?.attachment.joined) {
      this.sendError(socket, 'not_joined', 'Join the room before starting your race.')
      return
    }

    if (roomState.status !== 'racing') {
      this.sendError(socket, 'race_not_started', 'The room race is not live yet.')
      return
    }

    const now = Date.now()
    this.resetConnectionRaceState(connection, now)
    socket.serializeAttachment(connection.attachment)

    socket.send(
      JSON.stringify({
        type: 'player_ready',
        anonymousPlayerId: connection.attachment.anonymousPlayerId,
        startedAt: now,
      }),
    )

    this.broadcastPlayerList()
  }

  async handlePlayerState(socket, payload) {
    const roomState = await this.getRoomState()
    const connection = this.getConnection(socket)
    if (!connection?.attachment.joined) {
      this.sendError(socket, 'not_joined', 'Join the room before sending race updates.')
      return
    }

    if (roomState.status !== 'racing') {
      return
    }

    const playerState = sanitizeIncomingPlayerState(payload, connection.attachment.anonymousPlayerId)
    if (!playerState) {
      this.sendError(socket, 'invalid_player_state', 'Malformed player state payload.')
      return
    }

    connection.previousProgress = connection.lastProgress
    connection.lastProgress = playerState.progress
    connection.joinedPlayerState = playerState

    const now = Date.now()
    if (now - this.lastSnapshotBroadcastAt >= SNAPSHOT_BROADCAST_INTERVAL_MS) {
      this.lastSnapshotBroadcastAt = now
      this.broadcastStateSnapshot(now)
    }
  }

  async handleLapCompleted(socket, payload) {
    const roomState = await this.getRoomState()
    const connection = this.getConnection(socket)
    if (!connection?.attachment.joined) {
      this.sendError(socket, 'not_joined', 'Join the room before sending lap events.')
      return
    }

    if (roomState.status !== 'racing' || !connection.attachment.currentLapStartedAt) {
      this.sendError(socket, 'race_not_started', 'The room race has not started yet.')
      return
    }

    const clientLapId = sanitizeClientLapId(payload.clientLapId)
    if (clientLapId) {
      const existingAcceptedLap = connection.attachment.acceptedLapSubmissions.find(
        (submission) => submission.clientLapId === clientLapId,
      )

      if (existingAcceptedLap) {
        socket.send(JSON.stringify(existingAcceptedLap))
        return
      }
    }

    const lapNumber = coerceFiniteInteger(payload.lapNumber, 1, RACE_LAPS)
    if (lapNumber === null || lapNumber !== connection.attachment.currentLapNumber) {
      this.sendError(socket, 'invalid_lap_number', 'Lap number was not the next expected lap.')
      return
    }

    const now = Date.now()
    const officialLapMs = now - connection.attachment.currentLapStartedAt
    const reportedLapMs = coerceFiniteInteger(payload.lapMs, MIN_VALID_LAP_MS, MAX_VALID_LAP_MS)

    if (
      officialLapMs < MIN_VALID_LAP_MS ||
      officialLapMs > MAX_VALID_LAP_MS ||
      (reportedLapMs !== null && Math.abs(reportedLapMs - officialLapMs) > 2500)
    ) {
      this.sendError(socket, 'invalid_lap_time', 'Lap timing did not pass basic validation.')
      return
    }

    connection.attachment.bestLapMs = Number.isInteger(connection.attachment.bestLapMs)
      ? Math.min(connection.attachment.bestLapMs, officialLapMs)
      : officialLapMs
    connection.attachment.currentLapNumber += 1
    connection.attachment.currentLapStartedAt = now
    const lapCompletedMessage = {
      type: 'lap_completed',
      clientLapId,
      anonymousPlayerId: connection.attachment.anonymousPlayerId,
      displayName: connection.attachment.displayName,
      lapNumber,
      lapMs: officialLapMs,
      bestLapMs: connection.attachment.bestLapMs,
      finishedAt: now,
    }
    if (clientLapId) {
      connection.attachment.acceptedLapSubmissions.push(lapCompletedMessage)
      connection.attachment.acceptedLapSubmissions =
        connection.attachment.acceptedLapSubmissions.slice(-MAX_STORED_ACCEPTED_LAPS)
    }
    socket.serializeAttachment(connection.attachment)

    await this.env.DB.prepare(
      `
        INSERT INTO lap_times (
          anonymous_player_id,
          display_name,
          room_id,
          track_id,
          lap_number,
          lap_ms,
          race_ms,
          finished_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)
      `,
    )
      .bind(
        connection.attachment.anonymousPlayerId,
        connection.attachment.displayName,
        roomState.roomId,
        roomState.trackId,
        lapNumber,
        officialLapMs,
        now,
      )
      .run()

    this.broadcast(lapCompletedMessage)
    this.broadcastPlayerList()
  }

  async handleRaceFinished(socket, payload) {
    const roomState = await this.getRoomState()
    const connection = this.getConnection(socket)
    if (!connection?.attachment.joined) {
      this.sendError(socket, 'not_joined', 'Join the room before finishing the race.')
      return
    }

    if (roomState.status !== 'racing' || connection.attachment.finished) {
      return
    }

    if (connection.attachment.currentLapNumber <= RACE_LAPS) {
      this.sendError(socket, 'race_incomplete', 'The server has not accepted enough laps yet.')
      return
    }

    const raceStartedAt = connection.attachment.raceStartedAt ?? roomState.raceStartedAt
    if (!raceStartedAt) {
      this.sendError(socket, 'race_not_started', 'The room race has not started yet.')
      return
    }

    const now = Date.now()
    const raceMs = now - raceStartedAt
    const reportedRaceMs = coerceFiniteInteger(payload.raceMs, MIN_VALID_LAP_MS, MAX_VALID_RACE_MS)

    if (
      raceMs < MIN_VALID_LAP_MS ||
      raceMs > MAX_VALID_RACE_MS ||
      (reportedRaceMs !== null && Math.abs(reportedRaceMs - raceMs) > 5000)
    ) {
      this.sendError(socket, 'invalid_race_time', 'Race timing did not pass basic validation.')
      return
    }

    roomState.finishers.push({
      anonymousPlayerId: connection.attachment.anonymousPlayerId,
      displayName: connection.attachment.displayName,
      place: roomState.finishers.length + 1,
      raceMs,
      bestLapMs: connection.attachment.bestLapMs,
      finishedAt: now,
    })

    connection.attachment.finished = true
    connection.attachment.finishPlace = roomState.finishers.length
    connection.attachment.raceMs = raceMs
    socket.serializeAttachment(connection.attachment)

    await this.env.DB.batch([
      this.env.DB.prepare(
        `
          INSERT INTO race_results (
            anonymous_player_id,
            display_name,
            room_id,
            track_id,
            place,
            race_ms,
            best_lap_ms,
            finished_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `,
      ).bind(
        connection.attachment.anonymousPlayerId,
        connection.attachment.displayName,
        roomState.roomId,
        roomState.trackId,
        connection.attachment.finishPlace,
        raceMs,
        connection.attachment.bestLapMs,
        now,
      ),
      this.env.DB.prepare(
        `
          UPDATE lap_times
          SET race_ms = ?1
          WHERE id = (
            SELECT id
            FROM lap_times
            WHERE anonymous_player_id = ?2
              AND room_id = ?3
              AND track_id = ?4
            ORDER BY finished_at DESC
            LIMIT 1
          )
        `,
      ).bind(
        raceMs,
        connection.attachment.anonymousPlayerId,
        roomState.roomId,
        roomState.trackId,
      ),
    ])

    if (roomState.finishers.length === this.getJoinedSockets().length) {
      roomState.status = 'finished'
      roomState.finishedAt = now
    }

    roomState.updatedAt = now
    await this.persistRoomState()

    this.broadcast({
      type: 'race_finished',
      anonymousPlayerId: connection.attachment.anonymousPlayerId,
      displayName: connection.attachment.displayName,
      place: connection.attachment.finishPlace,
      raceMs,
      bestLapMs: connection.attachment.bestLapMs,
      finishedAt: now,
    })
    this.broadcastPlayerList()
  }

  getConnection(socket) {
    return this.connections.get(socket) ?? null
  }

  recordMessage(connection) {
    const now = Date.now()
    if (now - connection.messageWindowStartedAt > MESSAGE_WINDOW_MS) {
      connection.messageWindowStartedAt = now
      connection.messageCount = 0
    }

    connection.messageCount += 1
    return connection.messageCount <= MAX_MESSAGES_PER_WINDOW
  }

  async getRoomState(explicitRoomId) {
    if (this.roomState) {
      if (explicitRoomId && !this.roomState.roomId) {
        this.roomState.roomId = explicitRoomId
      }
      return this.roomState
    }

    this.roomStatePromise ??= (async () => {
      const storedState = await this.ctx.storage.get(ROOM_STATE_KEY)
      this.roomState =
        storedState ??
        createRoomState(explicitRoomId ?? this.ctx.id.toString())
      if (explicitRoomId && !this.roomState.roomId) {
        this.roomState.roomId = explicitRoomId
      }
      return this.roomState
    })()

    return this.roomStatePromise
  }

  async persistRoomState() {
    if (!this.roomState) return
    this.roomState.updatedAt = Date.now()
    await this.ctx.storage.put(ROOM_STATE_KEY, this.roomState)
  }

  async handleRoomBecameIdle() {
    const roomState = await this.getRoomState()
    if (!roomState) return

    if (roomState.status === 'countdown') {
      roomState.status = 'lobby'
      roomState.countdownStartedAt = null
      roomState.raceStartedAt = null
    }

    await this.scheduleRoomCleanup()
  }

  async scheduleRoomCleanup(delayMs = ROOM_CLEANUP_DELAY_MS) {
    if (!this.roomState) return

    this.roomState.cleanupScheduledAt = Date.now() + delayMs
    await this.persistRoomState()
    this.ctx.storage.setAlarm(this.roomState.cleanupScheduledAt)
  }

  async cancelRoomCleanup() {
    if (!this.roomState?.cleanupScheduledAt) return

    this.roomState.cleanupScheduledAt = null
    await this.persistRoomState()
    await this.ctx.storage.deleteAlarm()
  }

  async clearRoomStorage() {
    this.roomState = null
    this.roomStatePromise = null
    this.lastSnapshotBroadcastAt = 0
    await this.ctx.storage.deleteAll()
  }

  async getRoomSummary(explicitRoomId) {
    const storedState = await this.ctx.storage.get(ROOM_STATE_KEY)
    const activePlayers = this.getJoinedSockets().length
    const roomId = storedState?.roomId ?? explicitRoomId ?? this.roomState?.roomId ?? null
    const roomStatus = storedState?.status ?? 'offline'
    const hasActivePlayers = activePlayers > 0

    return {
      ok: true,
      roomId,
      exists: Boolean(storedState) || hasActivePlayers,
      roomStatus,
      activePlayerCount: activePlayers,
      hasActivePlayers,
      joinable: true,
    }
  }

  getJoinedSockets() {
    return [...this.connections.entries()]
      .filter(([, connection]) => connection.attachment.joined)
      .map(([socket]) => socket)
  }

  resetConnectionRaceState(connection, startedAt = null) {
    connection.attachment.raceStartedAt = startedAt
    connection.attachment.currentLapNumber = startedAt ? 1 : 0
    connection.attachment.currentLapStartedAt = startedAt
    connection.attachment.bestLapMs = null
    connection.attachment.raceMs = null
    connection.attachment.finished = false
    connection.attachment.finishPlace = null
    connection.attachment.acceptedLapSubmissions = []
    connection.joinedPlayerState = null
    connection.previousProgress = null
    connection.lastProgress = null
  }

  broadcast(message) {
    const payload = JSON.stringify(message)
    for (const socket of this.getJoinedSockets()) {
      try {
        socket.send(payload)
      } catch (error) {
        console.warn('Failed to broadcast to socket', error)
      }
    }
  }

  async getAllTimeBestLapMap(players, trackId) {
    const anonymousPlayerIds = players
      .map((player) => player.anonymousPlayerId)
      .filter((anonymousPlayerId) => typeof anonymousPlayerId === 'string')

    if (!anonymousPlayerIds.length) {
      return new Map()
    }

    const placeholders = anonymousPlayerIds
      .map((_, index) => `?${index + 2}`)
      .join(', ')
    const statement = this.env.DB.prepare(
      `
        SELECT
          anonymous_player_id,
          MIN(lap_ms) AS best_lap_ms
        FROM lap_times
        WHERE track_id = ?1
          AND anonymous_player_id IN (${placeholders})
        GROUP BY anonymous_player_id
      `,
    ).bind(trackId, ...anonymousPlayerIds)
    const { results = [] } = await statement.all()

    return new Map(
      results.map((row) => [row.anonymous_player_id, row.best_lap_ms]),
    )
  }

  broadcastPlayerList() {
    void (async () => {
      const players = [...this.connections.values()]
        .filter((connection) => connection.attachment.joined)
        .map((connection) => ({
          anonymousPlayerId: connection.attachment.anonymousPlayerId,
          displayName: connection.attachment.displayName,
          connectedAt: connection.attachment.connectedAt,
          finished: connection.attachment.finished,
          finishPlace: connection.attachment.finishPlace,
          bestLapMs: connection.attachment.bestLapMs,
        }))
        .sort((left, right) => left.connectedAt - right.connectedAt)
      const allTimeBestLapMap = await this.getAllTimeBestLapMap(
        players,
        this.roomState?.trackId ?? DEFAULT_TRACK_ID,
      )

      this.broadcast({
        type: 'player_list',
        roomId: this.roomState?.roomId ?? null,
        roomStatus: this.roomState?.status ?? 'lobby',
        players: players.map((player) => ({
          ...player,
          allTimeBestLapMs:
            allTimeBestLapMap.get(player.anonymousPlayerId) ?? null,
        })),
      })
    })().catch((error) => {
      console.warn('Failed to broadcast player list', error)
    })
  }

  broadcastStateSnapshot(timestamp) {
    const players = [...this.connections.values()]
      .filter(
        (connection) =>
          connection.attachment.joined &&
          connection.joinedPlayerState &&
          !connection.attachment.finished,
      )
      .map((connection) => ({
        anonymousPlayerId: connection.attachment.anonymousPlayerId,
        displayName: connection.attachment.displayName,
        timestamp: connection.joinedPlayerState.timestamp,
        position: connection.joinedPlayerState.position,
        quaternion: connection.joinedPlayerState.quaternion,
        velocity: connection.joinedPlayerState.velocity,
        lap: connection.joinedPlayerState.lap,
        progress: connection.joinedPlayerState.progress,
      }))

    if (players.length === 0) return

    this.broadcast({
      type: 'state_snapshot',
      timestamp,
      players,
    })
  }

  sendError(socket, code, message) {
    try {
      socket.send(
        JSON.stringify({
          type: 'error',
          code,
          message,
        }),
      )
    } catch (error) {
      console.warn('Failed to send websocket error', error)
    }
  }
}

function sanitizeIncomingPlayerState(payload, anonymousPlayerId) {
  if (payload.anonymousPlayerId !== anonymousPlayerId) {
    return null
  }

  const timestamp = coerceFiniteInteger(
    payload.timestamp ?? Date.now(),
    0,
    Date.now() + PING_INTERVAL_MS,
  )
  const position = sanitizeVector3(payload.position)
  const quaternion = sanitizeQuaternion(payload.quaternion)
  const velocity =
    payload.velocity == null ? null : sanitizeVector3(payload.velocity, 2_000)
  const lap = coerceFiniteInteger(payload.lap, 1, RACE_LAPS)
  const progress = coerceFiniteNumber(payload.progress, 0, 1)

  if (
    timestamp === null ||
    !position ||
    !quaternion ||
    lap === null ||
    progress === null
  ) {
    return null
  }

  return {
    timestamp,
    position,
    quaternion,
    velocity,
    lap,
    progress,
  }
}
