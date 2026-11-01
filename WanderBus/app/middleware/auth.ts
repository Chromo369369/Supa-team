export default defineNuxtRouteMiddleware(async () => {
    const session = await checkSession()
    if (!session){
        return navigateTo('/',{replace: true})
    }
    else{
        return
    }
})


