<script setup>
import WanderMascot from '~/components/ui/WanderMascot.vue'
import { passColors } from '~/components/profile/BusPassCard.vue'
const {$supabase} = useNuxtApp()
const adventure = useAdventure()
const valid_session = ref(false)
const user_name = ref('')   // picks the avatar's colour, the same one as on the bus pass and signposts
const is_admin = ref(false) // shows the Admin link; /admin itself checks admin_users again, so this only hides the link

// not awaited by check_session: it runs inside onAuthStateChange, where waiting on more Supabase calls can stall auth
async function check_admin(userId){
  const {data, error} = await $supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
  is_admin.value = !error && !!data
}

async function check_session(event){
  const {data,error} = await $supabase.auth.getUser()
  if(data.user){
    valid_session.value = true
    user_name.value = data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || ''
    check_admin(data.user.id)
  }else{
    valid_session.value = false
    user_name.value = ''
    is_admin.value = false
  }
  if (event == 'SIGNED_OUT'){
    adventure.end()   // a running adventure belongs to the account that started it
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
                    <WanderMascot :size="24" gaze />
                    <span>WanderBus</span>
                </NuxtLink>

                <!-- Your mascot, in your colour: outside the collapse so it shows on phones too.
                     Sits left of the menu button on phones, after the links on desktop (order). -->
                <NuxtLink v-if="valid_session" to="/profile" class="header-avatar" aria-label="Your profile"
                          :style="{ background: passColors(user_name)[1] }">
                    <!-- the captain's cap is a shop perk (useRewards); only your own mascot wears it -->
                    <WanderMascot :size="32" :color="passColors(user_name)[0]"
                                  :hat="useRewards().isOn('perk-mascot-captain') ? 'captain' : null" />
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
                        <NuxtLink to="/admin" class="header-link" v-if="valid_session && is_admin">Admin</NuxtLink>
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

/* Profile avatar: a 44px round target holding a 32px mascot on its own tint */
.header-avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-left: auto;
  margin-right: var(--sp-2);
  border-radius: 50%;
  transition: transform var(--t-micro) var(--ease);
}

.header-avatar:hover {
  transform: translateY(-1px);
}

.header-avatar:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

/* on /profile a green ring marks it as the page you are on */
.header-avatar.router-link-active {
  outline: 2px solid var(--wb-green);
  outline-offset: 2px;
}

@media (min-width: 768px) {
  .header-avatar {
    order: 1;
    margin-left: var(--sp-2);
    margin-right: 0;
  }
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
