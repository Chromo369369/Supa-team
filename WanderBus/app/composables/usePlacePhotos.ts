// Community photos for places around a stop (tables + bucket are set up in supabase/place_photos.sql)
// Call `usePlacePhotos()` in <script setup>, then use the returned functions anywhere.

const BUCKET = 'place-photos'

export const usePlacePhotos = () => {
  // grab the client now, while the Nuxt context is available
  const { $supabase } = useNuxtApp()

  // place id -> photos (newest first), each with a public url
  const photosByPlace = ref<Record<string, any[]>>({})

  function withUrl(row: any) {
    const { data } = $supabase.storage.from(BUCKET).getPublicUrl(row.path)
    return { ...row, url: data.publicUrl }
  }

  // every photo inside the box around the walking circle, in one query
  async function loadPhotosNear(stop: { lat: number, lon: number }, radiusM: number) {
    const dLat = radiusM / 111320
    const dLon = radiusM / (111320 * Math.cos(stop.lat * Math.PI / 180))
    const { data, error } = await $supabase
      .from('place_photos')
      .select('id, place_id, path, is_pioneer, created_at')
      .gte('lat', stop.lat - dLat).lte('lat', stop.lat + dLat)
      .gte('lon', stop.lon - dLon).lte('lon', stop.lon + dLon)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[place photos] load failed:', error.message)
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

    const { data, error } = await $supabase
      .from('place_photos')
      .insert({
        place_id: place.id,
        place_name: place.name,
        stop_code: stopCode,
        lat: place.lat,
        lon: place.lon,
        path
      })
      .select('id, place_id, path, is_pioneer, created_at')
      .single()

    if (error) {
      // don't leave an orphan file behind if the row was rejected (e.g. daily limit)
      await $supabase.storage.from(BUCKET).remove([path])
      throw new Error(error.message)
    }

    const photo = withUrl(data)
    photosByPlace.value = { ...photosByPlace.value, [place.id]: [photo, ...(photosByPlace.value[place.id] || [])] }
    return photo
  }

  return { photosByPlace, loadPhotosNear, uploadPhoto }
}
