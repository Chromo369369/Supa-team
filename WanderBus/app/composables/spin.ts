export async function spin(preferences:any,selectedPlace:any,travelTime:any){
    const possibleStops = ref({})
    const chosenStop :any= ref('')
    const stopDetails = ref('')
    const startDetails = ref('')
    const errorMessage = ref('')
    const [busStops, allRoutes, amenStops] :any= await Promise.all([
        $fetch('/api/allBusStops'),
        $fetch('/api/allRoutes'),
        $fetch('/api/allAmenities')
    ])
    let starts:any = filterStartingBusStops(travelTime, busStops, selectedPlace)
    const startingStops:any = ref(starts)

    try{

    
    let now = Date.now() / 60000
    let arrivals :any= {}
    // ask LTA for every starting stop at the same time instead of one by one (40 stops took ~10s in a row)
    let stopCodes = Object.keys(starts)
    let allArrivals = await Promise.all(stopCodes.map(stopCode => $fetch('/api/busArrivals', { query: { value: stopCode } })))
    for (let [index, stopCode] of stopCodes.entries()) {
        let busArrivals:any = allArrivals[index]
        arrivals[stopCode] = {}
        let timeAtStop = now + starts[stopCode]
        for (let bus of busArrivals.Services || []) {
            if (!bus.NextBus?.EstimatedArrival) continue
            let arrival1 = new Date(bus.NextBus.EstimatedArrival).getTime() / 60000
            let arrival2 = new Date(bus.NextBus2?.EstimatedArrival).getTime() / 60000
            let arrival3 = new Date(bus.NextBus3?.EstimatedArrival).getTime() / 60000
            
            if (timeAtStop <= arrival1) {
                arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival1 - now))
            } else if (timeAtStop <= arrival2) {
                arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival2 - now))
            } else if (timeAtStop <= arrival3) {
                arrivals[stopCode][bus.ServiceNo] = Math.ceil((arrival3 - now))
            }
        }
    }
        possibleStops.value = filterBusStops(arrivals, travelTime, allRoutes, starts)
        possibleStops.value = filterByAmens(preferences, possibleStops.value, amenStops)
        chosenStop.value = chooseStop(possibleStops.value)
        stopDetails.value = busStops.find((stop:any) => stop.BusStopCode === chosenStop.value.destination)
        startDetails.value = busStops.find((stop:any) => stop.BusStopCode === chosenStop.value.chosen.boardAt)
    }catch(e){
                errorMessage.value = typeof e === 'string' ? e : 'Something went wrong, please try again.'

    }
    console.log('success')
    return {
        errorMessage,
        startDetails,
        stopDetails,
        chosenStop,
        possibleStops,
        startingStops
    }
}