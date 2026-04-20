import './style.css'

import { APP_TEMPLATE } from './game/template.js'
import { createMultiplayerClient } from './multiplayer/client.js'
import {
  buildRoomShareUrl,
  getIdentitySnapshot,
  getSharedRoomIdFromUrl,
  saveDisplayName,
  saveRoomId,
} from './multiplayer/identity.js'
import {
  fetchLeaderboard,
  fetchPersonalBest,
  fetchRoomSummary,
} from './multiplayer/leaderboard.js'
import {
  DEFAULT_TRACK_ID,
  formatLapMs,
  sanitizeRoomId,
} from '../shared/multiplayer.js'

const app = document.querySelector('#app')
const IDLE_DISCONNECT_MS = 3 * 60 * 1000
const ROOM_LOOKUP_DEBOUNCE_MS = 250

app.innerHTML = APP_TEMPLATE

const startButton = app.querySelector('.start-button')
const displayNameInputs = [...app.querySelectorAll('[data-display-name-input]')]
const roomIdInputs = [...app.querySelectorAll('[data-room-id-input]')]
const identityMessages = [...app.querySelectorAll('[data-identity-message]')]
const roomStatusMessage = app.querySelector('[data-room-status]')
const roomIdShareInput = app.querySelector('[data-room-id-share-input]')
const copyRoomButton = app.querySelector('[data-copy-room-button]')
const leaveRoomButton = app.querySelector('[data-leave-room-button]')
const playerList = app.querySelector('[data-player-list]')
const playerCount = app.querySelector('[data-player-count]')
const allTimeLeaderboard = app.querySelector('[data-all-time-leaderboard]')

const multiplayer = createMultiplayerClient({
  identityProvider: () => getIdentitySnapshot(),
})

let gamePromise
let gameScreenShown = false
let lastUserInputAt = Date.now()
let roomLookupTimer = null
let latestRoomLookupId = 0
let copyRoomResetTimer = null
let identityMessageSource = 'neutral'
let previousConnectionStatus = multiplayer.getState().connectionStatus
let roomSummary = {
  roomId: null,
  activePlayerCount: 0,
  joinable: true,
  loading: false,
}

function syncInputValues(value, inputs) {
  for (const input of inputs) {
    if (document.activeElement === input) continue
    input.value = value ?? ''
  }
}

function setIdentityMessage(message, tone = 'neutral', source = 'general') {
  identityMessageSource = source
  for (const node of identityMessages) {
    node.textContent = message
    node.dataset.tone = tone
  }
}

function clearRoomSummaryMessage() {
  if (identityMessageSource !== 'room-summary') return
  setIdentityMessage('', 'neutral', 'neutral')
}

function getCurrentRoomId(state = multiplayer.getState()) {
  return state.roomId ?? sanitizeRoomId(roomIdInputs[0]?.value ?? '') ?? 'room-...'
}

function syncRoomIdWithUrl(roomId) {
  const shareUrl = buildRoomShareUrl(roomId)
  if (!shareUrl || window.location.href === shareUrl) return

  window.history.replaceState({}, '', shareUrl)
}

function renderRoomShareControls(state = multiplayer.getState()) {
  const roomId = getCurrentRoomId(state)

  if (roomIdShareInput) {
    roomIdShareInput.value = roomId
  }
}

function syncMobileHudOffset() {
  if (!app) return

  const isMobileViewport = window.matchMedia('(max-width: 640px)').matches
  if (!isMobileViewport || !roomStatusMessage) {
    app.style.removeProperty('--mobile-top-panel-height')
    return
  }

  const topPanelHeight = Math.ceil(
    (app.querySelector('.room-share-card')?.getBoundingClientRect().height ?? 0) + 12,
  )
  app.style.setProperty('--mobile-top-panel-height', `${topPanelHeight}px`)
}

function syncStoredIdentityToUi() {
  const identity = getIdentitySnapshot()
  syncInputValues(identity.displayName ?? '', displayNameInputs)
  syncInputValues(identity.roomId ?? '', roomIdInputs)
}

