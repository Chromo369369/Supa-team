// Fake data shaped like what the real LTA / OneMap / Overpass endpoints return.
// Everything here is invented, so the browser tests never depend on live services.

// A starting place, shaped like a OneMap search result (see filterStartingBusStops in filterStops.ts)
export const START_PLACE = {
  SEARCHVAL: 'ROWELL ROAD',
  BLK_NO: '640',
  ROAD_NAME: 'ROWELL ROAD',
  BUILDING: 'NIL',
  ADDRESS: '640 ROWELL ROAD SINGAPORE 200640',
  POSTAL: '200640',
  X: '30381.1007417506',
  Y: '32195.1006872542',
  LATITUDE: '1.30743547948389',
  LONGITUDE: '103.854713903431',
  LONGTITUDE: '103.854713903431',
}

// A place far from every fake bus stop (used for the "no stops found" case)
export const FAR_PLACE = {
  ...START_PLACE,
  SEARCHVAL: 'TUAS LINK',
  ROAD_NAME: 'TUAS LINK',
  ADDRESS: '1 TUAS LINK SINGAPORE 638600',
  POSTAL: '638600',
  LATITUDE: '1.3404',
  LONGITUDE: '103.6368',
  LONGTITUDE: '103.6368',
}

export const ONEMAP_RESULTS = [START_PLACE, FAR_PLACE]

// Only 10001 is within walking range of START_PLACE. The rest are along bus 65's route.
export const BUS_STOPS = [
  { BusStopCode: '10001', RoadName: 'Rowell Rd', Description: 'Opp Jalan Besar Stadium', Latitude: 1.30743, Longitude: 103.85471 },
  { BusStopCode: '10002', RoadName: 'Victoria St', Description: 'Bugis Stn', Latitude: 1.2990, Longitude: 103.8559 },
  { BusStopCode: '10003', RoadName: 'Orchard Rd', Description: 'Orchard Stn', Latitude: 1.3040, Longitude: 103.8319 },
  { BusStopCode: '10004', RoadName: 'Cluny Rd', Description: 'Botanic Gdns Stn', Latitude: 1.3138, Longitude: 103.8159 },
  { BusStopCode: '10005', RoadName: 'Marina Way', Description: 'Marina Bay Stn', Latitude: 1.2800, Longitude: 103.8545 },
]

// Bus 65, direction 1. Distance is km from the start of the route.
// At 15 km/h: 10002 = 4.8 min, 10003 = 16 min, 10004 = 30 min, 10005 = 60 min after boarding.
export const BUS_ROUTES = [
  { ServiceNo: '65', Operator: 'SBST', Direction: 1, StopSequence: 1, BusStopCode: '10001', Distance: 0 },
  { ServiceNo: '65', Operator: 'SBST', Direction: 1, StopSequence: 2, BusStopCode: '10002', Distance: 1.2 },
  { ServiceNo: '65', Operator: 'SBST', Direction: 1, StopSequence: 3, BusStopCode: '10003', Distance: 4.0 },
  { ServiceNo: '65', Operator: 'SBST', Direction: 1, StopSequence: 4, BusStopCode: '10004', Distance: 7.5 },
  { ServiceNo: '65', Operator: 'SBST', Direction: 1, StopSequence: 5, BusStopCode: '10005', Distance: 15 },
]

// BusStopCode -> categories that have a named place within 1 km (see /api/allAmenities)
export const AMENITIES: Record<string, Record<string, string[]>> = {
  '10002': { cafe: ['Bugis Brew'], food: ['Hawker Corner'] },
  '10003': { museum: ['Gallery X'], food: ['Orchard Eats'] },
  '10004': { park: ['Botanic Gardens'], cafe: ['Garden Cafe'] },
}

// Shaped like /api/busArrivals (LTA BusArrival v3). Times are relative to "now" so they never go stale.
export function arrivalsFor(code: string) {
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString()
  return {
    BusStopCode: code,
    Services: [
      {
        ServiceNo: '65',
        Operator: 'SBST',
        NextBus: { EstimatedArrival: inMinutes(5) },
        NextBus2: { EstimatedArrival: inMinutes(12) },
        NextBus3: { EstimatedArrival: inMinutes(20) },
      },
    ],
  }
}

// Shaped like /api/stops/[code]/places
export function placesFor(code: string) {
  const stop = BUS_STOPS.find((s) => s.BusStopCode === code) ?? BUS_STOPS[2]!
  const place = (id: string, name: string, category: string, section: string, subtype: string, distanceM: number) => ({
    id,
    name,
    category,
    section,
    subtype,
    lat: stop.Latitude + 0.001,
    lon: stop.Longitude + 0.001,
    distanceM,
    walkMin: Math.max(1, Math.round((distanceM * 1.3) / 80)),
    preferred: false,
  })
  return {
    stop: { code: stop.BusStopCode, name: stop.Description, road: stop.RoadName, lat: stop.Latitude, lon: stop.Longitude },
    radius: 1000,
    preferred: [] as string[],
    places: [
      place('osm:node/1', 'Test Cafe', 'cafe', 'food', 'Cafe', 120),
      place('osm:node/2', 'Test Museum', 'museum', 'heritage', 'Museum', 340),
      place('osm:way/3', 'Test Park', 'park', 'nature', 'Park', 560),
    ],
  }
}

// A saved passport row (columns taken from passport.vue / useAdventure.ts)
export function passportRow(n: number) {
  return {
    id: n,
    entry_time: new Date(Date.now() - n * 86_400_000).toISOString(),
    starting_stop: 'Opp Jalan Besar Stadium',
    end_stop: `Test Destination ${n}`,
    time_taken: 20 + n,
    bus_taken: '65',
    starting_location: '640 ROWELL ROAD SINGAPORE 200640',
    entry_notes: '',
    photo_url: '',
  }
}
