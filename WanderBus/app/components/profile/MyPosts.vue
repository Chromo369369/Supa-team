<!--
  MyPosts: the signposts and challenges you left around stops, newest first (profile "My posts" tab).
  A list of filled rows: kind chip, the note or challenge title, the stop, the date, a 4:3 photo
  thumbnail when the post has one, and how many explorers finished each challenge. Each row links to
  that stop's Activities tab (/stop/<code>?tab=activities).
  States (design.md §3.3): loading keeps the list with flat placeholder rows, empty explains how to
  post, and an error says what failed with a Retry.
-->
<script setup>
import { computed, onMounted, ref } from 'vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'

const { posts, loading, loadError, load } = useMyPosts()
onMounted(load)

// filter: all / signposts / challenges
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'signpost', label: 'Signposts' },
  { key: 'challenge', label: 'Challenges' }
]
const filter = ref('all')
const shown = computed(() => (filter.value === 'all' ? posts.value : posts.value.filter((p) => p.kind === filter.value)))
const countOf = (key) => (key === 'all' ? posts.value.length : posts.value.filter((p) => p.kind === key).length)

const dateFmt = new Intl.DateTimeFormat('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })
const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '')

const kindLabel = (post) => (post.kind === 'signpost' ? 'Signpost' : 'Challenge')
const textOf = (post) => (post.kind === 'signpost' ? post.note : post.title)
</script>

<template>
  <section class="my-posts" aria-labelledby="posts-heading">
    <header class="posts-head">
      <h2 id="posts-heading" class="posts-title">Your signposts and challenges</h2>
      <p v-if="loading" class="posts-count" role="status">Loading your posts…</p>
      <p v-else-if="!loadError && posts.length" class="posts-count">
        <span class="num">{{ shown.length }}</span> {{ shown.length === 1 ? 'post' : 'posts' }}
      </p>
      <div v-if="!loading && !loadError && posts.length" class="post-filters" role="group" aria-label="Show posts">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="post-filter"
          :aria-pressed="filter === f.key ? 'true' : 'false'"
          @click="filter = f.key"
        >
          {{ f.label }} <span class="num">{{ countOf(f.key) }}</span>
        </button>
      </div>
    </header>

    <!-- Loading: flat placeholder rows at their real height -->
    <ul v-if="loading && !posts.length" class="post-list" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="post-skeleton"></li>
    </ul>

    <!-- Error: one sentence, what failed, Retry -->
    <div v-else-if="loadError" class="state-block" role="alert">
      <WanderMascot mood="sad" color="var(--wb-danger)" :size="48" />
      <div class="state-copy">
        <p class="state-text">Couldn’t load your posts.</p>
        <p class="state-detail">{{ loadError }}</p>
      </div>
      <button type="button" class="btn-wb-secondary btn-sm" :disabled="loading" :aria-busy="loading ? 'true' : 'false'" @click="load">
        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> {{ loading ? 'Retrying…' : 'Retry' }}
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="!posts.length" class="state-block">
      <WanderMascot mood="sleepy" :size="48" />
      <div class="state-copy">
        <p class="state-text">You haven’t left any signposts or challenges yet.</p>
        <p class="state-detail">Open a stop’s Activities tab and drop a pin to leave a tip or set a challenge for the next explorer.</p>
      </div>
    </div>

    <ul v-else class="post-list">
      <li v-for="post in shown" :key="post.key">
        <NuxtLink :to="`/stop/${post.stop_code}?tab=activities`" class="post-row">
          <span class="post-body">
            <span class="post-top">
              <span class="kind-chip" :class="`is-${post.kind}`">
                <i class="bi" :class="post.kind === 'signpost' ? 'bi-signpost-split' : 'bi-flag'" aria-hidden="true"></i>
                {{ kindLabel(post) }}
              </span>
              <time class="post-date" :datetime="post.created_at">{{ formatDate(post.created_at) }}</time>
            </span>
            <span class="post-text">{{ textOf(post) }}</span>
            <span class="post-meta">
              <span>Stop <span class="num">{{ post.stop_code }}</span></span>
              <span v-if="post.kind === 'challenge'"><span class="num">{{ post.completedCount }}</span> {{ post.completedCount === 1 ? 'explorer' : 'explorers' }} finished it</span>
            </span>
          </span>
          <span v-if="post.photoUrl" class="post-thumb">
            <img :src="post.photoUrl" alt="" width="128" height="96" loading="lazy" decoding="async" />
          </span>
          <i class="bi bi-chevron-right post-go" aria-hidden="true"></i>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.posts-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}

.post-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.post-filter {
  min-height: 44px;
  padding: 0 var(--sp-4);
  border: 1px solid var(--wb-line);
  border-radius: var(--r-pill);
  background: var(--wb-surface);
  color: var(--wb-ink);
  font-weight: 600;
}

.post-filter .num { color: var(--wb-text-2); }

.post-filter[aria-pressed='true'] {
  background: var(--wb-ink);
  border-color: var(--wb-ink);
  color: var(--wb-on-ink);
}

.post-filter[aria-pressed='true'] .num { color: var(--wb-on-ink-2); }

.post-filter:focus-visible {
  outline: 2px solid var(--wb-ink);
  outline-offset: 2px;
}

.posts-title {
  margin: 0;
  font-size: var(--fs-lead);
}

.posts-count {
  margin: 0;
  color: var(--wb-text-2);
}

/* ── the list: one filled row per post ── */
.post-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  max-width: 760px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.post-skeleton {
  height: 120px;
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
}

.post-row {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  min-height: 44px;
  padding: var(--sp-4);
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-ink);
  text-decoration: none;
  touch-action: manipulation;
  transition: background-color var(--t-micro) var(--ease);
}
.post-row:hover {
  background: var(--wb-surface-2);
  color: var(--wb-ink);
}
.post-row:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.post-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  flex: 1 1 auto;
  min-width: 0;
}

.post-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
}

.kind-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-pill);
  font-size: var(--fs-small);
  font-weight: 500;
  line-height: 1.3;
}
.kind-chip.is-signpost {
  background: var(--wb-green-tint);
  color: var(--wb-green);
}
.kind-chip.is-challenge {
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
}

.post-date {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.post-text {
  display: -webkit-box;
  overflow: hidden;
  font-weight: 500;
  line-height: 1.4;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-4);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

/* the 4:3 thumbnail, cropped to fill */
.post-thumb {
  flex: none;
  width: 128px;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}
.post-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-go {
  flex: none;
  color: var(--wb-text-2);
}

@media (max-width: 479px) {
  .post-thumb {
    width: 88px;
  }
  .post-go {
    display: none;
  }
}

/* ── states ── */
.state-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-4);
  max-width: 760px;
  padding: var(--sp-5);
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
}

.state-copy {
  flex: 1 1 240px;
  min-width: 0;
}

.state-text {
  margin: 0;
  color: var(--wb-ink);
}

.state-detail {
  margin: var(--sp-1) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

@media (prefers-reduced-motion: reduce) {
  .post-row {
    transition: none;
  }
}
</style>
