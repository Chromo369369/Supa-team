<script setup lang="ts">
import { computed } from 'vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'
// @ts-ignore: plain JS helper shared with LedBoard
import { ledDots, ledTextWidth } from '~/utils/ledFont'

const props = withDefaults(defineProps<{
  rotation?: { x: number; y: number }
  doorOpen?: boolean
  sign?: string
  size?: number
  ground?: boolean
}>(), {
  rotation: () => ({ x: -12, y: -24 }),
  doorOpen: false,
  sign: 'WANDERBUS',
  size: 420,
  ground: true,
})

/* ── viewBox units: length 320, width 112, height 136 (body to 118, wheels below) ── */
const L = 320
const W = 112
const H = 136

const boxStyle = computed(() => ({
  transform: `rotateX(${props.rotation.x}deg) rotateY(${props.rotation.y}deg)`,
}))

// Seen from below the horizon or from above, the ground patch shrinks a little.
const groundStyle = computed(() => {
  const tilt = Math.min(1, Math.abs(props.rotation.x) / 90)
  return { opacity: String(0.5 - tilt * 0.25), transform: `scaleX(${1 - tilt * 0.3})` }
})

/* ── LED sign on the front: dots fitted into an 88 x 13 panel ── */
const SIGN = { x: 10, y: 8, w: 92, h: 19 }
const led = computed(() => {
  const text = String(props.sign || '').toUpperCase()
  const cols = Math.max(1, ledTextWidth(text) as number)
  const s = Math.min((SIGN.w - 6) / cols, (SIGN.h - 5) / 7)
  const x0 = SIGN.x + (SIGN.w - cols * s) / 2
  const y0 = SIGN.y + (SIGN.h - 7 * s) / 2
  const dots = (ledDots(text) as [number, number][]).map(([c, r]) => ({ cx: x0 + (c + 0.5) * s, cy: y0 + (r + 0.5) * s }))
  return { dots, r: s * 0.42 }
})

const WINDOWS = [16, 70, 124, 178]
const WHEELS = [70, 215]

/* roof: 3 rows along the length, 2 across; front of the bus is on the right */
const SEAT_COLOURS = [
  'var(--wb-green)', 'var(--wb-amber)', 'var(--cat-heritage)',
  'var(--cat-art)', 'var(--cat-nature)', 'var(--cat-challenge)',
]
const seats = [0, 1, 2].flatMap((col) =>
  [0, 1].map((row) => ({ x: 58 + col * 80, y: 14 + row * 44, color: SEAT_COLOURS[col * 2 + row]! })),
)

const STAMPS = [
  { kind: 'ring', x: 26, y: 78, rot: -12, fill: 'var(--wb-amber-tint)', ink: 'var(--wb-amber-ink)' },
  { kind: 'tag', x: 58, y: 72, rot: 8, fill: 'var(--cat-heritage-tint)', ink: 'var(--cat-heritage)' },
  { kind: 'ring', x: 88, y: 84, rot: 14, fill: 'var(--cat-art-tint)', ink: 'var(--cat-art)' },
]

const rootStyle = computed(() => ({ maxWidth: `${props.size / 0.8}px` }))
</script>

