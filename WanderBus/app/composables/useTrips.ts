
export const useTrips = () => {
  return useState<Array<{
    id: string | number
    date: string
    busService: string
    busStop: { code: string; name: string }
    memories: string
    photoLink: string
    isPublic: boolean
  }>>('savedTrips', () => [])
}