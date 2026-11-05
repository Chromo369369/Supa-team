<script setup>
const {$supabase} = useNuxtApp()
const valid_session = ref(false)
async function check_session(){
  const {data,error} = await $supabase.auth.getUser()
  if(data.user){
    valid_session.value = true
  }else{
    valid_session.value = false
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
    <footer class="wb-footer">
        <div class="container footer-inner">
            <div class="row gx-4 gy-5">
                <div class="col-md-6">
                    <NuxtLink to="/" class="footer-brand">
                        <i class="bi bi-bus-front" aria-hidden="true"></i>
                        <span>WanderBus</span>
                    </NuxtLink>
                    <p class="footer-text mb-0">
                        Take a random bus. Get off somewhere worth it.
                    </p>
                </div>

                <nav class="col-md-6" aria-label="Footer">
                    <div class="row gx-4 gy-4">
                        <div class="col-6">
                            <p class="footer-head">Explore</p>
                            <ul class="footer-links">
                                <li><NuxtLink to="/">About</NuxtLink></li>
                                <li><NuxtLink to="/home">Home</NuxtLink></li>
                            </ul>
                        </div>

                        <div class="col-6">
                            <p class="footer-head">Account</p>
                            <ul class="footer-links">
                                <li v-if="!valid_session"><NuxtLink to="/login">Log in</NuxtLink></li>
                                <li v-if="!valid_session"><NuxtLink to="/register">Register</NuxtLink></li>
                                <li v-if="valid_session"><button type="button" class="footer-button" @click="logout()">Log out</button></li>
                            </ul>
                        </div>
                    </div>
                </nav>
            </div>

            <p class="footer-bottom mb-0">
                © 2026 WanderBus · WAD2 G6T3
            </p>
        </div>
    </footer>
</template>

<style scoped>
.wb-footer {
  background: var(--wb-ink);
  color: var(--wb-on-ink-2);
}

.footer-inner {
  padding-block: var(--sp-8) var(--sp-6);
  padding-inline: var(--gutter);
}

/* The designed close: large wordmark in Fredoka */
.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
  line-height: 1.1;
  color: var(--wb-on-ink);
  text-decoration: none;
}

.footer-brand:hover {
  color: var(--wb-on-ink);
}

.footer-text {
  margin-top: var(--sp-3);
  font-size: var(--fs-lead);
  color: var(--wb-on-ink-2);
}

.footer-head {
  margin: 0 0 var(--sp-1);
  font-weight: 600;
  color: var(--wb-on-ink);
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 44px tall targets */
.footer-links a,
.footer-button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--wb-on-ink-2);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.footer-links a:hover,
.footer-button:hover {
  color: var(--wb-on-ink);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.footer-links a:focus-visible,
.footer-button:focus-visible {
  outline: 3px solid var(--wb-amber);
  outline-offset: 2px;
}

.footer-bottom {
  margin-top: var(--sp-7);
  font-size: var(--fs-meta);
  color: var(--wb-on-ink-2);
}
</style>
