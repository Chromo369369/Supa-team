export async function filterBusStops(travel: any,busStops: any,start: any){
        //travel == travelTime (max travel time they want, number)
        //busStops == {
            //busStopCode: 5 digit number,
            //RoadName: Street Name String,
            //Description: Landmarks nearby, String,
            //Latitude: Coordinates Number,
            //Longitude: Coordinates Number,
        //}
        //start == {
            // {
    //   "SEARCHVAL": "640 ROWELL ROAD SINGAPORE 200640",
    //   "BLK_NO": "640",
    //   "ROAD_NAME": "ROWELL ROAD",
    //   "BUILDING": "NIL",
    //   "ADDRESS": "640 ROWELL ROAD SINGAPORE 200640",
    //   "POSTAL": "200640",
    //   "X": "30381.1007417506",
    //   "Y": "32195.1006872542",
    //   "LATITUDE": "1.30743547948389",
    //   "LONGITUDE": "103.854713903431",
    //   "LONGTITUDE": "103.854713903431"
    // }
        //}
        
        let distances:any[] = []
        for (let bstop of busStops){
            let length = Math.abs(bstop.Latitude - start.LATITUDE)
            let height = Math.abs(bstop.Longitude - start.LONGITUDE)
            distances.push((length + height) * 111) 
            

        }
        distances = distances.sort()
        let totalTimings:any[] = []
        for (let i=0;i<3;i++){
            let timing = distances[i] / 
        }

    }