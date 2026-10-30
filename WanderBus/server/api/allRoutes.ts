export default defineCachedEventHandler(async(event) => {
    const config = useRuntimeConfig(event)
    let allRoutes:any[] = []
    let skip = 0
    while (true) {
        const routes = await $fetch<{value: any[] }>(`https://datamall2.mytransport.sg/ltaodataservice/BusRoutes?$skip=${skip}`,{
            headers: { AccountKey: config.public.ltaAccountKey, accept: 'application/json'}
        })
        allRoutes.push(...routes.value)
        if (routes.value.length < 500) break   // fewer than 500 = last page
        skip += 500
    }
    return allRoutes
    
},{maxAge: 60*60*24})