export function chooseStop(possibleStops:any){
    let stopCount: any = Object.keys(possibleStops).length
    if (stopCount == 0){
        throw 'No stops found, try a longer travel time'
    }
    let chosen: any = Math.floor(Math.random()*stopCount)
    let final = Object.keys(possibleStops)[chosen]
    if (final === undefined) {
        throw 'No stops found, try a longer travel time'
    }
    return {
        destination: final,
        chosen: possibleStops[final]
}}