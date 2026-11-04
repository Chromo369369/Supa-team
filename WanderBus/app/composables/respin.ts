export function reroll(response:any,possibleStops:any) {
    let chosenStop = chooseStop(possibleStops)
    let stopDetails = response.find(stop => stop.BusStopCode === chosenStop.destination)
    let startDetails = response.find(stop => stop.BusStopCode === chosenStop.chosen.boardAt)
    
    return {
        chosenStop,
        stopDetails,
        startDetails
    }
}