export async function spin(preferences:any,selectedPlace:any,travelTime:any){
    const possibleStops = ref({})
    const chosenStop = ref('')
    const stopDetails = ref('')
    const startDetails = ref('')
    const errorMessage = ref('')
    const amenStops = await useFetch('/api/allAmenities')
    const response = await useFetch('/api/allBusStops')
    const allRoutes = await useFetch('/api/allRoutes')
    let starts = filterStartingBusStops(travelTime.value, response.data.value, selectedPlace.value)
    const startingStops = ref(starts)
    let now = Date.now() / 60000
    let arrivals = {}
    // ask LTA for every starting stop at the same time instead of one by one (40 stops took ~10s in a row)
    let stopCodes = Object.keys(starts)
    let allArrivals = await Promise.all(stopCodes.map(stopCode => $fetch('/api/busArrivals', { query: { value: stopCode } })))
    for (let [index, stopCode] of stopCodes.entries()) {
        let busArrivals = allArrivals[index]
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
    possibleStops.value = filterBusStops(arrivals, travelTime.value, allRoutes.data.value, starts)
    possibleStops.value = filterByAmens(preferences.value, possibleStops.value, amenStops.data.value)
    chosenStop.value = chooseStop(possibleStops.value)
    stopDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.destination)
    startDetails.value = response.data.value.find(stop => stop.BusStopCode === chosenStop.value.chosen.boardAt)
}