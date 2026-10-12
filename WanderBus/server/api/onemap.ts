export default defineEventHandler(async(event) => {
    const config = useRuntimeConfig(event)
    const startingLocation = getQuery(event).value
    const location = await $fetch<{found: number,results: any[] }>('https://www.onemap.gov.sg/api/common/elastic/search',{
        query:{
            searchVal: startingLocation,
            returnGeom: 'Y',
            getAddrDetails: 'Y',
            pageNum: 1
        },
        headers: { Authorization: config.onemapToken, accept: 'application/json'}
    })
    return location.results
    
})