function hydrateRoomIdFromUrl() {
  const sharedRoomId = getSharedRoomIdFromUrl()
  if (!sharedRoomId) return

  saveRoomId(sharedRoomId)
  syncRoomIdWithUrl(sharedRoomId)
}

function renderLeaderboardList(container, rows) {
  if (!container) return

  if (!rows.length) {
    container.innerHTML = '<div class="leaderboard-empty">No all-time lap times yet.</div>'
    return
  }

  const duplicateNameCounts = rows.reduce((counts, row) => {
    const key = row.displayName ?? ''
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return counts
  }, new Map())

  container.innerHTML = rows
    .map(
      (row) => {
        const hasDuplicateName = (duplicateNameCounts.get(row.displayName ?? '') ?? 0) > 1
        const anonymousIdSuffix = hasDuplicateName
          ? row.anonymousPlayerId?.replace(/-/g, '').slice(0, 4).toUpperCase()
          : ''
        const displayName = anonymousIdSuffix
          ? `${row.displayName} · ${anonymousIdSuffix}`
          : row.displayName
        const metadata = [formatRoomLabel(row.roomId), formatLeaderboardDate(row.bestLapRecordedAt)]
          .filter(Boolean)
          .join(' · ')

        return `
          <div class="leaderboard-row">
            <span class="leaderboard-rank">#${row.rank}</span>
            <div class="leaderboard-entry">
              <span class="leaderboard-name">${displayName}</span>
              ${metadata ? `<span class="leaderboard-meta">${metadata}</span>` : ''}
            </div>
            <span class="leaderboard-time">${formatLapMs(row.bestLapMs)}</span>
          </div>
        `
      },
    )
    .join('')
}

const leaderboardDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatLeaderboardDate(timestamp) {
  const parsedTimestamp = Number(timestamp)
  if (!Number.isFinite(parsedTimestamp)) return ''

  const date = new Date(parsedTimestamp)
  if (Number.isNaN(date.getTime())) return ''

  return leaderboardDateFormatter.format(date)
}

function formatRoomLabel(roomId) {
  if (typeof roomId !== 'string' || !roomId.trim()) return ''
  return roomId.trim()
}

function renderLeaderboardError(container, message) {
  if (!container) return

  container.innerHTML = `<div class="leaderboard-empty">${message}</div>`
}

async function loadLeaderboards() {
  try {
    const leaderboard = await fetchLeaderboard(DEFAULT_TRACK_ID)
    renderLeaderboardList(allTimeLeaderboard, leaderboard)
  } catch (error) {
    renderLeaderboardError(allTimeLeaderboard, error.message)
  }
}

function getPrimaryButtonLabel() {
  if (roomSummary.loading) return 'Checking Room...'

  const currentRoomId = sanitizeRoomId(roomIdInputs[0]?.value ?? '')
  const hasPlayersInRoom =
    roomSummary.roomId === currentRoomId && roomSummary.activePlayerCount > 0

  return hasPlayersInRoom ? 'Join Race' : 'Start Race'
}

function renderPrimaryButton() {
  if (!startButton) return

  startButton.textContent = getPrimaryButtonLabel()
  if (roomSummary.loading) {
    startButton.disabled = true
  }
}

async function refreshRoomSummary(roomId) {
  if (!roomId) {
    roomSummary = {
      roomId: null,
      activePlayerCount: 0,
      joinable: true,
      loading: false,
    }
    clearRoomSummaryMessage()
    renderPrimaryButton()
    return
  }

  const lookupId = ++latestRoomLookupId
  roomSummary = {
    ...roomSummary,
    roomId,
    loading: true,
  }
  renderPrimaryButton()

  try {
    const summary = await fetchRoomSummary(roomId)
    if (lookupId !== latestRoomLookupId) return

    roomSummary = {
      roomId,
      activePlayerCount: summary.activePlayerCount ?? 0,
      joinable: summary.joinable !== false,
      loading: false,
    }

    if ((summary.activePlayerCount ?? 0) > 0) {
      setIdentityMessage(
        `${summary.activePlayerCount} player(s) already in ${roomId}. You can join them.`,
        'success',
        'room-summary',
      )
    } else {
      clearRoomSummaryMessage()
    }
  } catch {
    if (lookupId !== latestRoomLookupId) return

    roomSummary = {
      roomId,
      activePlayerCount: 0,
      joinable: true,
      loading: false,
    }
    clearRoomSummaryMessage()
  }

  renderPrimaryButton()
}

