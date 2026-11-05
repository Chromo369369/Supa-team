<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Bus3D from '~/components/ui/Bus3D.vue'
import { useMotionPrefs } from '~/composables/usePointer'

interface Pose { x: number; y: number }

const features: { icon: string; title: string; text: string; pose: Pose; door?: boolean }[] = [
  { icon: 'bi-ticket-perforated', title: 'Spin for a stop', text: 'Tell us where you’re starting, how long you have and what you’re in the mood for. You get a random stop you can reach in time.', pose: { x: -10, y: -22 } },
  { icon: 'bi-geo-alt-fill', title: 'Around the stop', text: 'A map of places within 1 km, with photos from other explorers. Post the first photo of a spot to earn Pioneer credit.', pose: { x: -8, y: -72 } },
  { icon: 'bi-signpost-2', title: 'Signposts and challenges', text: 'Leave a signpost with a tip and a rating, or set a challenge for the next explorer. Finish one by posting a photo.', pose: { x: -10, y: -196 }, door: true },
  { icon: 'bi-people', title: 'Explore together', text: 'Start a crew, share the join code and wait in one lobby until everyone’s aboard.', pose: { x: -74, y: -180 } },
  { icon: 'bi-journal-bookmark', title: 'Passport', text: 'Save each trip to your passport, with your photos and notes.', pose: { x: -10, y: -252 } },
]
const LAST = features.length - 1
const HEAD = 0.06

const { reducedMotion } = useMotionPrefs()

const root = ref<HTMLElement | null>(null)
const scene = ref<HTMLElement | null>(null)
/** static until mounted, so the content reads without the script */
const animated = ref(false)
const armed = ref(false)
const entered = ref(false)
const phone = ref(false)

/** position along the poses, 0 … LAST */
const pos = ref(0)
const progress = ref(0)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const smooth = (v: number) => v * v * (3 - 2 * v)

const rotation = computed<Pose>(() => {
  const i = Math.min(Math.floor(pos.value), LAST - 1)
  // hold the pose for the first and last 20% of each step, ease across the middle
  const f = smooth(clamp((pos.value - i - 0.2) / 0.6, 0, 1))
  const a = features[i]!.pose
  const b = features[i + 1]!.pose
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
})
const active = computed(() => clamp(Math.round(pos.value), 0, LAST))
const doorOpen = computed(() => !!features[active.value]!.door)
const busSize = computed(() => (phone.value ? 420 : 760))
const TITLE = 'Every stop has something to find.'
const INTRO = 'The spin picks the stop. Tips and photos from other explorers show you what’s worth doing once you’re there.'

/* ── scroll ── */
let frame = 0
let io: IntersectionObserver | null = null
let entryIo: IntersectionObserver | null = null
let listening = false
let mqPhone: MediaQueryList | null = null

function headerHeight() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))
  return Number.isFinite(v) ? v : 64
}

function measure() {
  frame = 0
  const el = scene.value
  if (!el) return
  const top = headerHeight()
  const rect = el.getBoundingClientRect()
  const travel = Math.max(1, rect.height - (window.innerHeight - top))
  const p = clamp((top - rect.top) / travel, 0, 1)
  progress.value = p
  // a short hold before the first turn; the last pose holds for about half a screen before the
  // scene ends (a quarter of the shorter phone run, an eighth of the desktop run)
  const tail = phone.value ? 0.25 : 0.12
  pos.value = clamp(((p - HEAD) / (1 - HEAD - tail)) * LAST, 0, LAST)
}

function onScroll() {
  if (!frame) frame = requestAnimationFrame(measure)
}

function listen(on: boolean) {
  if (on === listening) return
  listening = on
  if (on) {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()
  } else {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }
}

function stopScene() {
  listen(false)
  io?.disconnect()
  io = null
}

