export default defineCachedEventHandler(async(event) => {
    const config = useRuntimeConfig(event)
    let allStops:any[] = []
    let skip = 0
    while (true) {
        const busStops = await $fetch<{value: any[] }>(`https://datamall2.mytransport.sg/ltaodataservice/BusStops?$skip=${skip}`,{
            headers: { AccountKey: config.public.ltaAccountKey, accept: 'application/json'}
        })
        allStops.push(...busStops.value)
        if (busStops.value.length < 500) break   // fewer than 500 = last page
        skip += 500
    }
    return allStops
    
},{maxAge: 60*60*24})