function scheduleRoomSummaryRefresh() {
  const roomId = sanitizeRoomId(roomIdInputs[0]?.value ?? '')

  if (roomLookupTimer) {
    window.clearTimeout(roomLookupTimer)
  }

  roomLookupTimer = window.setTimeout(() => {
    void refreshRoomSummary(roomId)
  }, ROOM_LOOKUP_DEBOUNCE_MS)
}

function persistIdentityFromUi() {
  const displayNameRaw = displayNameInputs[0]?.value ?? ''
  const roomIdRaw = roomIdInputs[0]?.value ?? ''
  const displayName = saveDisplayName(displayNameRaw)
  const roomId = saveRoomId(roomIdRaw)

  if (!displayName) {
    setIdentityMessage(
      'Use 3-20 characters with letters, numbers, spaces, - or _.',
      'error',
      'validation',
    )
    return null
  }

  if (!roomId) {
    setIdentityMessage(
      'Room IDs use lowercase letters, numbers, and dashes only.',
      'error',
      'validation',
    )
    return null
  }

  syncRoomIdWithUrl(roomId)
  syncStoredIdentityToUi()
  setIdentityMessage(`Saved ${displayName}. Connecting to ${roomId}...`, 'neutral', 'connect')
  multiplayer.refreshIdentity()

  return {
    ...getIdentitySnapshot(),
    displayName,
    roomId,
  }
}

function touchUserActivity() {
  lastUserInputAt = Date.now()
}

function disconnectFromRoom(reason = 'manual') {
  const { connectionStatus } = multiplayer.getState()
  if (connectionStatus === 'disconnected') return

  multiplayer.disconnect()
  renderRoomStatus()

  if (reason === 'idle') {
    setIdentityMessage(
      'Disconnected from the room after inactivity.',
      'neutral',
      'disconnect',
    )
  }
}

async function leaveRoomAndReturnHome() {
  const roomId = getCurrentRoomId()
  disconnectFromRoom('leave')
  gameScreenShown = false

  if (gamePromise) {
    const game = await gamePromise
    game.showHomeScreen()
  }

  void loadLeaderboards()
  setIdentityMessage(`Left ${roomId}.`, 'neutral', 'leave')
  scheduleRoomSummaryRefresh()
}

async function ensureGame() {
  const identity = getIdentitySnapshot()
  gamePromise ??= import('./game/runtime.js').then(({ createGame }) =>
    fetchPersonalBest(identity.anonymousPlayerId, DEFAULT_TRACK_ID)
      .catch(() => null)
      .then((personalBest) =>
        createGame({
          app,
          multiplayer,
          initialBestLapTime:
            Number.isFinite(personalBest?.bestLapMs) && personalBest.bestLapMs > 0
              ? personalBest.bestLapMs / 1000
              : null,
        }),
      ),
  )

  const game = await gamePromise
  await game.showGameScreen()
  gameScreenShown = true
  touchUserActivity()
  return game
}