function startScene() {
  stopScene()
  if (!scene.value || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver(([entry]) => listen(!!entry?.isIntersecting))
  io.observe(scene.value)
}

function syncPhone() {
  phone.value = !!mqPhone?.matches
}

function applyMode() {
  const reduce = reducedMotion.value || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  animated.value = !reduce
  armed.value = !reduce && !entered.value
}

watch(animated, async (on) => {
  if (on) {
    await nextTick()
    requestAnimationFrame(startScene)
  } else {
    stopScene()
    pos.value = 0
  }
})
watch(reducedMotion, () => applyMode())

onMounted(() => {
  mqPhone = window.matchMedia?.('(max-width: 767px)') ?? null
  syncPhone()
  mqPhone?.addEventListener?.('change', syncPhone)
  applyMode()

  // entrance: heading, then text, then the bus, once
  if (armed.value && root.value && typeof IntersectionObserver !== 'undefined') {
    entryIo = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        entered.value = true
        entryIo?.disconnect()
        entryIo = null
      }
    }, { rootMargin: '0px 0px -15% 0px' })
    entryIo.observe(root.value)
  } else {
    entered.value = true
  }
})

onBeforeUnmount(() => {
  stopScene()
  entryIo?.disconnect()
  mqPhone?.removeEventListener?.('change', syncPhone)
})
</script>

<template>
  <section
    id="features"
    ref="root"
    class="tt section-white"
    :class="{ 'is-animated': animated, 'is-armed': armed, 'is-in': entered }"
    aria-labelledby="features-title"
  >
    <!-- static mode: the header sits above the rows -->
    <header v-if="!animated" class="tt-head">
      <h2 id="features-title" class="tt-title tt-rise">{{ TITLE }}</h2>
      <p class="tt-intro tt-rise" style="--d: 1">{{ INTRO }}</p>
    </header>

    <!-- scroll scene: the header lives in the sticky stage, the intro pairs with the first pose -->
    <div v-if="animated" ref="scene" class="tt-scene">
      <div class="tt-stage">
        <div class="tt-copy">
          <h2 id="features-title" class="tt-title tt-rise">{{ TITLE }}</h2>

          <!-- what screen readers get: every feature, all the time -->
          <p class="visually-hidden">{{ INTRO }}</p>
          <ul class="visually-hidden">
            <li v-for="feature in features" :key="feature.title">
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.text }}</p>
            </li>
          </ul>

          <!-- the visual crossfade stack -->
          <div class="tt-stack tt-rise" style="--d: 1" aria-hidden="true">
            <div
              v-for="(feature, i) in features"
              :key="feature.title"
              class="tt-feature"
              :class="{ 'is-active': i === active }"
            >
              <p v-if="i === 0" class="tt-intro tt-intro--stage">{{ INTRO }}</p>
              <p class="tt-feature-title">
                <i class="bi tt-icon" :class="feature.icon" aria-hidden="true"></i>
                {{ feature.title }}
              </p>
              <p class="tt-feature-text">{{ feature.text }}</p>
            </div>
          </div>
          <div class="tt-progress" aria-hidden="true">
            <span class="tt-progress-fill" :style="{ transform: `scaleX(${progress})` }"></span>
          </div>
        </div>
        <div class="tt-bus tt-rise" style="--d: 2">
          <Bus3D :rotation="rotation" :door-open="doorOpen" :size="busSize" />
        </div>
      </div>
    </div>

    <!-- static rows: reduced motion, or before the script runs -->
    <div v-else class="tt-rows">
      <article v-for="(feature, i) in features" :key="feature.title" class="tt-row" :class="{ 'is-flip': i % 2 === 1 }">
        <div class="tt-row-copy">
          <h3 class="tt-feature-title">
            <i class="bi tt-icon" :class="feature.icon" aria-hidden="true"></i>
            {{ feature.title }}
          </h3>
          <p class="tt-feature-text">{{ feature.text }}</p>
        </div>
        <div class="tt-row-bus">
          <Bus3D :rotation="feature.pose" :door-open="!!feature.door" :size="360" />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.tt {
  position: relative;
  /* the perspective and the 3/4 views never cause a sideways scroll */
  overflow-x: clip;
  padding-block: var(--sp-8);
}
@media (min-width: 992px) {
  .tt { padding-block: var(--sp-9); }
}

.tt-head,
.tt-stage,
.tt-rows {
  width: 100%;
  /* same inset as the hero's .container */
  max-width: 1320px;
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.tt-title {
  margin: 0;
  max-width: 18ch;
  font-family: var(--font-display);
  font-size: clamp(2rem, 1.2rem + 3vw, 3.5rem);
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: -0.02em;
  color: var(--wb-ink);
}
.tt-intro {
  margin: var(--sp-4) 0 0;
  max-width: 52ch;
  font-size: var(--fs-lead);
  line-height: 1.5;
  color: var(--wb-ink);
}

.tt-feature-title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin: 0 0 var(--sp-3);
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
  line-height: 1.1;
  color: var(--wb-ink);
}
.tt-icon {
  flex: none;
  color: var(--wb-green);
  font-size: 0.85em;
}
.tt-feature-text {
  margin: 0;
  max-width: 42ch;
  font-size: var(--fs-lead);
  line-height: 1.5;
  color: var(--wb-ink);
}

