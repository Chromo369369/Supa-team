<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { navigateTo, useNuxtApp } from '#imports'
import LedBoard from '~/components/ui/LedBoard.vue'
import BusDriveBy, { type BusMode } from '~/components/ui/BusDriveBy.vue'
import { useMotionPrefs } from '~/composables/usePointer'
import { checkSession } from '~/composables/checkSession'

const props = withDefaults(defineProps<{ tone?: 'ground' | 'ink' }>(), { tone: 'ground' })

const IDLE_MESSAGES = ['WANDERBUS', 'TAP TO BOARD']
const SIGN_INTERVAL = 3000
const WAVE_AT = 900 // the bus has stopped (BusDriveBy drive-in time)
const WAVE_BEAT = 230 // pause at the pole before the doors close
const SAFETY = 3600 // go anyway if a `done` never arrives
const SESSION_WAIT = 1500 // don't hold the user on a slow auth call

const { reducedMotion } = useMotionPrefs()
// Captured in setup so the tap handler can call checkSession inside the Nuxt context.
const nuxtApp = useNuxtApp()

const boarding = ref(false)
const busMode = ref<BusMode>('arrive')
const waving = ref(false)
const announce = ref('')
const wide = ref(false)

const messages = computed(() => (boarding.value ? ['BOARDING'] : IDLE_MESSAGES))
const pitch = computed(() => (wide.value ? 4 : 3))

let timers: ReturnType<typeof setTimeout>[] = []
let sessionCheck: Promise<boolean> | null = null
let leaving = false
let mqWide: MediaQueryList | null = null
const syncWide = () => { wide.value = !!mqWide?.matches }

function at(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms))
}

function readSession(): Promise<boolean> {
  if (!sessionCheck) {
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SESSION_WAIT))
    sessionCheck = Promise.race([nuxtApp.runWithContext(() => checkSession()).catch(() => false), timeout])
  }
  return sessionCheck
}

async function go() {
  if (leaving) return
  leaving = true
  timers.forEach(clearTimeout)
  timers = []
  window.removeEventListener('keydown', onKey)
  const hasSession = await readSession()
  await navigateTo(hasSession ? '/home' : '/register')
}

function board() {
  // A second tap while the bus is on its way completes it, never queues it.
  if (boarding.value) {
    go()
    return
  }
  boarding.value = true
  announce.value = 'Boarding…'
  readSession()

  if (reducedMotion.value) {
    go()
    return
  }

  busMode.value = 'arrive'
  waving.value = false
  window.addEventListener('keydown', onKey)
  at(WAVE_AT, () => { waving.value = true })
  at(SAFETY, go)
}

function onBusDone(mode: BusMode) {
  if (mode === 'arrive') at(WAVE_BEAT, () => { busMode.value = 'depart' })
  else if (mode === 'depart') go()
}

const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
function onKey(e: KeyboardEvent) {
  if (e.repeat || IGNORED_KEYS.has(e.key)) return
  e.preventDefault()
  go()
}

onMounted(() => {
  mqWide = window.matchMedia('(min-width: 992px)')
  syncWide()
  mqWide.addEventListener?.('change', syncWide)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  window.removeEventListener('keydown', onKey)
  mqWide?.removeEventListener?.('change', syncWide)
})
</script>

<template>
  <div class="stop" :class="[`stop--${props.tone}`, { 'is-boarding': boarding }]">
    <div class="stop-scene">
      <div class="stop-bay">
        <svg class="stop-marking" aria-hidden="true" focusable="false"><line x1="0" y1="2" x2="100%" y2="2" /></svg>
        <BusDriveBy
          v-if="boarding && !reducedMotion"
          class="stop-bus"
          :mode="busMode"
          label="WANDERBUS"
          :mood="waving ? 'wave' : null"
          @done="onBusDone"
        />
      </div>

      <div class="stop-pole">
        <button
          type="button"
          class="stop-sign"
          aria-label="Board WanderBus"
          @click="board"
        >
          <LedBoard :messages="messages" badge="" :pitch="pitch" :interval="SIGN_INTERVAL" class="stop-led" />
        </button>
        <svg class="stop-post" viewBox="0 0 24 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <rect class="stop-post-bar" x="9" y="0" width="6" height="200" />
        </svg>
        <svg class="stop-panel" viewBox="0 0 24 40" aria-hidden="true" focusable="false">
          <rect class="stop-panel-box" x="1" y="1" width="22" height="38" rx="3" />
          <rect class="stop-panel-line" x="5" y="7" width="14" height="2" rx="1" />
          <rect class="stop-panel-line" x="5" y="13" width="10" height="2" rx="1" />
          <rect class="stop-panel-line" x="5" y="19" width="12" height="2" rx="1" />
          <rect class="stop-panel-line" x="5" y="25" width="8" height="2" rx="1" />
        </svg>
        <svg class="stop-base" viewBox="0 0 24 8" aria-hidden="true" focusable="false">
          <rect class="stop-post-bar" x="2" y="2" width="20" height="6" rx="2" />
        </svg>
      </div>

      <span class="stop-road" aria-hidden="true"></span>
    </div>

    <div class="stop-foot">
      <button v-if="boarding" type="button" class="btn-wb-ghost btn-sm stop-skip" @click="go">
        Skip the ride
        <i class="bi bi-skip-forward-fill" aria-hidden="true"></i>
      </button>
      <!-- No hint on the ink band: there it would sit above the CTA heading like a kicker, and the
           LED already rotates TAP TO BOARD (the button is labelled "Board WanderBus"). -->
      <p v-else-if="props.tone !== 'ink'" class="stop-hint mb-0">
        <i class="bi bi-hand-index" aria-hidden="true"></i>
        Tap the sign to board
      </p>
    </div>

    <p class="visually-hidden" aria-live="polite">{{ announce }}</p>
  </div>