<template>
  <div class="b3d" :style="rootStyle" aria-hidden="true">
    <div class="b3d-stage">
      <span v-if="ground" class="b3d-ground" :style="groundStyle"></span>
      <div class="b3d-box" :style="boxStyle">
        <!-- sides: A faces the viewer at y = 0, B is its mirror on the far side -->
        <div
          v-for="side in (['a', 'b'] as const)"
          :key="side"
          class="b3d-face b3d-side"
          :class="`b3d-side--${side}`"
        >
          <svg :viewBox="`0 0 ${L} ${H}`" focusable="false" aria-hidden="true">
            <g :transform="side === 'b' ? `translate(${L} 0) scale(-1 1)` : undefined">
              <rect class="b3d-body" x="0" y="0" :width="L" height="118" rx="5" />
              <rect class="b3d-roofline" x="0" y="0" :width="L" height="5" />
              <rect class="b3d-skirt" x="0" y="100" :width="L" height="9" />
              <!-- windows -->
              <rect v-for="wx in WINDOWS" :key="wx" class="b3d-ink" :x="wx" y="30" width="48" height="40" rx="4" />
              <!-- doorway with two sliding panels, clipped by the frame -->
              <rect class="b3d-ink" x="236" y="26" width="36" height="88" rx="2" />
              <svg x="237" y="27" width="34" height="86" viewBox="0 0 34 86" overflow="hidden">
                <g class="b3d-door b3d-door-l" :class="{ 'is-open': side === 'b' && doorOpen }">
                  <rect class="b3d-door-panel" x="0" y="0" width="17" height="86" />
                  <rect class="b3d-ink" x="3" y="5" width="11" height="40" rx="1.5" />
                </g>
                <g class="b3d-door b3d-door-r" :class="{ 'is-open': side === 'b' && doorOpen }">
                  <rect class="b3d-door-panel" x="17" y="0" width="17" height="86" />
                  <rect class="b3d-ink" x="20" y="5" width="11" height="40" rx="1.5" />
                </g>
              </svg>
              <!-- front quarter window, wrapping round to the windscreen -->
              <path class="b3d-ink" d="M280 26 H312 Q320 26 320 34 V92 H280 Z" />
              <!-- lights at the corners -->
              <rect class="b3d-head" x="312" y="96" width="8" height="8" rx="1.5" />
              <rect class="b3d-tail" x="0" y="94" width="5" height="11" rx="1" />
              <!-- wheels: discs on the face -->
              <g v-for="cx in WHEELS" :key="cx">
                <circle class="b3d-arch" :cx="cx" cy="116" r="21" />
                <circle class="b3d-ink" :cx="cx" cy="116" r="18" />
                <circle class="b3d-hub" :cx="cx" cy="116" r="8" />
                <circle class="b3d-ink" :cx="cx" cy="116" r="2" />
              </g>
            </g>
            <!-- the mascot rides in window 2 (outside the mirror so it never flips) -->
            <WanderMascot v-if="side === 'a'" :x="WINDOWS[1]! + 6" y="34" :size="36" />
          </svg>
        </div>

        <!-- front -->
        <div class="b3d-face b3d-end b3d-front">
          <svg :viewBox="`0 0 ${W} ${H}`" focusable="false" aria-hidden="true">
            <rect class="b3d-ink" x="4" y="116" width="16" height="20" rx="3" />
            <rect class="b3d-ink" :x="W - 20" y="116" width="16" height="20" rx="3" />
            <rect class="b3d-body" x="0" y="0" :width="W" height="118" rx="5" />
            <rect class="b3d-roofline" x="0" y="0" :width="W" height="5" />
            <!-- LED sign -->
            <rect class="b3d-ink" :x="SIGN.x" :y="SIGN.y" :width="SIGN.w" :height="SIGN.h" rx="2" />
            <circle v-for="(d, i) in led.dots" :key="i" class="b3d-led" :cx="d.cx" :cy="d.cy" :r="led.r" />
            <!-- windscreen with the driver on the right -->
            <rect class="b3d-ink" x="8" y="32" width="96" height="56" rx="6" />
            <WanderMascot x="62" y="50" :size="30" mood="happy" />
            <rect class="b3d-skirt" x="0" y="100" :width="W" height="9" />
            <circle class="b3d-head" cx="18" cy="96" r="6" />
            <circle class="b3d-head" :cx="W - 18" cy="96" r="6" />
            <rect class="b3d-grille" x="36" y="110" width="40" height="5" rx="2.5" />
          </svg>
        </div>

        <!-- back -->
        <div class="b3d-face b3d-end b3d-back">
          <svg :viewBox="`0 0 ${W} ${H}`" focusable="false" aria-hidden="true">
            <rect class="b3d-ink" x="4" y="116" width="16" height="20" rx="3" />
            <rect class="b3d-ink" :x="W - 20" y="116" width="16" height="20" rx="3" />
            <rect class="b3d-body" x="0" y="0" :width="W" height="118" rx="5" />
            <rect class="b3d-roofline" x="0" y="0" :width="W" height="5" />
            <rect class="b3d-ink" x="10" y="14" width="92" height="44" rx="5" />
            <!-- passport-stamp stickers -->
            <g v-for="(st, i) in STAMPS" :key="i" :transform="`rotate(${st.rot} ${st.x} ${st.y})`">
              <template v-if="st.kind === 'ring'">
                <circle :cx="st.x" :cy="st.y" r="11" :fill="st.fill" />
                <circle :cx="st.x" :cy="st.y" r="7.5" fill="none" :stroke="st.ink" stroke-width="2" />
                <path :d="`M${st.x - 4} ${st.y} l3 3 l5 -6`" fill="none" :stroke="st.ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </template>
              <template v-else>
                <rect :x="st.x - 13" :y="st.y - 8" width="26" height="16" rx="3" :fill="st.fill" />
                <rect :x="st.x - 9" :y="st.y - 3" width="18" height="2.5" rx="1" :fill="st.ink" />
                <rect :x="st.x - 9" :y="st.y + 1.5" width="11" height="2.5" rx="1" :fill="st.ink" />
              </template>
            </g>
            <rect class="b3d-skirt" x="0" y="100" :width="W" height="9" />
            <rect class="b3d-tail" x="6" y="90" width="9" height="14" rx="2" />
            <rect class="b3d-tail" :x="W - 15" y="90" width="9" height="14" rx="2" />
            <rect class="b3d-grille" x="38" y="110" width="36" height="5" rx="2.5" />
          </svg>
        </div>

        <!-- roof, hatch off: the seats from above, front to the right -->
        <div class="b3d-face b3d-cap b3d-roof">
          <svg :viewBox="`0 0 ${L} ${W}`" focusable="false" aria-hidden="true">
            <rect class="b3d-body" x="0" y="0" :width="L" :height="W" rx="6" />
            <rect class="b3d-floor" x="10" y="8" :width="L - 20" :height="W - 16" rx="6" />
            <rect class="b3d-ink" x="292" y="14" width="14" height="84" rx="4" />
            <g v-for="(seat, i) in seats" :key="i">
              <rect class="b3d-seat" :x="seat.x" :y="seat.y" width="56" height="40" rx="7" />
              <rect class="b3d-seat-back" :x="seat.x" :y="seat.y" width="9" height="40" rx="4" />
              <!-- Turned 180° on its own centre: the roof's SVG y runs side B to side A, so with side B toward you ({ x: -74, y: -180 }) it points up the screen; seats and dash keep the real layout. -->
              <g :transform="`rotate(180 ${seat.x + 31} ${seat.y + 20})`">
                <WanderMascot :x="seat.x + 14" :y="seat.y + 3" :size="34" mood="happy" :color="seat.color" />
              </g>
            </g>
          </svg>
        </div>

        <!-- base -->
        <div class="b3d-face b3d-cap b3d-base"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.b3d {
  /* the length is 80% of this box, so the widest 3/4 view still fits */
  container-type: inline-size;
  width: 100%;
  margin-inline: auto;
  pointer-events: none;
  user-select: none;
}