/* ── scroll scene ── */
.tt.is-animated { padding-block: 0; }
.tt-scene {
  position: relative;
  height: 500svh;
}
.tt-stage {
  position: sticky;
  top: var(--header-h);
  height: calc(100svh - var(--header-h));
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  align-items: center;
  gap: var(--sp-6);
}
/* the title shares a narrow column with the bus: sized to stay on two lines */
.tt-stage .tt-title {
  max-width: none;
  font-size: clamp(2rem, 1.1rem + 1.6vw, 2.75rem);
}
.tt-stack { margin-top: var(--sp-5); }
.tt-intro--stage { margin: 0 0 var(--sp-5); }

/* all five articles share one cell; the active one shows */
.tt-stack { display: grid; }
.tt-feature {
  grid-area: 1 / 1;
  opacity: 0;
  transform: translateY(16px);
  visibility: hidden;
  /* fade out, then drop from the paint so the stacked blocks never cover each other */
  transition:
    opacity var(--t-reveal) var(--ease),
    transform var(--t-reveal) var(--ease),
    visibility 0s linear var(--t-reveal);
}
.tt-feature.is-active {
  opacity: 1;
  transform: none;
  visibility: visible;
  transition:
    opacity var(--t-reveal) var(--ease),
    transform var(--t-reveal) var(--ease),
    visibility 0s linear 0s;
}

.tt-progress {
  position: relative;
  width: min(240px, 100%);
  height: 6px;
  margin-top: var(--sp-6);
  overflow: hidden;
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
}
.tt-progress-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--wb-green);
  transform-origin: 0 50%;
}

/* the bus is the dominant thing, sized to its column: at 82% of the column the widest pose
   (the 3/4 views, about 1.2 x the length with perspective) still sits inside the page margin */
.tt-bus {
  min-width: 0;
  --bus-fill: 82cqi;
}

@media (max-width: 767px) {
  .tt-scene { height: 300svh; }
  .tt-stage { align-content: safe center; }
  .tt-bus {
    --bus-fill: 82cqi;
    --bus-stage-h: 0.64;
  }
  .tt-stage .tt-feature-title { font-size: 1.375rem; }
  .tt-stage .tt-feature-text { font-size: var(--fs-body); }
  .tt-stack { margin-top: var(--sp-3); }
  .tt-intro--stage { margin-bottom: var(--sp-3); font-size: var(--fs-body); }
  .tt-stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: center;
    gap: var(--sp-4);
  }
  .tt-bus { grid-row: 1; }
  .tt-copy { grid-row: 2; }
  .tt-progress { margin-top: var(--sp-4); }
}

/* ── static rows ── */
.tt-rows {
  display: grid;
  gap: var(--sp-8);
  margin-top: var(--sp-7);
}
.tt-row {
  display: grid;
  grid-template-columns: 5fr 7fr;
  align-items: center;
  gap: var(--sp-6);
}
.tt-row.is-flip .tt-row-copy { order: 2; }
.tt-row-bus { min-width: 0; }

@media (max-width: 767px) {
  .tt-row,
  .tt-row.is-flip {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-4);
  }
  .tt-row-bus { order: -1; }
  .tt-row.is-flip .tt-row-copy { order: 0; }
}

/* ── entrance: heading, then text, then the bus; only once the script has armed it ── */
.tt-rise {
  transition:
    opacity var(--t-reveal) var(--ease) calc(var(--d, 0) * 75ms),
    transform var(--t-reveal) var(--ease) calc(var(--d, 0) * 75ms);
}
.tt.is-armed:not(.is-in) .tt-rise {
  opacity: 0;
  transform: translateY(24px);
}

@media (prefers-reduced-motion: reduce) {
  .tt-rise,
  .tt-feature,
  .tt-feature.is-active { transition: none; }
  .tt.is-armed:not(.is-in) .tt-rise { opacity: 1; transform: none; }
}
</style>
