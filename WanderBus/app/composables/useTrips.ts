// Shared passport state + Supabase persistence.
// Call `useTrips()` in <script setup> (NOT inside a later async callback),
// then use the returned functions anywhere.

export type Trip = {
  id: string | number
  date: string
  busService: string
  busStop: { code: string; name: string }
  memories: string
  photoLink: string
  isPublic: boolean
}

type NewTrip = Omit<Trip, 'id'>

const TABLE = 'trips'

// DB row (snake_case) -> app shape (camelCase)
const fromRow = (r: any): Trip => ({
  id: r.id,
  date: r.trip_date,
  busService: r.bus_service ?? '',
  busStop: { code: r.bus_stop_code ?? '', name: r.bus_stop_name ?? '' },
  memories: r.memories ?? '',
  photoLink: r.photo_link ?? '',
  isPublic: !!r.is_public
})

export const useTrips = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()
  const trips = useState<Trip[]>('savedTrips', () => [])

  // Load this user's trips (RLS makes sure it's only their own rows)
  async function loadTrips() {
    const { data, error } = await $supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[passport] load failed:', error.message)
      return error.message
    }
    trips.value = (data ?? []).map(fromRow)
    return null
  }

  // Add a trip. Always shows up in the passport; if the DB save fails
  // it is kept locally for this session and the error is logged.
  async function addTrip(trip: NewTrip) {
    const { data, error } = await $supabase
      .from(TABLE)
      .insert({
        trip_date: trip.date,
        bus_service: trip.busService,
        bus_stop_code: trip.busStop.code,
        bus_stop_name: trip.busStop.name,
        memories: trip.memories,
        photo_link: trip.photoLink,
        is_public: trip.isPublic
      })
      .select()
      .single()

    if (error || !data) {
      console.error('[passport] save failed:', error?.message)
      trips.value = [{ ...trip, id: `local-${Date.now()}` }, ...trips.value]
      return error?.message ?? 'Save failed'
    }
    trips.value = [fromRow(data), ...trips.value]
    return null
  }

  async function updateTrip(id: Trip['id'], patch: Partial<NewTrip>) {
    trips.value = trips.value.map(t => (t.id === id ? { ...t, ...patch } : t))
    if (String(id).startsWith('local-')) return null
    const row: any = {}
    if (patch.date !== undefined) row.trip_date = patch.date
    if (patch.memories !== undefined) row.memories = patch.memories
    if (patch.photoLink !== undefined) row.photo_link = patch.photoLink
    if (patch.isPublic !== undefined) row.is_public = patch.isPublic
    const { error } = await $supabase.from(TABLE).update(row).eq('id', id)
    if (error) console.error('[passport] update failed:', error.message)
    return error?.message ?? null
  }

  async function removeTrip(id: Trip['id']) {
    trips.value = trips.value.filter(t => t.id !== id)
    if (String(id).startsWith('local-')) return null
    const { error } = await $supabase.from(TABLE).delete().eq('id', id)
    if (error) console.error('[passport] delete failed:', error.message)
    return error?.message ?? null
  }

  return { trips, loadTrips, addTrip, updateTrip, removeTrip }
}
