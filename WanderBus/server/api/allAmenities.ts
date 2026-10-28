export default defineCachedEventHandler(async(event)=>{
    const allStops = await $fetch('/api/allBusStops')
    let final:any = {}
    let overpassQuery = `[out:json][timeout:120];area["ISO3166-1"="SG"][admin_level=2]->.sg;(`
    for (let tags of Object.values(categories)){
        for (let tag of tags){
            let [key, value] = tag.split('=')
            overpassQuery += `nwr["${key}"="${value}"](area.sg);`
        }
        }
    overpassQuery += `);out center;`
    
    const allAmenities = await $fetch<{elements: any[]}>('https://overpass-api.de/api/interpreter',{
        headers: { 'User-Agent': 'WanderBus/1.0 (student project)' },
        method:`POST`,
        body: new URLSearchParams({ data: overpassQuery})
    })

    //assigning tags to each bus stop
    
    for (let amen of allAmenities.elements){
        let category = ''
        for (let [cat, tags] of Object.entries(categories)){
            for (let tag of tags){
                let [key,value] = tag.split('=')
                if (key && amen.tags[key] == value){
                    category = cat
                }
            }
        }
        
        let lat = amen.lat ?? amen.center.lat
        let lon = amen.lon ?? amen.center.lon
        for (let stop of allStops){
            let length = Math.abs(lat - stop.Latitude)
            let height = Math.abs(lon - stop.Longitude)
            let distance = (length + height) * 111
                if (distance <= 1) {
                    if(stop.BusStopCode in final == false){
                        final[stop.BusStopCode] = {}
                    }
                    
                    if(category in final[stop.BusStopCode]==false){
                        final[stop.BusStopCode][category] = []
                    }
                    if(!final[stop.BusStopCode][category].includes(amen.tags.name) && amen.tags.name){
                        final[stop.BusStopCode][category].push(amen.tags.name)
                    }
                
                }}}
    return final
},{maxAge: 60*60*24*7})