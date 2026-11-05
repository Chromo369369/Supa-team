// The solo adventure session (F1): starts when a ticket is torn on /home and lasts until the user ends it.
// Shared through useState and mirrored to sessionStorage, so it survives page changes and a reload in the tab.
// Call `useAdventure()` in <script setup>, then use the returned state and functions anywhere.
//   AdventureBar (layouts/default.vue) shows it on every page; AdventureEndDialog asks to save it on End.

const STORAGE_KEY = 'wb-adventure'

export interface AdventureTrip {
  starting_stop: string
  end_stop: string
  time_taken: number      // estimated minutes, the same as home.vue's saveTrip
  bus_taken: string | null
  starting_location?: string
  end_stop_code?: string  // the destination's BusStopCode, so the passport stamp can link to /stop/<code>
}

export interface AdventureSession {
  startedAt: number       // ms since epoch
  trip: AdventureTrip
  stopName: string
  bus: string | null
  saved: boolean
}

// one ticking interval for the whole app, and the End callbacks (functions can't live in useState)
let ticker: ReturnType<typeof setInterval> | null = null
const endCallbacks = new Set<() => void>()

function readStorage(): AdventureSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(value: AdventureSession | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // private window or blocked storage: the session still works until the tab reloads
  }
}

export const useAdventure = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  const session = useState<AdventureSession | null>('adventure-session', () => null)
  const elapsed = useState<number>('adventure-elapsed', () => 0)        // seconds since startedAt
  const endPrompt = useState<boolean>('adventure-end-prompt', () => false)
  const restored = useState<boolean>('adventure-restored', () => false)

  const active = computed(() => session.value !== null)

  function tick() {
    if (!session.value) return
    elapsed.value = Math.max(0, Math.floor((Date.now() - session.value.startedAt) / 1000))
  }

  function startTicker() {
    tick()
    if (ticker || !import.meta.client) return
    ticker = setInterval(tick, 1000)
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker)
    ticker = null
    elapsed.value = 0
  }

  // pick up a session left in this tab (the app is client-only, so this runs in the browser)
  if (import.meta.client && !restored.value) {
    restored.value = true
    const stored = readStorage()
    if (stored && typeof stored.startedAt === 'number' && stored.trip) {
      session.value = stored
      startTicker()
    }
  }

  function start(payload: { trip: AdventureTrip, stopName: string, bus: string | null }) {
    session.value = { startedAt: Date.now(), saved: false, ...payload }
    writeStorage(session.value)
    startTicker()
  }

  function markSaved() {
    if (!session.value) return
    session.value = { ...session.value, saved: true }
    writeStorage(session.value)
  }

  function end() {
    endPrompt.value = false
    session.value = null
    writeStorage(null)
    stopTicker()
    for (const cb of [...endCallbacks]) {
      try { cb() } catch (e) { console.error('[adventure] onEnd callback failed:', e) }
    }
  }

  // the same fields as home.vue's saveTrip, plus the optional notes, photo (a JPEG data URL from
  // utils/compressImage, the format passport.vue stores) and destination stop code. Throws when the insert fails.
  async function save(notes = '', photoDataUrl: string | null = null) {
    if (!session.value) throw new Error('No adventure to save.')
    const { trip } = session.value
    const row: Record<string, unknown> = {
      starting_stop: trip.starting_stop,
      end_stop: trip.end_stop,
      // KIV: real elapsed minutes could replace time_taken here, e.g. Math.max(1, Math.round(elapsed.value / 60))
      time_taken: trip.time_taken,
      bus_taken: trip.bus_taken,
      starting_location: trip.starting_location
    }
    if (trip.end_stop_code) row.end_stop_code = trip.end_stop_code
    if (notes.trim()) row.entry_notes = notes.trim()
    if (photoDataUrl) row.photo_url = photoDataUrl

    let { error } = await $supabase.from('passport_entries').insert(row)
    // end_stop_code comes from supabase/passport_stop_code.sql. Until that migration has run, PostgREST rejects
    // the unknown column ("Could not find the 'end_stop_code' column ..." / "column ... end_stop_code ...").
    // Retry once without it so the trip still saves; the stamp then falls back to matching end_stop by name.
    // This retry can go once the column exists everywhere.
    if (error && 'end_stop_code' in row && /end_stop_code/i.test(error.message) && /column/i.test(error.message)) {
      delete row.end_stop_code
      ;({ error } = await $supabase.from('passport_entries').insert(row))
    }
    if (error) throw new Error(error.message)
    markSaved()
  }

  // runs after end(); returns a function that unregisters it
  function onEnd(cb: () => void) {
    endCallbacks.add(cb)
    return () => { endCallbacks.delete(cb) }
  }

  return { session, active, elapsed, endPrompt, start, markSaved, end, save, onEnd }
}
