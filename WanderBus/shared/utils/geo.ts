// straight line distance btw 2 coordinates in meters, using haversine formula
export function distanceInMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (deg: number) => deg * Math.PI / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function walkMinutes(metres: number) {
    return Math.max(1, Math.round(metres * 1.3 / 80))
}