.b3d-stage {
  --bus-l: var(--bus-fill, 80cqi);
  --bus-w: calc(var(--bus-l) * 0.35);
  --bus-h: calc(var(--bus-l) * 0.425);
  position: relative;
  /* a parent may trim the empty space above and below the bus with --bus-stage-h */
  height: calc(var(--bus-l) * var(--bus-stage-h, 0.86));
  perspective: calc(var(--bus-l) * 3.2);
  perspective-origin: 50% 40%;
}

.b3d-ground {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--bus-l) * 1.02);
  height: calc(var(--bus-l) * 0.12);
  margin-left: calc(var(--bus-l) * -0.51);
  margin-top: calc(var(--bus-h) * 0.36);
  border-radius: 50%;
  background: var(--wb-ink);
  filter: blur(calc(var(--bus-l) * 0.03));
  transform-origin: 50% 50%;
}

.b3d-box {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--bus-l);
  height: var(--bus-h);
  margin-left: calc(var(--bus-l) / -2);
  margin-top: calc(var(--bus-h) / -2);
  transform-style: preserve-3d;
  will-change: transform;
}

.b3d-face {
  position: absolute;
  left: 50%;
  top: 50%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.b3d-face > svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.b3d-side { width: var(--bus-l); height: var(--bus-h); }
.b3d-end { width: var(--bus-w); height: var(--bus-h); }
.b3d-cap { width: var(--bus-l); height: var(--bus-w); }

.b3d-side--a { transform: translate(-50%, -50%) translateZ(calc(var(--bus-w) / 2)); }
.b3d-side--b { transform: translate(-50%, -50%) rotateY(180deg) translateZ(calc(var(--bus-w) / 2)); }
.b3d-front { transform: translate(-50%, -50%) rotateY(90deg) translateZ(calc(var(--bus-l) / 2)); }
.b3d-back { transform: translate(-50%, -50%) rotateY(-90deg) translateZ(calc(var(--bus-l) / 2)); }
.b3d-roof { transform: translate(-50%, -50%) rotateX(90deg) translateZ(calc(var(--bus-h) / 2)); }
/* the base sits under the body (118 of 136 units), not under the wheels */
.b3d-base {
  transform: translate(-50%, -50%) rotateX(-90deg) translateZ(calc(var(--bus-h) * 50 / 136));
  background: var(--wb-ink);
  border-radius: calc(var(--bus-l) * 0.015);
}

/* ── paint ── */
.b3d-body { fill: var(--wb-green); }
.b3d-roofline { fill: color-mix(in srgb, var(--wb-on-ink) 22%, var(--wb-green)); }
.b3d-skirt { fill: var(--wb-green-hover); }
.b3d-ink { fill: var(--wb-ink); }
.b3d-arch { fill: color-mix(in srgb, var(--wb-ink) 70%, var(--wb-green)); }
.b3d-hub { fill: var(--wb-surface-2); }
.b3d-head { fill: var(--wb-amber); }
.b3d-tail { fill: var(--wb-danger); }
.b3d-led { fill: var(--wb-amber); }
.b3d-grille { fill: color-mix(in srgb, var(--wb-ink) 60%, var(--wb-green)); }
.b3d-door-panel { fill: var(--wb-green-hover); }
.b3d-floor { fill: var(--wb-surface-2); }
.b3d-seat { fill: var(--wb-surface); }
.b3d-seat-back { fill: var(--wb-control); }

.b3d-door {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform var(--t-ui) var(--ease);
}
.b3d-door-l.is-open { transform: translateX(-15px); }
.b3d-door-r.is-open { transform: translateX(15px); }

@media (prefers-reduced-motion: reduce) {
  .b3d-door { transition: none; }
}
</style>
