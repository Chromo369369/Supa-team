<script setup>
const {$supabase} = useNuxtApp()
const valid_session = ref(false)
async function check_session(event){
  const {data,error} = await $supabase.auth.getUser()
  if(data.user){
    valid_session.value = true
  }else{
    valid_session.value = false
  }
  if (event == 'SIGNED_OUT'){
    await navigateTo('/',{replace:true})
  }
}
onMounted(()=>{check_session()})
async function logout(){
  await $supabase.auth.signOut()
  await navigateTo('/',{replace: true})
  return
}
const {data: {subscription} } =  $supabase.auth.onAuthStateChange(check_session)

onUnmounted(() =>
  subscription.unsubscribe()
)
</script>

<template>

    <header class="wb-header">
        <nav class="navbar navbar-expand-md">
            <div class="container-fluid px-4">
                <NuxtLink to="/" class="navbar-brand header-brand">🚌 WanderBus</NuxtLink>

                <button class="navbar-toggler" type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#main-nav"
                        aria-controls="main-nav"
                        aria-expanded="false"
                        aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div id="main-nav" class="collapse navbar-collapse justify-content-end">
                    <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2 py-3 py-md-0">
                        <NuxtLink to="/home" class="header-link" v-if="valid_session">Home</NuxtLink>
                        <NuxtLink to="/group" class="header-link" v-if="valid_session">Group</NuxtLink>
                        <NuxtLink to="/passport" class="header-link" v-if="valid_session">Passport</NuxtLink>
                        <NuxtLink to="/login" class="header-link" v-if="!valid_session">Login</NuxtLink>
                        <NuxtLink to="/register" class="btn btn-wb-dark" v-if="!valid_session">Register</NuxtLink>
                        <button type="button" class="header-link" v-if="valid_session" @click="logout()">Logout</button>
                    </div>
                </div>
            </div>
        </nav>
    </header>

</template>

<style scoped>
.wb-header {
  position: sticky;
  top: 0;
  z-index: 1030;
  background: #fff;
  border-bottom: 1px solid #e3e5ec;
}

.header-brand {
  font-size: 1.3rem;
  font-weight: 800;
  color: #141a33;
}

.header-link {
  padding: 6px 14px;
  border: 0;
  border-radius: 50px;
  background: transparent;
  color: #4a5068;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease;
}

.header-link:hover {
  background: #f1f2f6;
  color: #141a33;
}

/* Green pill on the page you're on (NuxtLink adds router-link-active) */
.header-link.router-link-active {
  background: #e3f2ea;
  color: #0b7a4b;
  font-weight: 600;
}

.btn-wb-dark {
  background: #141a33;
  color: #fff;
  border-radius: 50px;
  padding: 8px 22px;
  font-weight: 600;
}

.btn-wb-dark:hover {
  background: #2a3150;
  color: #fff;
}
</style>