</template>

<style scoped>
.stop {
  --stop-sign-w: 252px;
  --stop-sign-h: 63px; /* 17 rows × 3 px + 12 px of button padding */
  --stop-post: var(--wb-control);
  --stop-road: var(--wb-line);
  --stop-focus: var(--wb-green);
  --stop-hint: var(--wb-muted);
  width: 100%;
}

.stop--ink {
  --stop-post: var(--wb-on-ink-2);
  --stop-road: color-mix(in srgb, var(--wb-on-ink) 22%, var(--wb-ink));
  --stop-focus: var(--wb-amber);
  --stop-hint: var(--wb-on-ink-2);
}

@media (min-width: 992px) {
  .stop {
    --stop-sign-w: 324px;
    --stop-sign-h: 80px; /* 17 × 4 + 12 */
  }
}

/* The sign hangs over the bay, so the scene is sign + gap + bus tall. */
.stop-scene {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding-top: calc(var(--stop-sign-h) + var(--sp-3));
}

.stop-bay {
  position: relative;
  flex: 0 1 360px;
  min-width: 0;
  aspect-ratio: 320 / 142;
}

.stop-bus {
  position: absolute;
  inset: auto 0 0 0;
}

/* painted bay marking on the kerb */
.stop-marking {
  position: absolute;
  inset: auto 6% 0 6%;
  width: 88%;
  height: 4px;
  overflow: visible;
  opacity: 0.7;
}

.stop-marking line {
  stroke: var(--wb-amber);
  stroke-width: 4;
  stroke-dasharray: 14 10;
}

.stop-pole {
  position: relative;
  flex: none;
  align-self: stretch;
  width: 24px;
  margin-top: calc(-1 * (var(--stop-sign-h) + var(--sp-3)));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stop-sign {
  position: relative;
  z-index: 1;
  align-self: flex-end;
  width: var(--stop-sign-w);
  min-height: 44px;
  padding: 6px;
  border: 0;
  border-radius: var(--r-control);
  background: var(--wb-ink);
  cursor: pointer;
  touch-action: manipulation;
  transition: transform var(--t-micro) var(--ease);
}

.stop--ink .stop-sign {
  background: color-mix(in srgb, var(--wb-on-ink) 12%, var(--wb-ink));
}

.stop-sign:hover { transform: translateY(-2px); }
.stop-sign:active { transform: scale(0.98); }
.is-boarding .stop-sign { cursor: default; transform: none; }

.stop-sign:focus-visible {
  outline: 3px solid var(--stop-focus);
  outline-offset: 3px;
}

.stop-led {
  width: 100%;
  border-radius: calc(var(--r-control) - 4px);
}

.stop-post {
  display: block;
  flex: 1 1 auto;
  width: 24px;
  min-height: 0;
}

.stop-post-bar { fill: var(--stop-post); }

.stop-panel {
  position: absolute;
  left: 0;
  top: calc(var(--stop-sign-h) + var(--sp-5));
  width: 24px;
  height: 40px;
}

.stop-panel-box { fill: var(--stop-post); }
.stop-panel-line { fill: var(--wb-surface); opacity: 0.8; }
.stop--ink .stop-panel-line { fill: var(--wb-ink); }

.stop-base {
  display: block;
  flex: none;
  width: 24px;
  height: 8px;
}

.stop-road {
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: var(--stop-road);
}

.stop-foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 44px;
  margin-top: var(--sp-2);
}

.stop-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-small);
  color: var(--stop-hint);
}

.stop--ink .stop-skip {
  color: var(--wb-on-ink);
}

.stop--ink .stop-skip:hover {
  background: color-mix(in srgb, var(--wb-on-ink) 12%, var(--wb-ink));
  color: var(--wb-on-ink);
}

.stop--ink .stop-skip:focus-visible {
  outline-color: var(--wb-amber);
}
</style>
