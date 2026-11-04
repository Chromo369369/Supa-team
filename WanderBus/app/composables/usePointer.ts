// Shared pointer + motion preferences (design.md §3.1).
//
// One `pointermove` listener on window serves every mascot. It is throttled with
// requestAnimationFrame, added when the first consumer mounts and removed when the last one
// unmounts. Nothing touches `window` on the server.
//
//   const prefs = useMotionPrefs()                      // { reducedMotion, coarsePointer }
//   const pointer = usePointer({ active: () => wantsIt }) // { x, y, hasMoved, lastMove, idle }
//
// `idle` turns true after POINTER_IDLE_MS without movement and back to false on the next move.
// Touch pointers are ignored, so a finger drag never steers anyone's gaze.

import { computed, onBeforeUnmount, onMounted, readonly, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export const POINTER_IDLE_MS = 20_000

/* ── pointer state (module level, shared) ── */
const x = ref(0)
const y = ref(0)
const hasMoved = ref(false)
const lastMove = ref(0)
const idle = ref(false)

let pointerUsers = 0
let frame = 0
let pendingX = 0
let pendingY = 0
let idleTimer: ReturnType<typeof setTimeout> | undefined

function flush() {
  frame = 0
  x.value = pendingX
  y.value = pendingY
  hasMoved.value = true
  lastMove.value = performance.now()
  if (idle.value) idle.value = false
}

function onMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  pendingX = e.clientX
  pendingY = e.clientY
  if (!frame) frame = requestAnimationFrame(flush)
}

// One timer, re-armed for the remaining time instead of on every move.
function armIdle(delay = POINTER_IDLE_MS) {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    const quiet = performance.now() - lastMove.value
    if (quiet >= POINTER_IDLE_MS) {
      idle.value = true
      armIdle()
    } else {
      armIdle(POINTER_IDLE_MS - quiet)
    }
  }, delay)
}

function startPointer() {
  lastMove.value = performance.now()
  idle.value = false
  window.addEventListener('pointermove', onMove, { passive: true })
  armIdle()
}

function stopPointer() {
  window.removeEventListener('pointermove', onMove)
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  clearTimeout(idleTimer)
  idle.value = false
}

/* ── motion preferences (module level, shared) ── */
const reducedMotion = ref(false)
const coarsePointer = ref(false)

let prefUsers = 0
let mqReduce: MediaQueryList | null = null
let mqCoarse: MediaQueryList | null = null
const syncReduce = () => { reducedMotion.value = !!mqReduce?.matches }
const syncCoarse = () => { coarsePointer.value = !!mqCoarse?.matches }

function acquirePrefs() {
  if (prefUsers++ > 0) return
  if (typeof window === 'undefined' || !window.matchMedia) return
  mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  mqCoarse = window.matchMedia('(pointer: coarse)')
  syncReduce()
  syncCoarse()
  mqReduce.addEventListener?.('change', syncReduce)
  mqCoarse.addEventListener?.('change', syncCoarse)
}

function releasePrefs() {
  if (--prefUsers > 0) return
  prefUsers = 0
  mqReduce?.removeEventListener?.('change', syncReduce)
  mqCoarse?.removeEventListener?.('change', syncCoarse)
  mqReduce = mqCoarse = null
}

/** Reduced-motion and coarse-pointer flags, kept live with matchMedia. False on the server. */
export function useMotionPrefs() {
  onMounted(acquirePrefs)
  onBeforeUnmount(releasePrefs)
  return {
    reducedMotion: readonly(reducedMotion),
    coarsePointer: readonly(coarsePointer),
    /** true when pointer-driven effects (gaze, chase) may run */
    canTrack: computed(() => !reducedMotion.value && !coarsePointer.value),
  }
}

interface UsePointerOptions {
  /** Hold the shared listener only while this is true (default true). */
  active?: MaybeRefOrGetter<boolean>
}

/** Live pointer position in client coordinates, shared by every caller. */
export function usePointer(options: UsePointerOptions = {}) {
  const active = options.active ?? true
  const mounted = ref(false)
  let holding = false

  function hold() {
    if (holding) return
    holding = true
    if (pointerUsers++ === 0) startPointer()
  }
  function release() {
    if (!holding) return
    holding = false
    if (--pointerUsers === 0) stopPointer()
  }

  watch(() => mounted.value && toValue(active), on => (on ? hold() : release()))
  onMounted(() => { mounted.value = true })
  onBeforeUnmount(() => {
    mounted.value = false
    release()
  })

  return {
    x: readonly(x),
    y: readonly(y),
    /** false until the first non-touch move since the page loaded */
    hasMoved: readonly(hasMoved),
    /** performance.now() of the last move */
    lastMove: readonly(lastMove),
    /** true after POINTER_IDLE_MS without movement */
    idle: readonly(idle),
  }
}
