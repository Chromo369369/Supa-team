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
        <nav class="navbar navbar-expand-md" aria-label="Main">
            <div class="container-fluid header-inner">
                <NuxtLink to="/" class="navbar-brand header-brand">
                    <i class="bi bi-bus-front" aria-hidden="true"></i>
                    <span>WanderBus</span>
                </NuxtLink>

                <button class="navbar-toggler header-toggler" type="button"
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
                        <NuxtLink to="/login" class="header-link" v-if="!valid_session">Log in</NuxtLink>
                        <NuxtLink to="/register" class="btn btn-wb-secondary" v-if="!valid_session">Register</NuxtLink>
                        <button type="button" class="header-link" v-if="valid_session" @click="logout()">Log out</button>
                    </div>
                </div>
            </div>
        </nav>
    </header>

</template>

<style scoped>
/* Opaque bar; separated from the page by a tone step (surface on ground), not a line */
.wb-header {
  position: sticky;
  top: 0;
  z-index: 1030;
  background: var(--wb-surface);
}

.header-inner {
  min-height: var(--header-h);
  padding-inline: var(--gutter);
}

.header-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  font-family: var(--font-display);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.header-brand:hover {
  color: var(--wb-ink);
}

.header-toggler {
  min-width: 44px;
  min-height: 44px;
  border-color: var(--wb-control);
}

.header-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--sp-4);
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--wb-text-2);
  font: 500 var(--fs-body)/1 var(--font-ui);
  text-decoration: none;
  transition: background-color var(--t-micro) var(--ease), color var(--t-micro) var(--ease);
}

.header-link:hover {
  background: var(--wb-surface-2);
  color: var(--wb-ink);
}

.header-link:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

/* Green pill on the page you're on (NuxtLink adds router-link-active) */
.header-link.router-link-active {
  background: var(--wb-green-tint);
  color: var(--wb-green);
  font-weight: 600;
}
</style>
