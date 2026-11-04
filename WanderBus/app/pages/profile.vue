<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import BusPassCard from '~/components/profile/BusPassCard.vue'
import CardCollection from '~/components/profile/CardCollection.vue'
import MyPosts from '~/components/profile/MyPosts.vue'
import ShopPanel from '~/components/profile/ShopPanel.vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()

const { stats, loading, loadError, displayName, userId, load } = useProfile()
onMounted(load)

// before the first load starts, stats is null with no error yet: show the skeleton then too
const passLoading = computed(() => loading.value || (!stats.value && !loadError.value))

const tabs = [
  { key: 'cards', label: 'Cards' },
  { key: 'shop', label: 'Shop' },
  { key: 'posts', label: 'My posts' }
]

// ?tab=shop / ?tab=posts keeps the tab in the URL, so a reload or a shared link opens the same one (Cards is the default)
const tab = computed({
  get: () => (tabs.some((item) => item.key === route.query.tab) ? route.query.tab : 'cards'),
  set: (key) => {
    const query = { ...route.query }
    delete query.tab
    if (key !== 'cards') query.tab = key
    router.replace({ query })
  }
})

// tabs: arrow keys / Home / End move between them (roving tabindex), picking as they go (same as stop/[code].vue)
function onTabKey(event, index) {
  let next = null
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
  else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = tabs.length - 1
  if (next === null) return
  event.preventDefault()
  tab.value = tabs[next].key
  nextTick(() => document.getElementById(`profile-tab-${tabs[next].key}`)?.focus())
}

// all panels stay mounted (v-show), so this ref is there even while the Shop tab is open
const collection = ref(null)

// ShopPanel spent credits: show the new balance on the pass, and a new card in the collection
function onRedeemed({ credits, item }) {
  if (stats.value) stats.value.credits = credits
  if (item?.kind === 'card') collection.value?.reload()
}
</script>

<template>
  <div class="profile-page">
    <h1 class="profile-title">Your profile</h1>

    <!-- Load error (§3.3 generic error): in place of the pass, the tabs below still work -->
    <div v-if="loadError" class="state-block state-error" role="alert">
      <WanderMascot mood="sad" :size="96" />
      <p class="mb-0">Couldn’t load your bus pass.</p>
      <button type="button" class="btn-wb-secondary btn-sm" :aria-busy="loading ? 'true' : 'false'" :disabled="loading" @click="load">
        <i v-if="!loading" class="bi bi-arrow-clockwise" aria-hidden="true"></i>
        {{ loading ? 'Retrying…' : 'Retry' }}
      </button>
    </div>

    <BusPassCard
      v-else
      :name="displayName"
      :user-id="userId"
      :stats="stats"
      :loading="passLoading"
    />

    <div class="profile-tabs-block">
      <div class="profile-tabs" role="tablist" aria-label="Your cards, the shop and your posts">
        <button
          v-for="(item, index) in tabs"
          :id="`profile-tab-${item.key}`"
          :key="item.key"
          type="button"
          role="tab"
          class="profile-tab"
          :class="{ active: tab === item.key }"
          :aria-selected="tab === item.key ? 'true' : 'false'"
          :aria-controls="`profile-panel-${item.key}`"
          :tabindex="tab === item.key ? 0 : -1"
          @click="tab = item.key"
          @keydown="onTabKey($event, index)"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-show="tab === 'cards'" id="profile-panel-cards" role="tabpanel" aria-labelledby="profile-tab-cards">
        <CardCollection ref="collection" />
      </div>
      <div v-show="tab === 'shop'" id="profile-panel-shop" role="tabpanel" aria-labelledby="profile-tab-shop">
        <ShopPanel @redeemed="onRedeemed" />
      </div>
      <div v-show="tab === 'posts'" id="profile-panel-posts" role="tabpanel" aria-labelledby="profile-tab-posts">
        <MyPosts />
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 1040px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.profile-title {
  margin: 0;
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

/* ── Error state (same block as passport.vue) ── */
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
  max-width: 720px;
  padding: var(--sp-7) var(--sp-5);
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-text-2);
  text-align: center;
}
.state-error {
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
}

/* ── Tabs: the segmented track from stop/[code].vue ── */
.profile-tabs-block {
  margin-top: var(--sp-3);
}

.profile-tabs {
  display: inline-flex;
  max-width: 100%;
  gap: var(--sp-1);
  padding: var(--sp-1);
  background: var(--wb-surface-2);
  border-radius: var(--r-pill);
  margin-bottom: var(--sp-5);
}

.profile-tab {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--sp-5);
  background: none;
  border: none;
  border-radius: var(--r-pill);
  font-weight: 500;
  color: var(--wb-text-2);
  white-space: nowrap;
  transition: background-color var(--t-micro) var(--ease), color var(--t-micro) var(--ease);
}

.profile-tab:hover {
  color: var(--wb-ink);
}

.profile-tab.active {
  background: var(--wb-green);
  color: var(--wb-on-ink);
}

.profile-tab:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}
</style>
