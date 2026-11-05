<!--
  ConfettiBurst: a one-shot fan of paper confetti from a point on screen.

  Visual reference: 21st.dev "Motion Confetti" (motiondotdev/motion-confetti). Rebuilt for WanderBus
  from how its preview behaves; no code was downloaded or ported. Pieces shoot up in a fan with
  spin, slow down under air drag, then fall with gravity; ribbons flutter (rotateX) and squares
  wobble (rotateY) and sway as they drop, fading out near the end.

  About 60 pooled DOM pieces, animated with WAAPI on transform and opacity only, coloured from
  --wb-green, --wb-amber and the --cat-* tokens. A fixed, pointer-events:none overlay teleported to
  <body> (client only), aria-hidden. Under reduced motion fire() does nothing.

  API
    fire({ x, y })   exposed; client coordinates of the burst origin
    count            number of pooled pieces (default 60)
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMotionPrefs } from '~/composables/usePointer'

const props = withDefaults(defineProps<{ count?: number }>(), { count: 60 })

const COLOURS = [
    'var(--wb-green)', 'var(--wb-amber)', 'var(--cat-food)', 'var(--cat-nature)',
    'var(--cat-heritage)', 'var(--cat-art)', 'var(--cat-shopping)', 'var(--cat-challenge)'
]
/** Half-angle of the fan, degrees either side of straight up. */
const FAN = 55
const GRAVITY = 1700
const FRAMES = 18

const { reducedMotion } = useMotionPrefs()
const mounted = ref(false)
const pieces: (HTMLElement | null)[] = []
const running: (Animation | null)[] = []
function setPiece(i: number, el: unknown) { pieces[i] = (el as HTMLElement) ?? null }

/** Ribbons on every third piece, squares otherwise. */
const kindOf = (i: number) => (i % 3 === 0 ? 'ribbon' : 'square')

onMounted(() => { mounted.value = true })
onBeforeUnmount(() => {
    running.forEach((a) => a?.cancel())
    running.length = 0
})

function fire({ x, y }: { x: number; y: number }) {
    if (reducedMotion.value || typeof window === 'undefined') return
    const rand = Math.random
    pieces.forEach((el, i) => {
        if (!el || typeof el.animate !== 'function') return
        running[i]?.cancel()
        const ribbon = kindOf(i) === 'ribbon'
        const angle = ((-90 + (rand() * 2 - 1) * FAN) * Math.PI) / 180
        const speed = 700 + rand() * 700
        const vx = Math.cos(angle) * speed
        const vy = Math.sin(angle) * speed
        // Air drag: ribbons catch more air, so they slow sooner and fall slower.
        const drag = ribbon ? 2.8 : 2.1
        const spin = (rand() * 2 - 1) * 720
        const flutter = 300 + rand() * 420
        const swayRate = 5 + rand() * 5
        const swayAmp = ribbon ? 16 : 9
        const phase = rand() * Math.PI * 2
        const x0 = x + (rand() * 2 - 1) * 6
        const y0 = y + (rand() * 2 - 1) * 6
        const duration = 1500 + rand() * 900
        const frames: Keyframe[] = []
        for (let k = 0; k <= FRAMES; k++) {
            const f = k / FRAMES
            const t = (f * duration) / 1000
            const decay = 1 - Math.exp(-drag * t)
            const px = (vx / drag) * decay
            const py = (GRAVITY / drag) * t + ((vy - GRAVITY / drag) / drag) * decay
            const sway = Math.sin(t * swayRate + phase) * swayAmp * Math.min(1, t * 2)
            const turn = ribbon ? `rotateX(${(flutter * t).toFixed(1)}deg)` : `rotateY(${(flutter * t * 0.8).toFixed(1)}deg)`
            frames.push({
                transform: `translate3d(${(x0 + px + sway).toFixed(1)}px, ${(y0 + py).toFixed(1)}px, 0) rotate(${(spin * t).toFixed(1)}deg) ${turn}`,
                opacity: f < 0.7 ? 1 : Math.max(0, 1 - (f - 0.7) / 0.3)
            })
        }
        running[i] = el.animate(frames, { duration, easing: 'linear', fill: 'forwards' })
    })
}

defineExpose({ fire })
</script>

<template>
    <Teleport v-if="mounted" to="body">
        <div class="confetti" aria-hidden="true">
            <span
                v-for="i in props.count"
                :key="i"
                :ref="(el) => setPiece(i - 1, el)"
                class="confetti-piece"
                :class="`confetti-piece--${kindOf(i - 1)}`"
                :style="{ background: COLOURS[(i - 1) % COLOURS.length] }"
            ></span>
        </div>
    </Teleport>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  z-index: 1090;
  overflow: hidden;
  pointer-events: none;
}

.confetti-piece {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  will-change: transform, opacity;
}

.confetti-piece--square {
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 1.5px;
}

.confetti-piece--ribbon {
  width: 5px;
  height: 15px;
  margin: -7.5px 0 0 -2.5px;
  border-radius: 1px;
}
</style>
