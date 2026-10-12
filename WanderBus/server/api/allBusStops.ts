export default defineEventHandler(async(event) => {
    const config = useRuntimeConfig(event)
    
    const busStops = await $fetch<{value: any[] }>('https://datamall2.mytransport.sg/ltaodataservice/BusStops',{
        headers: { AccountKey: config.ltaAccountKey, accept: 'application/json'}
    })
    return busStops.value
    
})