function renderRoomStatus(state = multiplayer.getState()) {
  const identity = getIdentitySnapshot()
  const currentRoomId = sanitizeRoomId(roomIdInputs[0]?.value ?? '')
  if (
    identityMessageSource === 'room-summary' &&
    roomSummary.roomId &&
    roomSummary.roomId !== currentRoomId
  ) {
    clearRoomSummaryMessage()
  }
  const countdownSeconds =
    state.roomStatus === 'countdown' && state.countdownMs
      ? Math.max(
          0,
          Math.ceil(
            (state.countdownStartedAt + state.countdownMs - Date.now()) / 1000,
          ),
        )
      : null

  let statusText = ''
  let tone = 'neutral'
  if (state.connectionStatus === 'connecting') {
    statusText = `Connecting ${identity.displayName ?? 'player'} to ${state.roomId}...`
  } else if (state.lastError) {
    statusText = state.lastError
    tone = 'error'
  } else if (state.roomStatus === 'countdown') {
    statusText = `Countdown running in ${state.roomId}. Race starts in ${countdownSeconds}s.`
    tone = 'success'
  } else if (state.roomStatus === 'racing') {
    statusText = `Race live in ${state.roomId}. ${state.connectedPlayers.length} player(s) connected.`
    tone = 'success'
  } else if (state.roomStatus === 'finished') {
    statusText = `Race finished in ${state.roomId}. Start a new room for another round.`
    tone = 'success'
  } else if (state.connectionStatus === 'connected') {
    statusText = `Connected to ${state.roomId}. Waiting for the room countdown.`
  }

  if (roomStatusMessage) {
    roomStatusMessage.textContent = statusText
    roomStatusMessage.dataset.tone = tone
  }

  renderRoomShareControls(state)
  startButton.disabled = state.connectionStatus === 'connecting' || roomSummary.loading
  renderPrimaryButton()

  if (!playerList || !playerCount) {
    syncMobileHudOffset()
    return
  }

  const selfId = identity.anonymousPlayerId
  playerCount.textContent = String(state.connectedPlayers.length)

  if (!state.connectedPlayers.length) {
    playerList.innerHTML =
      state.connectionStatus === 'disconnected'
        ? '<div class="player-list-empty">Not connected to a room.</div>'
        : '<div class="player-list-empty">Nobody connected yet.</div>'
    syncMobileHudOffset()
    return
  }

  playerList.innerHTML = state.connectedPlayers
    .map((player) => {
      const suffix = player.anonymousPlayerId === selfId ? ' (you)' : ''
      const metaParts = []
      if (player.finishPlace != null) {
        metaParts.push(`P${player.finishPlace}`)
      }

      if (player.allTimeBestLapMs) {
        metaParts.push(`record ${formatLapMs(player.allTimeBestLapMs)}`)
      } else if (player.bestLapMs) {
        metaParts.push(`best ${formatLapMs(player.bestLapMs)}`)
      }

      const metaText = metaParts.join(' · ')

      return `
        <div class="player-row">
          <span class="player-name">${player.displayName}${suffix}</span>
          ${metaText ? `<span class="player-meta">${metaText}</span>` : ''}
        </div>
      `
    })
    .join('')
  syncMobileHudOffset()
}

async function handleStartRace() {
  const persistedIdentity = persistIdentityFromUi()
  if (!persistedIdentity) return

  await ensureGame()
  touchUserActivity()
  multiplayer.connect({
    roomId: persistedIdentity.roomId,
    trackId: DEFAULT_TRACK_ID,
  })
}

startButton.addEventListener('click', () => {
  void handleStartRace()
})

function canUseNativeShare(shareUrl) {
  return typeof navigator.share === 'function' && typeof shareUrl === 'string'
}

function getRoomShareButtonLabel(shareUrl = buildRoomShareUrl(getCurrentRoomId())) {
  return canUseNativeShare(shareUrl) ? 'Share Link' : 'Copy Link'
}

