// overpass takes ~1 min for all of Singapore, so fill the /api/allPlaces cache as soon as the server starts
// instead of making the first person on a stop page wait. Once it's cached, the old list keeps being served
// while it refreshes in the background, so stop pages load straight from the cache
export default defineNitroPlugin(() => {
    $fetch('/api/allPlaces').catch(error => console.error('[allPlaces] warm-up failed:', error.message))
})
