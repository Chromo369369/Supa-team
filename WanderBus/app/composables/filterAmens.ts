export function filterByAmens(preferences:any,stops:any,amenStops:any){
    let final:any = {}
    if (preferences.length === 0){
        return stops
    }
    for (let stop of Object.keys(stops)){
        if (!(stop in amenStops)){
            continue
        }
        for (let amens of Object.keys(amenStops[stop])){
            if (preferences.includes(amens)){
                final[stop] = stops[stop]
                break
            }
        }
    }
    if (Object.keys(final).length == 0){
        throw 'No stops with preferred activities in range, try a longer travel time or widen your preferences!'
    }
    return final


}