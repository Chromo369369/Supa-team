export async function checkSession(){
    const {$supabase} = useNuxtApp()
    const {data,error} = await $supabase.auth.getUser()
    if(data.user){
        return true
    }else{
        return false
    }
}