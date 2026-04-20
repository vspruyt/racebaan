import {
  LAP_RECORD_MATCH_EPSILON,
  LAP_RECORD_STORAGE_KEY,
  MAX_VISIBLE_LAP_TIMERS,
} from '../constants.js'
import { formatLapTime } from '../lib/utils.js'

function shouldUseCompactLapTimerLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
}

export function loadStoredBestLapTime() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const storedValue = window.localStorage.getItem(LAP_RECORD_STORAGE_KEY)

    if (!storedValue) {
      return null
    }

    const parsedValue = Number.parseFloat(storedValue)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
  } catch {
    return null
  }
}

export function createLapSystem({ raceState, lapTimers }) {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      renderLapTimerList()
    })
  }

  function storeBestLapTime(bestLapTime) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    try {
      window.localStorage.setItem(LAP_RECORD_STORAGE_KEY, String(bestLapTime))
    } catch {
      // Ignore storage failures so gameplay keeps working in private mode or strict browsers.
    }
  }

  function createLapTimerEntry(lapNumber) {
    const card = document.createElement('div')
    card.className = 'lap-timer is-active'
    card.setAttribute('aria-atomic', 'true')

    const header = document.createElement('div')
    header.className = 'lap-timer-header'

    const label = document.createElement('span')
    label.className = 'speedometer-label'
    label.textContent = `Lap ${lapNumber}`

    const status = document.createElement('span')
    status.className = 'lap-timer-status'

    const readout = document.createElement('div')
    readout.className = 'lap-timer-readout'

    const value = document.createElement('span')
    value.className = 'lap-timer-value'

    header.append(label, status)
    readout.append(value)
    card.append(header, readout)

    return {
      lapNumber,
      elapsed: 0,
      completed: false,
      isRecord: false,
      node: card,
      statusNode: status,
      valueNode: value,
    }
  }

  function createStoredRecordLapTimerEntry() {
    const card = document.createElement('div')
    card.className = 'lap-timer is-complete is-record'
    card.setAttribute('aria-atomic', 'true')

    const header = document.createElement('div')
    header.className = 'lap-timer-header'

    const label = document.createElement('span')
    label.className = 'speedometer-label'
    label.textContent = 'Record'

    const status = document.createElement('span')
    status.className = 'lap-timer-status'
    status.textContent = 'Saved'

    const readout = document.createElement('div')
    readout.className = 'lap-timer-readout'

    const value = document.createElement('span')
    value.className = 'lap-timer-value'

    header.append(label, status)
    readout.append(value)
    card.append(header, readout)

    return {
      node: card,
      valueNode: value,
    }
  }

  const storedRecordLapTimerEntry = createStoredRecordLapTimerEntry()

  function syncStoredRecordLapTimerEntry() {
    if (Number.isFinite(raceState.bestLapTime)) {
      storedRecordLapTimerEntry.valueNode.textContent = formatLapTime(raceState.bestLapTime)
      return
    }

    storedRecordLapTimerEntry.valueNode.textContent = ''
  }

  function setBestLapTime(bestLapTime) {
    if (!Number.isFinite(bestLapTime) || bestLapTime <= 0) {
      return false
    }

    if (
      Number.isFinite(raceState.bestLapTime) &&
      bestLapTime >= raceState.bestLapTime - LAP_RECORD_MATCH_EPSILON
    ) {
      return false
    }

    raceState.bestLapTime = bestLapTime
    storeBestLapTime(bestLapTime)
    syncStoredRecordLapTimerEntry()
    return true
  }

  function isLapEntryMirroredByStoredRecord(entry) {
    return (
      entry.completed &&
      Number.isFinite(raceState.bestLapTime) &&
      Math.abs(entry.elapsed - raceState.bestLapTime) <= LAP_RECORD_MATCH_EPSILON
    )
  }

  function syncLapTimerEntry(entry) {
    entry.statusNode.textContent = entry.isRecord
      ? 'Record'
      : entry.completed
        ? 'Finished'
        : 'Current'
    entry.valueNode.textContent = formatLapTime(entry.elapsed)
    entry.node.classList.toggle('is-active', !entry.completed)
    entry.node.classList.toggle('is-complete', entry.completed)
    entry.node.classList.toggle('is-record', entry.isRecord)
  }

  function renderLapTimerList() {
    const nodes = []

    if (Number.isFinite(raceState.bestLapTime)) {
      syncStoredRecordLapTimerEntry()
      nodes.push(storedRecordLapTimerEntry.node)
    }

    const visibleLapEntries = shouldUseCompactLapTimerLayout()
      ? raceState.laps.filter((entry) => !entry.isRecord).slice(-2)
      : raceState.laps.filter((entry) => !entry.isRecord)

    for (const entry of visibleLapEntries) {
      if (!entry.isRecord) {
        nodes.push(entry.node)
      }
    }

    lapTimers.replaceChildren(...nodes)
  }

  function refreshLapTimerRecordState() {
    for (const entry of raceState.laps) {
      entry.isRecord = isLapEntryMirroredByStoredRecord(entry)
      syncLapTimerEntry(entry)
    }

    renderLapTimerList()
  }

  function trimLapTimerEntries() {
    const getVisibleLapTimerCount = () =>
      raceState.laps.reduce(
        (count, entry) => count + (isLapEntryMirroredByStoredRecord(entry) ? 0 : 1),
        0,
      )

    while (getVisibleLapTimerCount() > MAX_VISIBLE_LAP_TIMERS) {
      let slowestLapIndex = -1

      for (let index = 0; index < raceState.laps.length; index += 1) {
        const entry = raceState.laps[index]

        if (!entry.completed || isLapEntryMirroredByStoredRecord(entry)) continue

        if (
          slowestLapIndex === -1 ||
          entry.elapsed > raceState.laps[slowestLapIndex].elapsed
        ) {
          slowestLapIndex = index
        }
      }

      let removalIndex = slowestLapIndex

      if (removalIndex === -1) {
        removalIndex = raceState.laps.findIndex(
          (entry) => !isLapEntryMirroredByStoredRecord(entry),
        )
      }

      if (removalIndex === -1) {
        break
      }

      const [removedEntry] = raceState.laps.splice(removalIndex, 1)
      removedEntry.node.remove()
    }

    refreshLapTimerRecordState()
  }

  function appendLapTimerEntry() {
    const entry = createLapTimerEntry(raceState.nextLapNumber)
    raceState.nextLapNumber += 1
    raceState.laps.push(entry)
    trimLapTimerEntries()
    return entry
  }

  function getCurrentLapEntry() {
    for (let index = raceState.laps.length - 1; index >= 0; index -= 1) {
      if (!raceState.laps[index].completed) {
        return raceState.laps[index]
      }
    }

    return null
  }

  function resetLapTimers() {
    raceState.laps = []
    raceState.nextLapNumber = 1
    appendLapTimerEntry()
  }

  function completeCurrentLap() {
    const currentLapEntry = getCurrentLapEntry()

    if (!currentLapEntry) {
      return { isNewRecord: false, lapNumber: null, lapSeconds: null, raceSeconds: null }
    }

    const isNewRecord =
      !Number.isFinite(raceState.bestLapTime) ||
      currentLapEntry.elapsed < raceState.bestLapTime - LAP_RECORD_MATCH_EPSILON

    currentLapEntry.completed = true

    if (isNewRecord) {
      setBestLapTime(currentLapEntry.elapsed)
    }

    appendLapTimerEntry()

    const raceSeconds = raceState.laps.reduce(
      (total, entry) => total + (entry.completed ? entry.elapsed : 0),
      0,
    )

    return {
      isNewRecord,
      lapNumber: currentLapEntry.lapNumber,
      lapSeconds: currentLapEntry.elapsed,
      raceSeconds,
    }
  }

  function advanceLapTimer(delta) {
    if (raceState.mode !== 'racing') return

    const currentLapEntry = getCurrentLapEntry()

    if (!currentLapEntry) return

    currentLapEntry.elapsed += delta
    syncLapTimerEntry(currentLapEntry)
  }

  function getCurrentLapNumber() {
    return getCurrentLapEntry()?.lapNumber ?? raceState.nextLapNumber
  }

  return {
    advanceLapTimer,
    completeCurrentLap,
    getCurrentLapNumber,
    resetLapTimers,
  }
}
