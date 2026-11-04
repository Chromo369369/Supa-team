const radius = 1000 //same 1 km as the spin filter
const maxPlaces = 50
const minPerCategory = 2 //per sub-filter, so food spots can't push out every park/museum
const spacing = 50 //metres, any closer and the pins sit on top of each other, so only one of them is kept
const firstSections = ['nature', 'heritage', 'art'] //ranked above food and shopping

export default defineEventHandler(async(event)=>{

    const code = getRouterParam(event, 'code')
    const allStops = await $fetch<any[]>('/api/allBusStops')
    const stop = allStops.find(s => s.BusStopCode == code)

    if (!stop) {
        throw createError({ statusCode: 404, statusMessage: 'Bus stop not found' })
    }

    // cached list of every place in Singapore (see /api/allPlaces), so this is instant
    const allPlaces = await $fetch<any[]>('/api/allPlaces')

    let nearby:any = {}

    for (let place of allPlaces){

        let distance = Math.round(distanceInMetres(stop.Latitude, stop.Longitude, place.lat, place.lon))

        // same "within 1 km" check as /api/allAmenities, so every place the spin counted shows up here too
        let amenitiesDistance = (Math.abs(place.lat - stop.Latitude) + Math.abs(place.lon - stop.Longitude)) * 111

        if (distance > radius && amenitiesDistance > 1) continue

        //same place can be mapped twice (a pin and a building outline), keep the closer one
        let placeKey = place.category + ':' + place.name.toLowerCase()

        if (placeKey in nearby && nearby[placeKey].distanceM <= distance) continue

        nearby[placeKey] = { ...place, distanceM: distance, walkMin: walkMinutes(distance) }

    }

    // ?prefer=cafe,museum is the feature 1 filter, turned into our sub-filters (museum -> museum + gallery)
    let picks = String(getQuery(event).prefer).split(',')
    let preferred = Object.entries(spinToSubcategories)
        .filter(([spinCategory]) => picks.includes(spinCategory))
        .flatMap(([, subs]) => subs)

    // when two places are too close, the one walked first is kept: the user's picks, then nature/heritage/art,
    // then food courts (so Whampoa Makan Place is kept and the stalls inside it are dropped), then everything else.
    // each group is shuffled, so which of two close places in the same group stays is random
    let shuffle = (list:any[]) => list.sort(() => Math.random() - 0.5)
    let candidates = Object.values<any>(nearby)

    let isPick = (place:any) => preferred.includes(place.category)
    let isFirst = (place:any) => !isPick(place) && firstSections.includes(place.section)
    let isFoodCourt = (place:any) => !isPick(place) && !isFirst(place) && place.subtype == 'Food court'

    let walkOrder = [
        ...shuffle(candidates.filter(isPick)),
        ...shuffle(candidates.filter(isFirst)),
        ...shuffle(candidates.filter(isFoodCourt)),
        ...shuffle(candidates.filter(place => !isPick(place) && !isFirst(place) && !isFoodCourt(place)))
    ]

    let places:any[] = []

    for (let place of walkOrder){

        // any category counts, a cafe and a restaurant in the same building would still be two pins on one spot
        let tooNear = places.some(kept => distanceInMetres(kept.lat, kept.lon, place.lat, place.lon) <= spacing)

        if (!tooNear) places.push(place)

    }

    places.sort((a, b) => a.distanceM - b.distanceM)

    // preferred sub-filters first, then nature/heritage/art, then food and shopping, closest first within each group
    let ranked = [
        ...places.filter(isPick),
        ...places.filter(isFirst),
        ...places.filter(place => !isPick(place) && !isFirst(place))
    ]

    // always keep the closest few of each sub-filter so every chip has something, then fill up in ranked order
    let kept = new Set()

    for (let category of Object.keys(placeSubcategories)){
        places.filter(place => place.category == category).slice(0, minPerCategory).forEach(place => kept.add(place))
    }

    for (let place of ranked){
        if (kept.size >= maxPlaces) break
        kept.add(place)
    }

    return {
        stop: {
            code: code,
            name: stop.Description,
            road: stop.RoadName,
            lat: stop.Latitude,
            lon: stop.Longitude
        },
        radius: radius,
        preferred: preferred,
        places: ranked
            .filter(place => kept.has(place))
            .map(place => ({ ...place, preferred: preferred.includes(place.category) }))
    }
})
