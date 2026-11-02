export default defineCachedEventHandler(async(event)=>{

    const code = getRouterParam(event, 'code')
    const allStops = await $fetch<any[]>('/api/allBusStops')
    const stop = allStops.find(s => s.BusStopCode == code)
    const radius = 800 //metres, roughly a 10 min walk

    let around = `(around:${radius},${stop.Latitude},${stop.Longitude})`
    let overpassQuery = `[out:json][timeout:25];(`

    for (let osmTags of Object.values(placeCategories)){

        for (let osmTag of osmTags){

            let [tagKey, tagValue] = osmTag.split('=')

            if (tagValue == '*'){
                overpassQuery += `nwr${around}["${tagKey}"];`
            } else {
                overpassQuery += `nwr${around}["${tagKey}"="${tagValue}"];`
            }

        }

        }

    overpassQuery += `);out center tags;`

    const allPlaces = await $fetch<{elements: any[]}>('https://overpass-api.de/api/interpreter',{
        headers: { 'User-Agent': 'WanderBus/1.0 (student project)' },
        method:`POST`,
        body: new URLSearchParams({ data: overpassQuery})
    })



    const worship: any = { muslim: 'Mosque', hindu: 'Temple', buddhist: 'Temple', taoist: 'Temple', christian: 'Church', sikh: 'Gurdwara', jewish: 'Synagogue' }

    let places: any = {}

    for (let place of allPlaces.elements){

        let name = place.tags['name:en'] ?? place.tags.name
        if (!name) continue

        // first category whose tag matches this place (priority based on order in placeCategories - food,nature,heritage,art)
        let category = ''
        let subtype = ''
        for (let [categoryName, osmTags] of Object.entries(placeCategories)){
            for (let osmTag of osmTags){
                let [tagKey, tagValue] = osmTag.split('=')
                if (tagKey && category == '' && place.tags[tagKey] && (tagValue == '*' || place.tags[tagKey] == tagValue)){
                    category = categoryName
                    subtype = place.tags[tagKey]
                }
            }
        }

        if (subtype == 'place_of_worship') {subtype = worship[place.tags.religion] ?? 'Place of worship'}
        if (subtype == 'yes') {subtype = 'Historic site'}
        subtype = subtype.replace(/_/g, ' ')
        subtype = subtype.charAt(0).toUpperCase() + subtype.slice(1)

        let lat = place.lat ?? place.center.lat
        let lon = place.lon ?? place.center.lon
        let distance = Math.round(distanceInMetres(stop.Latitude, stop.Longitude, lat, lon))

        //same place can be mapped twice (a pin and a building outline), keep the closer one
        let placeKey = category + ':' + name.toLowerCase()
        if (placeKey in places && places[placeKey].distanceM <= distance) continue

        places[placeKey] = {
            id: `osm:${place.type}/${place.id}`,
            name: name,
            category: category,
            subtype: subtype,
            lat: lat,
            lon: lon,
            distanceM: distance,
            walkMin: walkMinutes(distance),
            source: 'osm'
        }
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
        places: Object.values(places).sort((a: any, b: any) => a.distanceM - b.distanceM)
    }
},{maxAge: 60*60*24*7})
