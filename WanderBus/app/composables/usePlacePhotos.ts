// Community photos for places around a stop (tables + bucket are set up in supabase/place_photos.sql)
// Call `usePlacePhotos()` in <script setup>, then use the returned functions anywhere.

const BUCKET = 'place-photos'

export const usePlacePhotos = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // place id -> photos (newest first), each with a public url
  const photosByPlace = ref<Record<string, any[]>>({})
  const loadError = ref('')   // set when the photos couldn't be loaded, so the page can show it with a Retry

async function withUrl(row: any) {
  const { data, error } = await $supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.path, 3600)

  if (error) {
    console.error('Error loading photo:', error.message)
    return { ...row, url: null }
  }

  return { ...row, url: data.signedUrl }
}

  // every photo inside the box around the walking circle, in one query
  async function loadPhotosNear(stop: { lat: number, lon: number }, radiusM: number) {
    loadError.value = ''
    const dLat = radiusM / 111320
    const dLon = radiusM / (111320 * Math.cos(stop.lat * Math.PI / 180))
    const { data, error } = await $supabase
      .from('place_photos')
      .select('id, place_id, path, is_pioneer, created_at, status')
      .eq('status', 'approved')
      .gte('lat', stop.lat - dLat).lte('lat', stop.lat + dLat)
      .gte('lon', stop.lon - dLon).lte('lon', stop.lon + dLon)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[place photos] load failed:', error.message)
      loadError.value = error.message
      return
    }
    const grouped: Record<string, any[]> = {}
    for (const row of data) {
      if (row.place_id in grouped == false) grouped[row.place_id] = []
      grouped[row.place_id]!.push(withUrl(row))
    }
    photosByPlace.value = grouped
  }

  // upload the file, then add the row. The database decides if it's the Pioneer photo.
  // the bucket itself only takes images up to 5 MB, and the page is behind the auth middleware
  async function uploadPhoto(file: File, place: any, stopCode: string) {
    const { data: auth } = await $supabase.auth.getUser()

    // storage policy only allows uploads into <user id>/...
    const ext = file.name.split('.').pop()!.toLowerCase()
    const safePlaceId = place.id.replace(/[^a-zA-Z0-9]/g, '-')
    const path = `${auth.user!.id}/${safePlaceId}/${Date.now()}.${ext}`

    const upload = await $supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (upload.error) throw new Error(upload.error.message)

  const { error } = await $supabase
    .from('place_photos')
    .insert({
      place_id: place.id,
      place_name: place.name,
      stop_code: stopCode,
      lat: place.lat,
      lon: place.lon,
      path,
      status: 'pending'
    })

    if (error) {
      // don't leave an orphan file behind if the row was rejected (e.g. daily limit)
      await $supabase.storage.from(BUCKET).remove([path])
      throw new Error(error.message)
    }

    return { status: 'pending' }
  }

  return { photosByPlace, loadError, loadPhotosNear, uploadPhoto }
}
