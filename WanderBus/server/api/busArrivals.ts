export default defineEventHandler(async(event) => {
    const config = useRuntimeConfig(event)
    const stopCode = getQuery(event).value
    
    const arrivals = await $fetch<{found: number,results: any[] }>(`https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${stopCode}`,{
            headers: { AccountKey: config.public.ltaKey, accept: 'application/json'}
    })
    return arrivals
    
})