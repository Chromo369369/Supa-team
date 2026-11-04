// every named place in Singapore for the "around this stop" sub-filters, cached for 7 days.
// /api/stops/[code]/places picks the ones near a stop from this list, so it never waits on overpass itself
export default defineCachedEventHandler(async(event)=>{

    // tags grouped by key (amenity -> cafe|restaurant|...), so overpass scans Singapore once per key
    let valuesByKey:any = {}
    for (let subcategory of Object.values(placeSubcategories)){
        for (let tag of subcategory.tags){
            let [key, value] = tag.split('=') as [string, string]
            if (key in valuesByKey == false){
                valuesByKey[key] = []
            }
            valuesByKey[key].push(value)
        }
    }

    // a box around Singapore is faster than the country border, each stop only keeps places within 1 km anyway
    let overpassQuery = `[out:json][timeout:180][bbox:1.16,103.59,1.48,104.09];(`
    for (let [key, values] of Object.entries<string[]>(valuesByKey)){
        if (values.includes('*')){
            overpassQuery += `nwr["${key}"]["name"];`
        } else {
            overpassQuery += `nwr["${key}"~"^(${values.join('|')})$"]["name"];`
        }
    }
    overpassQuery += `);out center;`

    const allPlaces = await $fetch<{elements: any[], remark: string}>('https://overpass-api.de/api/interpreter',{
        headers: { 'User-Agent': 'WanderBus/1.0 (student project)' },
        method:`POST`,
        body: new URLSearchParams({ data: overpassQuery})
    })

    // overpass still answers 200 when it times out, just with a remark and half the places.
    // throwing keeps that out of the cache, so the last full list is served until a refetch works
    if (allPlaces.remark){
        throw createError({ statusCode: 503, statusMessage: allPlaces.remark })
    }

    const worship:any = { muslim: 'Mosque', hindu: 'Temple', buddhist: 'Temple', taoist: 'Temple', christian: 'Church', sikh: 'Gurdwara', jewish: 'Synagogue' }
    let final:any[] = []

    //assigning a sub-filter to each place, last match wins like allAmenities
    for (let place of allPlaces.elements){
        let category = ''
        let subtype = ''
        for (let [sub, subcategory] of Object.entries(placeSubcategories)){
            for (let tag of subcategory.tags){
                let [key, value] = tag.split('=') as [string, string]
                if (place.tags[key] && (value == '*' || place.tags[key] == value)){
                    category = sub
                    subtype = place.tags[key]
                }
            }
        }

        // the tag value is shown under the name, e.g. fast_food -> Fast food
        if (subtype == 'place_of_worship') {subtype = worship[place.tags.religion] || 'Place of worship'}
        if (subtype == 'yes') {subtype = 'Historic site'}
        subtype = subtype.replace(/_/g, ' ')
        subtype = subtype.charAt(0).toUpperCase() + subtype.slice(1)

        final.push({
            id: `osm:${place.type}/${place.id}`,
            name: place.tags['name:en'] || place.tags.name,
            category: category,
            section: placeSubcategories[category]!.section,
            subtype: subtype,
            lat: place.lat ?? place.center.lat,
            lon: place.lon ?? place.center.lon
        })
    }

    return final
},{maxAge: 60*60*24*7})
