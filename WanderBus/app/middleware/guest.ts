export default defineNuxtRouteMiddleware(async () => {
    if (await checkSession()) {
        return navigateTo('/home', { replace: true })
    }
})