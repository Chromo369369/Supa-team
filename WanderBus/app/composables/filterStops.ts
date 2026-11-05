export function filterStartingBusStops(travel: any,busStops: any,start: any){
        let final:any={}
        let minTime = Math.min(travel,10) //in minutes
        let maxWalk = (1/12) * minTime //in km
        for (let bstop of busStops){
            let length = Math.abs(bstop.Latitude - start.LATITUDE)
            let height = Math.abs(bstop.Longitude - start.LONGITUDE)
            let distance = (length + height) * 111
            if (distance <= maxWalk){
                final[bstop.BusStopCode] = distance * 12
            } 
        }
        return final
    }

export function filterBusStops(arrivals: any, travel:any, allRoutes: any, starts:any){
    let final: any = {}
    for (let stop in starts){
        final[stop] = {
            boardAt: stop,
            bus: null,
            stops:0,
            totalTime: starts[stop]
        }
    }
    
    for (let stopCode of Object.keys(arrivals)){ //Iterate through each bus of each stop code and trace their route to add bus stops until max time reached
        
        for (let i = 0; i< allRoutes.length; i++){
            if (allRoutes[i].BusStopCode == stopCode){
                let currentBus = allRoutes[i].ServiceNo
                let currentDist = allRoutes[i].Distance
                let j = i + 1
                let currentDir = allRoutes[i].Direction
                while (j < allRoutes.length && allRoutes[j].ServiceNo == currentBus && allRoutes[j].Direction == currentDir){
                    let newDist = allRoutes[j].Distance
                    if (!newDist){
                        j += 1
                        continue
                    }
                    let diff = newDist - currentDist
                    let timeTravelled = (diff/15) * 60 //Assumes bus average speed to be 15km/hr, then estimates time taken to drive to that stop
                    if (arrivals[stopCode][allRoutes[i].ServiceNo] + timeTravelled <= travel){
                        if (allRoutes[j].BusStopCode in final){
                            let oldTime = final[allRoutes[j].BusStopCode].totalTime
                            let newTime = arrivals[stopCode][allRoutes[i].ServiceNo] + timeTravelled
                            if (oldTime <= newTime){
                                j += 1
                                continue
                            }
                            else{
                                final[allRoutes[j].BusStopCode] = {
                                    boardAt: stopCode,
                                    bus: allRoutes[i].ServiceNo,
                                    stops: j-i,
                                    totalTime: arrivals[stopCode][allRoutes[i].ServiceNo] + timeTravelled 
                                }
                            }
                        } else{
                        final[allRoutes[j].BusStopCode] = {
                            boardAt: stopCode,
                            bus: allRoutes[i].ServiceNo,
                            stops: j-i,
                            totalTime: arrivals[stopCode][allRoutes[i].ServiceNo] + timeTravelled 
                        }
                    }}else{
                        break
                    }
                    j += 1
                }
            }
        }


    }
    return final
    //travel == travelTime (max travel time they want, number)
    //arrivals == time taken for user to board each bus at each stop

    
}