function syncRoomShareButtonLabel(shareUrl = buildRoomShareUrl(getCurrentRoomId())) {
  if (copyRoomButton) {
    copyRoomButton.textContent = getRoomShareButtonLabel(shareUrl)
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const fallbackInput = document.createElement('textarea')
  fallbackInput.value = text
  fallbackInput.setAttribute('readonly', '')
  fallbackInput.style.position = 'fixed'
  fallbackInput.style.opacity = '0'
  fallbackInput.style.pointerEvents = 'none'
  document.body.append(fallbackInput)
  fallbackInput.select()

  const copied = document.execCommand('copy')
  fallbackInput.remove()

  if (!copied) {
    throw new Error('clipboard_unavailable')
  }
}

roomIdShareInput?.addEventListener('focus', () => {
  roomIdShareInput.select()
})

roomIdShareInput?.addEventListener('click', () => {
  roomIdShareInput.select()
})

copyRoomButton?.addEventListener('click', async () => {
  const shareUrl = buildRoomShareUrl(getCurrentRoomId())
  if (!shareUrl) return

  try {
    if (canUseNativeShare(shareUrl)) {
      await navigator.share({
        title: 'Racebaan',
        text: `Join my room: ${getCurrentRoomId()}`,
        url: shareUrl,
      })
      copyRoomButton.textContent = 'Shared'
    } else {
      await copyTextToClipboard(shareUrl)
      copyRoomButton.textContent = 'Copied'
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      syncRoomShareButtonLabel(shareUrl)
      return
    }

    copyRoomButton.textContent = canUseNativeShare(shareUrl) ? 'Share Failed' : 'Copy Failed'
  }

  if (copyRoomResetTimer) {
    window.clearTimeout(copyRoomResetTimer)
  }

  copyRoomResetTimer = window.setTimeout(() => {
    syncRoomShareButtonLabel()
    copyRoomResetTimer = null
  }, 1500)
})

leaveRoomButton?.addEventListener('click', () => {
  void leaveRoomAndReturnHome()
})

for (const input of displayNameInputs) {
  input.addEventListener('input', () => {
    touchUserActivity()
    syncInputValues(input.value, displayNameInputs)
  })
}

for (const input of roomIdInputs) {
  input.addEventListener('input', () => {
    touchUserActivity()
    syncInputValues(input.value, roomIdInputs)
    clearRoomSummaryMessage()
    scheduleRoomSummaryRefresh()
  })
}

for (const eventName of [
  'keydown',
  'keyup',
  'pointerdown',
  'pointermove',
  'pointerup',
  'touchstart',
  'touchmove',
  'mousedown',
  'mousemove',
  'mouseup',
]) {
  window.addEventListener(eventName, touchUserActivity, { passive: true })
}

window.addEventListener('pagehide', () => {
  disconnectFromRoom('pagehide')
})

window.addEventListener('beforeunload', () => {
  disconnectFromRoom('beforeunload')
})

window.addEventListener('resize', syncMobileHudOffset)

multiplayer.subscribe((state) => {
  if (
    state.connectionStatus === 'connected' &&
    previousConnectionStatus !== 'connected'
  ) {
    setIdentityMessage(`Joined ${state.roomId}.`, 'success', 'joined')
  } else if (
    state.connectionStatus === 'error' &&
    state.lastError &&
    previousConnectionStatus !== 'error'
  ) {
    setIdentityMessage(state.lastError, 'error', 'connection-error')
  }

  previousConnectionStatus = state.connectionStatus
  renderRoomStatus(state)
  if (state.roomStatus === 'finished') {
    void loadLeaderboards()
  }
})

window.setInterval(() => {
  renderRoomStatus()
}, 250)

window.setInterval(() => {
  if (!gameScreenShown) return

  const { connectionStatus } = multiplayer.getState()
  if (connectionStatus !== 'connected' && connectionStatus !== 'connecting') return

  if (Date.now() - lastUserInputAt >= IDLE_DISCONNECT_MS) {
    disconnectFromRoom('idle')
  }
}, 15_000)

hydrateRoomIdFromUrl()
syncStoredIdentityToUi()
renderRoomShareControls()
syncRoomShareButtonLabel()
renderPrimaryButton()
scheduleRoomSummaryRefresh()
renderRoomStatus()
syncMobileHudOffset()
void loadLeaderboards()
