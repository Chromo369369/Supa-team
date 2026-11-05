<script lang="ts">
export type Band = 'short' | 'medium' | 'long'

/** Fixed travel-time bands, shared with SpinResults so the belt and the torn ticket agree. */
export function bandFor(minutes: number): Band {
    return minutes <= 20 ? 'short' : minutes <= 40 ? 'medium' : 'long'
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { useMotionPrefs } from '~/composables/usePointer'
import WanderMascot from '~/components/ui/WanderMascot.vue'
import type { MascotMood } from '~/components/ui/WanderMascot.vue'

interface TicketOption { letter: string; minutes: number }

const props = withDefaults(defineProps<{
    options: TicketOption[]
    label?: string
    caption?: string
    speed?: number
    autoplay?: boolean
    interval?: number
    flyTo?: () => DOMRect | null
}>(), {
    label: 'Pick your ticket',
    caption: 'Point at or tap a ticket to lift it off the belt, then pick it to take it.',
    speed: 26,
    autoplay: false,
    interval: 3000,
    flyTo: undefined
})

const emit = defineEmits<{ choose: [index: number] }>()

const SPACING = 1.35
const CURVE = 0.95
const BAND = 1.0
const TILT = 0.8
/** Ticket depth / width, seen from above. */
const ASPECT = 0.6
/** Projected ticket height / width. */
const FACE = TILT * ASPECT
/** A loop shorter than this many tickets is a disc, not a belt. */
const MIN_SLOTS = 6
const SLAT = 0.34
const LIFT_Y = -12
const LIFT_SCALE = 0.08
const BACK_SHADE = 0.15
const CHIP_ROOM = 34
const HOLD = 1400
const MIN_HIT = 22
const RUN = 0
const SEEK = 1
const DRAG = 2

const BANDS: Record<Band, { label: string; range: string; fill: string; ink: string }> = {
    short: { label: 'Short', range: '≤ 20 min', fill: 'var(--wb-green)', ink: 'var(--wb-on-ink)' },
    medium: { label: 'Medium', range: '21–40 min', fill: 'var(--wb-amber)', ink: 'var(--wb-ink)' },
    long: { label: 'Long', range: '> 40 min', fill: 'var(--wb-ink)', ink: 'var(--wb-on-ink)' }
}
const BAND_ORDER: Band[] = ['short', 'medium', 'long']

// The ticket, drawn top-down in a 100 × 60 box: paper with two notches at the perforation (x = 70).
const PAPER = 'M7 0H64A6 6 0 0 0 76 0H93Q100 0 100 7V53Q100 60 93 60H76A6 6 0 0 0 64 60H7Q0 60 0 53V7Q0 0 7 0Z'
const STUB = 'M76 0H93Q100 0 100 7V53Q100 60 93 60H76A6 6 0 0 0 70 54V6A6 6 0 0 0 76 0Z'

type Geo = {
    width: number; height: number; d: number; r: number; s: number; l: number; pitch: number; n: number
    kb: number; cx: number; ym: number; a: number; b: number; band: number; slats: number; side: number; edgeTop: number
}
type Point = { x: number; z: number; nx: number; nz: number; tx: number; tz: number }
type Sim = {
    offset: number; v: number; mode: number; target: number
    lift: number[]; vlift: number[]; z: number[]; lane: string[]
    raf: number; last: number; visible: boolean; init: boolean; touched: boolean; l: number; center: number; published: string
    px: number; py: number; inside: boolean; lock: boolean; lockX: number; lockY: number
}

function makeSim(): Sim {
    return { offset: 0, v: 0, mode: RUN, target: 0, lift: [], vlift: [], z: [], lane: [], raf: 0, last: 0, visible: true, init: false, touched: false, l: 0, center: -1, published: '', px: 0, py: 0, inside: false, lock: false, lockX: 0, lockY: 0 }
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

/** Position on the stadium loop. u is arc length; the front lane runs right to left, the back lane left to right. */
function along(g: Geo, u: number): Point {
    const { s, r } = g
    let t = ((u % g.l) + g.l) % g.l
    if (t < s) return { x: s / 2 - t, z: r, nx: 0, nz: 1, tx: -1, tz: 0 }
    t -= s
    const arc = Math.PI * r
    if (t < arc) {
        const f = t / r
        const sin = Math.sin(f)
        const cos = Math.cos(f)
        return { x: -s / 2 - r * sin, z: r * cos, nx: -sin, nz: cos, tx: -cos, tz: -sin }
    }
    t -= arc
    if (t < s) return { x: -s / 2 + t, z: -r, nx: 0, nz: -1, tx: 1, tz: 0 }
    t -= s
    const f = Math.min(Math.PI, t / r)
    const sin = Math.sin(f)
    const cos = Math.cos(f)
    return { x: s / 2 + r * sin, z: -r * cos, nx: sin, nz: -cos, tx: cos, tz: sin }
}

/** Perspective-ish projection: the back lane shrinks to kb and the depth axis is foreshortened by TILT. */
function project(g: Geo, x: number, z: number) {
    const k = g.a + g.b * z
    return { x: g.cx + x * k, y: g.ym + TILT * (g.a * z + (g.b * z * z) / 2), k }
}

function makeGeo(width: number, n: number, d: number, kb: number): Geo {
    const count = Math.max(1, n)
    const l = Math.max(count, MIN_SLOTS) * SPACING * d
    const r = Math.min(CURVE * d, l / (2 * Math.PI))
    const s = Math.max(0, (l - 2 * Math.PI * r) / 2)
    const g: Geo = { width, height: 0, d, r, s, l, pitch: l / count, n: count, kb, cx: width / 2, ym: 0, a: (1 + kb) / 2, b: (1 - kb) / (2 * r), band: BAND * d, slats: Math.max(10, Math.round(l / (SLAT * d))), side: Math.max(3, d * 0.07), edgeTop: 0 }
    let top = Infinity
    let bottom = -Infinity
    let edge = Infinity
    for (let j = 0; j < 120; j++) {
        const p = along(g, (j / 120) * l)
        const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2)
        const plate = project(g, p.x, p.z)
        const half = (plate.k * d * FACE) / 2
        edge = Math.min(edge, rim.y)
        top = Math.min(top, rim.y, plate.y + (LIFT_Y / 100) * half * 2 - half * (1 + LIFT_SCALE) - CHIP_ROOM)
        bottom = Math.max(bottom, rim.y + g.side + d * 0.06, plate.y + half + d * 0.08)
    }
    g.ym = Math.ceil(-top) + 2
    g.height = Math.ceil(bottom - top) + 4
    g.edgeTop = edge + g.ym
    return g
}

function halfSpan(g: Geo) {
    let span = 0
    for (let j = 0; j < 120; j++) {
        const p = along(g, (j / 120) * g.l)
        const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2)
        const plate = project(g, p.x, p.z)
        span = Math.max(span, Math.abs(rim.x - g.cx) + 3, Math.abs(plate.x - g.cx) + (plate.k * g.d * (1 + LIFT_SCALE)) / 2)
    }
    return span
}

function edgePath(g: Geo, offset: number) {
    let d = ''
    const steps = 168
    for (let j = 0; j < steps; j++) {
        const p = along(g, (j / steps) * g.l)
        const q = project(g, p.x + p.nx * offset, p.z + p.nz * offset)
        d += `${j ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`
    }
    return `${d}Z`
}

/** Crescent slat seams across the belt, redrawn every frame so they travel with the tickets (and round the curves). */
function slatPath(g: Geo, offset: number, shift: number) {
    const half = g.band * 0.46
    const pitch = g.l / g.slats
    const bulge = pitch * 0.2
    let d = ''
    for (let j = 0; j < g.slats; j++) {
        const p = along(g, offset + shift + j * pitch)
        const inner = project(g, p.x - p.nx * half, p.z - p.nz * half)
        const outer = project(g, p.x + p.nx * half, p.z + p.nz * half)
        const mid = project(g, p.x + p.tx * bulge, p.z + p.tz * bulge)
        d += `M${inner.x.toFixed(1)} ${inner.y.toFixed(1)}Q${(2 * mid.x - (inner.x + outer.x) / 2).toFixed(1)} ${(2 * mid.y - (inner.y + outer.y) / 2).toFixed(1)} ${outer.x.toFixed(1)} ${outer.y.toFixed(1)}`
    }
    return d
}

function pose(g: Geo, offset: number, i: number) {
    const p = along(g, offset - i * g.pitch)
    const q = project(g, p.x, p.z)
    return { x: q.x, y: q.y, k: q.k, depth: (p.z + g.r) / (2 * g.r) }
}

function centerOf(g: Geo, offset: number) {
    return ((Math.round((offset - g.s / 2) / g.pitch) % g.n) + g.n) % g.n
}

const uid = useId()
const { reducedMotion: reduced } = useMotionPrefs()

const count = computed(() => props.options.length)
const bands = computed(() => props.options.map((o) => bandFor(o.minutes)))
// Always all three, so the colours and the legend agree whichever tickets came up.
const legend = BAND_ORDER.map((band) => ({ band, label: BANDS[band].label, range: BANDS[band].range }))

const sectionEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLDivElement | null>(null)
const beltEl = ref<HTMLDivElement | null>(null)
const seamEl = ref<SVGPathElement | null>(null)
const glintEl = ref<SVGPathElement | null>(null)
const plates: (HTMLElement | null)[] = []
const lifts: (HTMLElement | null)[] = []
const shades: (SVGElement | null)[] = []
const shadows: (HTMLElement | null)[] = []
const anchors: (HTMLElement | null)[] = []
function setRef<T>(list: (T | null)[], i: number, el: unknown) { list[i] = (el as T) ?? null }

const s = makeSim()
let pointer = { id: -1, index: -1, x: 0, y: 0, moved: false, start: 0, lane: 1, lastX: 0, lastT: 0, v: 0 }
let autoActive: number | null = null
let autoLast: number | null = null
let quietFocus = false
let flight: { clone: HTMLElement; anim: Animation; landed: boolean } | null = null

const size = ref({ section: 0, stage: 0 })
const active = ref<number | null>(null)
const paused = ref(false)
const playing = ref(props.autoplay)
const center = ref(0)
/** The ticket on its way to the slot; the belt stops and nothing else can be picked meanwhile. */
const flying = ref<number | null>(null)

const narrow = computed(() => size.value.section > 0 && size.value.section < 480)
const kb = computed(() => (narrow.value ? 0.6 : 0.68))

const geo = computed<Geo | null>(() => {
    if (!size.value.stage || count.value === 0) return null
    const span = halfSpan(makeGeo(1000, count.value, 100, kb.value)) / 100
    const cap = clamp(size.value.section * 0.2, 88, 140)
    const fit = (size.value.stage - 8) / (2 * span)
    return makeGeo(size.value.stage, count.value, Math.round(clamp(fit, 56, cap)), kb.value)
})

const paths = computed(() => {
    const g = geo.value
    return g ? { outer: edgePath(g, g.band / 2), inner: edgePath(g, -g.band / 2), island: edgePath(g, -g.band / 2 - g.d * 0.035) } : null
})

// The belt's driver: WanderMascot on the centre island, half a ticket tall, with its lever beside it.
// Feet sit just in front of the island's middle, so the back lane passes over its head and the
// front lane in front of it. The lever stands off the mascot's right side, short enough that its
// knob (at 20% of the lever's height) meets the right hand at about 65% of the mascot's height.
const crew = computed(() => {
    const g = geo.value
    if (!g) return null
    const size = Math.round(g.d * 0.5)
    const lever = Math.round(size * 0.36)
    const feet = g.ym - g.side * 0.6 + g.d * 0.07
    // Base centred under the right hand (x 87%); the 22° lean puts the knob just past it.
    return { size, lever, x: g.cx - size / 2, y: feet - size * 0.94, leverX: size * 0.88 - lever * 0.3, leverY: size * 0.94 - lever }
})
/** Set on a pick: the mascot cheers while the ticket flies. */
const picked = ref(false)
/** Client centre of the lifted ticket, fed to the mascot's gaze once a frame; null looks ahead. */
const gazeAt = shallowRef<{ x: number; y: number } | null>(null)
const mascotMood = computed<MascotMood>(() => {
    if (reduced.value) return 'idle'
    if (picked.value) return 'happy'
    if (active.value !== null) return 'wave'
    if (paused.value) return 'sleepy'
    return 'idle'
})

const current = computed(() => (active.value === null ? null : props.options[active.value] ?? null))
const currentBand = computed(() => (active.value === null ? null : bands.value[active.value] ?? null))
const roving = computed(() => active.value ?? center.value)

function ticketLabel(option: TicketOption) {
    return `Ticket ${option.letter}, about ${option.minutes} min`
}

function paintTicket(i: number) {
    const g = geo.value
    const button = plates[i]
    if (!g || !button) return
    const q = pose(g, s.offset, i)
    const e = s.lift[i] ?? 0
    button.style.transform = `translate3d(${(q.x - g.d / 2).toFixed(2)}px,${(q.y - (g.d * FACE) / 2).toFixed(2)}px,0) scale(${q.k.toFixed(4)})`
    const z = i === active.value ? 2000 : 100 + Math.round(q.y)
    if (s.z[i] !== z) { s.z[i] = z; button.style.zIndex = String(z) }
    const lane = q.depth >= 0.5 ? 'front' : 'back'
    if (s.lane[i] !== lane) { s.lane[i] = lane; button.dataset.lane = lane }
    const lift = lifts[i]
    if (lift) lift.style.transform = `translateY(${(LIFT_Y * e).toFixed(3)}%) scale(${(1 + LIFT_SCALE * e).toFixed(4)})`
    const shade = shades[i]
    if (shade) shade.style.opacity = (BACK_SHADE * clamp(1 - q.depth, 0, 1) * (1 - 0.7 * clamp(e, 0, 1))).toFixed(3)
    const shadow = shadows[i] // taste-skill-ignore: the ticket's contact shadow on the belt (3D scene), not a UI shadow
    if (shadow) {
        shadow.style.transform = `translate3d(0,${(g.d * FACE * 0.08 * e).toFixed(2)}px,0) scale(${(1 + 0.14 * e).toFixed(3)})`
        shadow.style.opacity = (1 - 0.5 * clamp(e, 0, 1)).toFixed(3)
    }
    const anchor = anchors[i]
    if (anchor) anchor.style.transform = `scale(${(1 / (q.k * (1 + LIFT_SCALE * e))).toFixed(4)})`
}

function paintBelt() {
    const g = geo.value
    if (!g) return
    seamEl.value?.setAttribute('d', slatPath(g, s.offset, 0))
    glintEl.value?.setAttribute('d', slatPath(g, s.offset, -Math.max(1.4, g.d * 0.024)))
    const v = (Math.abs(s.v) < 0.005 ? 0 : s.v).toFixed(2)
    if (v !== s.published) { s.published = v; beltEl.value?.style.setProperty('--belt-v', v) }
    const c = centerOf(g, s.offset)
    if (c !== s.center) { s.center = c; center.value = c }
}

let aimRaf = 0
function aimMascot() {
    aimRaf = 0
    const g = geo.value
    const stage = stageEl.value
    const i = active.value
    if (reduced.value || !g || !stage || i === null) {
        if (gazeAt.value) gazeAt.value = null
        return
    }
    const box = stage.getBoundingClientRect()
    const q = pose(g, s.offset, i)
    const e = s.lift[i] ?? 0
    const x = box.left + q.x
    const y = box.top + q.y + (LIFT_Y / 100) * g.d * FACE * q.k * e
    const was = gazeAt.value
    if (!was || Math.abs(was.x - x) > 0.5 || Math.abs(was.y - y) > 0.5) gazeAt.value = { x, y }
}

function paintAll() {
    for (let i = 0; i < count.value; i++) paintTicket(i)
    paintBelt()
    // At most once a frame, however many paints land in it.
    if (!aimRaf && typeof window !== 'undefined') aimRaf = requestAnimationFrame(aimMascot)
}

/** The frontmost ticket under the point, the lifted one first. Each box is at least 44px. */
function hitTest(px: number, py: number) {
    const g = geo.value
    if (!g) return null
    let best: number | null = null
    let bestY = -Infinity
    for (let i = 0; i < count.value; i++) {
        const q = pose(g, s.offset, i)
        const e = clamp(s.lift[i] ?? 0, 0, 1.2)
        const grow = (1 + LIFT_SCALE * e) * (i === active.value ? 1.1 : 1)
        const rx = Math.max(MIN_HIT, (g.d * q.k * grow) / 2)
        const ry = Math.max(MIN_HIT, (g.d * FACE * q.k * grow) / 2)
        const dx = (px - q.x) / rx
        const dy = (py - (q.y + (LIFT_Y / 100) * g.d * FACE * q.k * e)) / ry
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue
        if (i === active.value) return i
        if (q.y > bestY) { best = i; bestY = q.y }
    }
    return best
}

function tick(now: number) {
    const g = geo.value
    s.raf = 0
    if (!g || !s.visible) { s.last = 0; return }
    const dt = s.last ? clamp((now - s.last) / 1000, 0, 0.25) : 1 / 60
    s.last = now
    // Sub-steps keep the springs stable and the belt on real time when frames arrive late.
    const steps = Math.max(1, Math.ceil(dt / 0.017))
    const h = dt / steps
    const stopped = paused.value || active.value !== null || flying.value !== null
    const cruise = reduced.value ? 0 : Math.max(0, props.speed)
    for (let step = 0; step < steps; step++) {
        if (s.mode === SEEK) {
            const w = 5.6
            s.v += (w * w * (s.target - s.offset) - 2 * w * s.v) * h
            s.offset += s.v * h
            if (Math.abs(s.target - s.offset) < 0.3 && Math.abs(s.v) < 4) { s.offset = s.target; s.v = 0; s.mode = RUN }
        } else if (s.mode === RUN) {
            if (stopped) {
                s.v *= Math.exp(-7.2 * h)
                if (Math.abs(s.v) < 0.02) s.v = 0
            } else {
                let e = s.v - cruise
                if (Math.abs(e) > Math.max(6, cruise * 0.5)) e = Math.sign(e) * Math.max(0, Math.abs(e) * Math.exp(-2.4 * h) - 90 * h)
                else e *= Math.exp(-3.4 * h)
                s.v = cruise + (Math.abs(e) < 0.01 ? 0 : e)
            }
            s.offset += s.v * h
        }
        for (let i = 0; i < count.value; i++) {
            const goal = i === active.value ? 1 : 0
            if (reduced.value) { s.lift[i] = goal; s.vlift[i] = 0; continue }
            const x = s.lift[i] ?? 0
            const v = (s.vlift[i] ?? 0) + (330 * (goal - x) - 23 * (s.vlift[i] ?? 0)) * h
            s.lift[i] = x + v * h
            s.vlift[i] = v
        }
    }
    let busy = s.mode !== RUN || s.v !== 0 || (!stopped && cruise > 0)
    for (let i = 0; i < count.value; i++) {
        const goal = i === active.value ? 1 : 0
        if (Math.abs(goal - (s.lift[i] ?? 0)) < 0.002 && Math.abs(s.vlift[i] ?? 0) < 0.02) { s.lift[i] = goal; s.vlift[i] = 0 }
        else busy = true
    }
    if (s.inside && !s.lock && s.mode === RUN && flying.value === null && pointer.id < 0 && Math.abs(s.v) > 0.3) {
        const hit = hitTest(s.px, s.py)
        if (hit !== null && hit !== active.value) hover(hit)
    }
    paintAll()
    if (busy) s.raf = requestAnimationFrame(tick)
    else s.last = 0
}

function kick() {
    if (typeof window === 'undefined' || s.raf || !s.visible) return
    s.last = 0
    s.raf = requestAnimationFrame(tick)
}

function setActive(next: number | null) {
    if (active.value === next) return
    active.value = next
    kick()
}

function stop() {
    playing.value = false
    s.touched = true
    if (s.mode === SEEK) s.mode = RUN
    const auto = autoActive
    if (auto !== null) {
        autoActive = null
        if (active.value === auto) setActive(null)
    }
}

function seekTo(index: number) {
    const g = geo.value
    if (!g) return
    const base = g.s / 2 + index * g.pitch
    s.target = base + Math.round((s.offset - base) / g.l) * g.l
    if (reduced.value) { s.offset = s.target; s.v = 0; s.mode = RUN; paintAll(); return }
    s.mode = SEEK
    kick()
}

const focusVisible = () => !!stageEl.value?.querySelector('[data-ticket]:focus-visible')

function hover(hit: number | null) {
    const now = active.value
    if (hit === now) {
        // The visitor takes over the ticket autoplay lifted: autoplay stops and the ticket stays up.
        if (hit !== null && autoActive === hit) { autoActive = null; playing.value = false }
        return
    }
    if (hit !== null) { stop(); setActive(hit); return }
    if (now !== null && now !== autoActive && !focusVisible()) setActive(null)
}

/** Take ticket i: FLIP it from the belt to `flyTo()`, then emit choose(i). */
function take(i: number) {
    if (flying.value !== null || !props.options[i]) return
    stop()
    picked.value = true
    setActive(i)
    s.v = 0
    s.mode = RUN
    flying.value = i
    paintBelt()

    const face = lifts[i]
    const from = face?.getBoundingClientRect()
    const to = props.flyTo?.() ?? null
    if (reduced.value || !face || !from || !to || from.width === 0 || to.width === 0 || typeof face.animate !== 'function') {
        land(i)
        return
    }

    // Lay the clone out where it lands (at the belt ticket's own size, scaled to fit the slot) and
    // play it back from the belt: the source's opening keyframes, with a rise and a slight tilt.
    const w = face.offsetWidth
    const h = face.offsetHeight
    const fit = Math.min(to.width / w, to.height / h)
    const cx = to.left + to.width / 2
    const cy = to.top + to.height / 2
    const clone = face.cloneNode(true) as HTMLElement
    clone.querySelector('[data-anchor]')?.remove()
    clone.querySelectorAll<SVGElement>('[data-shade]').forEach((el) => { el.style.opacity = '0' })
    clone.removeAttribute('data-lift')
    clone.classList.add('belt-flight')
    Object.assign(clone.style, {
        position: 'fixed', left: `${cx - w / 2}px`, top: `${cy - h / 2}px`, width: `${w}px`, height: `${h}px`,
        right: 'auto', bottom: 'auto', margin: '0', transform: 'none', zIndex: '1080', pointerEvents: 'none'
    })
    clone.setAttribute('aria-hidden', 'true')
    document.body.appendChild(clone)

    const sx = from.width / w
    const dx = from.left + from.width / 2 - cx
    const dy = from.top + from.height / 2 - cy
    const rise = Math.min(120, Math.abs(dy) * 0.3 + 40)
    const anim = clone.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx})` },
        { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - rise}px) scale(${((sx + fit) / 2) * 1.05}) rotate(${dx > 0 ? -6 : 6}deg)`, offset: 0.5 },
        { transform: `scale(${fit})` }
    ], { duration: 680, easing: 'cubic-bezier(.22,.85,.3,1)', fill: 'forwards' })
    flight = { clone, anim, landed: false }
    anim.onfinish = () => {
        if (!flight || flight.anim !== anim) return
        flight.landed = true
        land(i)
        // The real ticket slides up underneath while the clone fades away.
        const fade = clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out', fill: 'forwards' })
        fade.onfinish = () => clone.remove()
        fade.oncancel = () => clone.remove()
    }
}

function land(i: number) {
    emit('choose', i)
    flying.value = null
}

function go(index: number, focus: boolean) {
    if (count.value === 0 || flying.value !== null) return
    const next = ((index % count.value) + count.value) % count.value
    stop()
    if (focus) plates[next]?.focus({ preventScroll: true })
    setActive(next)
    seekTo(next)
}

function togglePause() {
    stop()
    paused.value = !paused.value
    if (!paused.value && active.value !== null && !focusVisible() && !s.inside) setActive(null)
    kick()
}

watch(() => props.autoplay, (on) => { playing.value = on })

// A new set of tickets: drop the lifted one and repaint.
watch(() => props.options, () => {
    active.value = null
    picked.value = false
    s.lift = []
    s.vlift = []
})

watch([geo, () => props.options, reduced], () => {
    const g = geo.value
    if (!g) return
    if (!s.init) {
        s.init = true
        s.offset = g.s / 2 - Math.min(props.speed * 1.62, g.pitch * 0.45)
        s.v = reduced.value || paused.value ? 0 : props.speed
    } else if (s.l > 0 && s.l !== g.l) {
        const f = g.l / s.l
        s.offset *= f
        s.target *= f
    }
    if (reduced.value) {
        s.v = 0
        if (s.mode !== DRAG) s.mode = RUN
        if (!s.touched) s.offset = g.s / 2
    }
    s.l = g.l
    s.z = []
    s.lane = []
    paintAll()
    kick()
}, { flush: 'post' })

watch([active, paused, flying, reduced, () => props.speed], () => kick())
watch([active, reduced], () => { if (!aimRaf && typeof window !== 'undefined') aimRaf = requestAnimationFrame(aimMascot) })

// Autoplay (off by default): bring one ticket after another to the front and lift it.
watch(
    () => [playing.value, reduced.value, paused.value, flying.value, count.value, props.interval, geo.value !== null] as const,
    ([isPlaying, isReduced, isPaused, isFlying, n, interval, ready], _old, onCleanup) => {
        if (!isPlaying || isReduced || isPaused || isFlying !== null || n === 0 || !ready) return
        let timer = 0
        const show = () => {
            const g = geo.value
            if (!g) return
            const index = autoLast === null ? centerOf(g, s.offset + props.speed * 0.25) : (autoLast + 1) % n
            autoLast = index
            autoActive = index
            setActive(index)
            seekTo(index)
            timer = window.setTimeout(() => {
                if (autoActive === index) {
                    autoActive = null
                    if (active.value === index) setActive(null)
                }
                timer = window.setTimeout(show, Math.max(300, interval - HOLD))
            }, HOLD)
        }
        timer = window.setTimeout(show, autoLast === null ? 1600 : Math.max(300, interval - HOLD))
        onCleanup(() => window.clearTimeout(timer))
    },
    { immediate: true }
)

let resizeObserver: ResizeObserver | null = null
let viewObserver: IntersectionObserver | null = null
let inView = true
function updateVisible() {
    const visible = inView && !document.hidden
    if (visible === s.visible) return
    s.visible = visible
    if (visible) kick()
    else if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0 }
}

onMounted(() => {
    const section = sectionEl.value
    const stage = stageEl.value
    if (section && stage) {
        const measure = () => {
            const next = { section: Math.round(section.clientWidth), stage: Math.round(stage.clientWidth) }
            if (next.section !== size.value.section || next.stage !== size.value.stage) size.value = next
        }
        measure()
        resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(section)
        resizeObserver.observe(stage)
    }
    if (section && typeof IntersectionObserver === 'function') {
        viewObserver = new IntersectionObserver((entries) => { inView = entries.some((entry) => entry.isIntersecting); updateVisible() })
        viewObserver.observe(section)
    }
    document.addEventListener('visibilitychange', updateVisible)
    updateVisible()
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    viewObserver?.disconnect()
    document.removeEventListener('visibilitychange', updateVisible)
    if (s.raf) cancelAnimationFrame(s.raf)
    if (aimRaf) cancelAnimationFrame(aimRaf)
    aimRaf = 0
    s.raf = 0
    s.last = 0
    // A flight that already landed fades out on its own; one cut short goes now.
    if (flight && !flight.landed) { flight.anim.cancel(); flight.clone.remove() }
    flight = null
})

// The Spin button is disabled while searching, which drops focus to the page. Once the tickets
// render (they need a measured width), pick it up without lifting one: that waits for a real
// focus move or the pointer.
watch(geo, (g, old) => {
    if (!g || old) return
    nextTick(() => {
        const focused = document.activeElement
        if (focused && focused !== document.body) return
        quietFocus = true
        plates[roving.value]?.focus({ preventScroll: true })
        quietFocus = false
    })
}, { flush: 'post' })

function local(event: PointerEvent) {
    const box = stageEl.value?.getBoundingClientRect()
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
}

function onPointerDown(event: PointerEvent) {
    const g = geo.value
    if (event.button !== 0 || !g || flying.value !== null) return
    const at = local(event)
    const hit = hitTest(at.x, at.y)
    pointer = { id: event.pointerId, index: hit ?? -1, x: event.clientX, y: event.clientY, moved: false, start: s.offset, lane: at.y >= g.ym ? 1 : -1, lastX: event.clientX, lastT: event.timeStamp, v: 0 }
}

function onPointerMove(event: PointerEvent) {
    const p = pointer
    const stage = stageEl.value
    const g = geo.value
    if (!stage || !g) return
    const at = local(event)
    if (event.pointerType === 'mouse') { s.px = at.x; s.py = at.y; s.inside = true }
    if (p.id === event.pointerId) {
        const dx = event.clientX - p.x
        const now = event.timeStamp
        if (!p.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - p.y)) {
            p.moved = true
            stop()
            setActive(null)
            s.mode = DRAG
            if (stage.isConnected) stage.setPointerCapture(event.pointerId)
        }
        if (p.moved) {
            const v = (event.clientX - p.lastX) / Math.max(1, now - p.lastT)
            p.v = p.v * 0.6 + v * 0.4
            p.lastX = event.clientX
            p.lastT = now
            const scale = p.lane > 0 ? 1 : 1 / g.kb
            s.offset = p.start - p.lane * dx * scale
            s.v = reduced.value ? 0 : -p.lane * p.v * 1000 * scale
            kick()
        }
        return
    }
    if (event.pointerType !== 'mouse' || flying.value !== null) return
    if (s.lock) {
        if (Math.hypot(at.x - s.lockX, at.y - s.lockY) < 4) return
        s.lock = false
    }
    hover(hitTest(at.x, at.y))
}

function finishPointer(event: PointerEvent, cancelled: boolean) {
    const p = pointer
    if (p.id !== event.pointerId) return
    const stage = stageEl.value
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId)
    pointer = { ...p, id: -1 }
    if (s.mode === DRAG) {
        s.mode = RUN
        // Holding still before letting go bleeds the flick away (about 70 ms time constant).
        const carry = Math.exp(-Math.max(0, event.timeStamp - p.lastT) / 70)
        s.v = reduced.value ? 0 : clamp(s.v * carry, -1400, 1400)
        if (event.pointerType === 'mouse') {
            const at = local(event)
            s.lock = true
            s.lockX = at.x
            s.lockY = at.y
        }
        kick()
        return
    }
    if (cancelled || p.moved) return
    const touch = event.pointerType !== 'mouse'
    if (p.index < 0) {
        if (touch && active.value !== null) { stop(); setActive(null) }
        return
    }
    stop()
    // Touch: the first tap lifts the ticket, the second takes it. Mouse: hovering lifted it already.
    if (touch && active.value !== p.index) setActive(p.index)
    else take(p.index)
}

function onPointerLeave(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    s.inside = false
    s.lock = false
    const now = active.value
    if (pointer.id < 0 && flying.value === null && now !== null && now !== autoActive && !focusVisible()) setActive(null)
}

function onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null
    if ((next && stageEl.value?.contains(next)) || flying.value !== null || s.inside) return
    const now = active.value
    if (now !== null && now !== autoActive) setActive(null)
}

function onTicketFocus(i: number) {
    if (quietFocus || pointer.id >= 0) return
    stop()
    setActive(i)
}

// Pointer picks run through finishPointer (with a hit area of at least 44px); this handles Enter and Space.
function onTicketClick(event: MouseEvent, i: number) {
    if (event.detail === 0) take(i)
}

function onKeyDown(event: KeyboardEvent) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key) || count.value === 0) return
    event.preventDefault()
    const own = (event.target as HTMLElement).closest('[data-ticket]')?.getAttribute('data-ticket')
    const from = own != null ? Number(own) : (active.value ?? center.value)
    go(event.key === 'Home' ? 0 : event.key === 'End' ? count.value - 1 : from + (event.key === 'ArrowRight' ? 1 : -1), true)
}
</script>

<template>
    <section ref="sectionEl" class="belt-menu" :data-paused="paused || undefined" :data-active="active ?? ''">
        <ul v-if="legend.length" class="belt-legend" aria-hidden="true">
            <li v-for="entry in legend" :key="entry.band">
                <span class="belt-legend-swatch" :style="{ background: BANDS[entry.band].fill }"></span>
                {{ entry.label }} <span class="num">{{ entry.range }}</span>
            </li>
        </ul>

        <div
            v-if="count > 0"
            ref="stageEl"
            class="belt-stage"
            role="group"
            :aria-label="label"
            aria-roledescription="conveyor belt"
            :style="{ height: `${geo ? geo.height : 220}px` }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="finishPointer($event, false)"
            @pointercancel="finishPointer($event, true)"
            @pointerleave="onPointerLeave"
            @focusout="onFocusOut"
            @keydown="onKeyDown"
        >
            <div ref="beltEl" class="belt-layer" aria-hidden="true">
                <svg
                    v-if="geo && paths"
                    class="belt-svg"
                    :width="geo.width"
                    :height="geo.height"
                    :viewBox="`0 0 ${geo.width} ${geo.height}`"
                    focusable="false"
                >
                    <defs>
                        <filter :id="`${uid}-soft`" x="-10%" y="-30%" width="120%" height="160%">
                            <feGaussianBlur :stdDeviation="(geo.d * 0.06).toFixed(1)" />
                        </filter>
                        <linearGradient :id="`${uid}-island`" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" style="stop-color: var(--island)" />
                            <stop offset="1" style="stop-color: var(--island-low)" />
                        </linearGradient>
                    </defs>
                    <path :d="paths.outer" :transform="`translate(0 ${(geo.side + geo.d * 0.07).toFixed(1)})`" fill="#000" opacity="0.18" :filter="`url(#${uid}-soft)`" />
                    <path :d="`${paths.outer}${paths.inner}`" fill-rule="evenodd" :transform="`translate(0 ${geo.side.toFixed(1)})`" style="fill: var(--belt-side)" />
                    <path :d="`${paths.outer}${paths.inner}`" fill-rule="evenodd" style="fill: var(--belt)" />
                    <path ref="seamEl" fill="none" stroke="#000" stroke-opacity="0.42" :stroke-width="Math.max(1, geo.d * 0.013)" stroke-linecap="round" />
                    <path ref="glintEl" fill="none" stroke="#fff" stroke-opacity="0.14" :stroke-width="Math.max(0.8, geo.d * 0.009)" stroke-linecap="round" />
                    <path :d="paths.outer" fill="none" style="stroke: var(--rail)" :stroke-width="Math.max(2, geo.d * 0.026)" />
                    <path :d="paths.outer" fill="none" stroke="#fff" stroke-opacity="0.55" :stroke-width="Math.max(0.8, geo.d * 0.008)" transform="translate(0 -0.8)" />
                    <path :d="paths.inner" fill="none" style="stroke: var(--rail)" :stroke-width="Math.max(1.6, geo.d * 0.02)" />
                    <path :d="paths.inner" fill="none" stroke="#fff" stroke-opacity="0.4" :stroke-width="Math.max(0.8, geo.d * 0.008)" transform="translate(0 -0.7)" />
                    <path :d="paths.island" style="fill: var(--island-wall)" />
                    <path :d="paths.island" :transform="`translate(0 ${(-geo.side * 0.6).toFixed(1)})`" :style="{ fill: `url(#${uid}-island)` }" />
                    <path :d="paths.island" :transform="`translate(0 ${(-geo.side * 0.6 - 0.6).toFixed(1)})`" fill="none" stroke="#fff" stroke-opacity="0.55" :stroke-width="Math.max(0.8, geo.d * 0.008)" />
                </svg>
            </div>

            <div
                v-if="crew"
                class="belt-crew"
                aria-hidden="true"
                :style="{ transform: `translate3d(${crew.x.toFixed(1)}px, ${crew.y.toFixed(1)}px, 0)` }"
            >
                <WanderMascot
                    class="belt-crew-mascot"
                    :mood="mascotMood"
                    :size="crew.size"
                    :gaze="!reduced && gazeAt !== null"
                    :target="reduced ? null : gazeAt"
                />
                <svg
                    class="belt-lever"
                    :class="{ 'is-pulled': paused }"
                    :width="crew.lever * 0.6"
                    :height="crew.lever"
                    viewBox="0 0 24 40"
                    focusable="false"
                    :style="{ transform: `translate(${crew.leverX.toFixed(1)}px, ${crew.leverY.toFixed(1)}px)` }"
                >
                    <g class="belt-lever-arm">
                        <line x1="12" y1="33" x2="12" y2="9" />
                        <circle cx="12" cy="8" r="5" />
                    </g>
                    <rect x="3" y="31" width="18" height="8" rx="2" />
                </svg>
            </div>

            <template v-if="geo">
                <button
                    v-for="(option, i) in options"
                    :key="option.letter"
                    :ref="(el) => setRef(plates, i, el)"
                    type="button"
                    class="belt-ticket"
                    :class="{ 'theme-sunset': useRewards().isOn('perk-ticket-sunset') }"
                    :data-ticket="i"
                    :data-active="active === i || undefined"
                    :tabindex="i === roving ? 0 : -1"
                    :aria-label="ticketLabel(option)"
                    :aria-describedby="`${uid}-caption`"
                    :aria-current="active === i || undefined"
                    :style="{ width: `${geo.d}px`, height: `${geo.d * FACE}px`, visibility: flying === i ? 'hidden' : undefined }"
                    @focus="onTicketFocus(i)"
                    @click="onTicketClick($event, i)"
                >
                    <span class="belt-ticket-shadow-wrap" aria-hidden="true">
                        <span
                            :ref="(el) => setRef(shadows, i, el)"
                            class="belt-ticket-shadow"
                            :style="{ filter: `blur(${Math.max(2, geo.d * 0.045).toFixed(1)}px)` }"
                        ></span>
                    </span>
                    <span :ref="(el) => setRef(lifts, i, el)" data-lift class="belt-ticket-lift">
                        <svg class="belt-ticket-face" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                            <path :d="PAPER" class="face-paper" />
                            <path :d="STUB" :style="{ fill: BANDS[bands[i] ?? 'short'].fill }" />
                            <line x1="70" y1="10" x2="70" y2="50" class="face-perf" />
                            <text x="35" y="44" class="face-letter">{{ option.letter }}</text>
                            <text x="85" y="41" class="face-mark" :style="{ fill: BANDS[bands[i] ?? 'short'].ink }">?</text>
                            <path :ref="(el) => setRef(shades, i, el)" :d="PAPER" data-shade class="face-shade" />
                            <path :d="PAPER" class="face-edge" />
                        </svg>
                        <span :ref="(el) => setRef(anchors, i, el)" data-anchor class="belt-anchor" aria-hidden="true">
                            <span class="belt-chip" :class="{ 'is-shown': active === i && flying !== i }">
                                <span class="belt-chip-dot" :style="{ background: BANDS[bands[i] ?? 'short'].fill }"></span>
                                Ticket {{ option.letter }}
                                <span class="belt-chip-time">· about <span class="num">{{ option.minutes }}</span> min</span>
                            </span>
                        </span>
                    </span>
                </button>
            </template>
        </div>

        <div v-if="count > 1" class="belt-controls">
            <button type="button" class="belt-control" aria-label="Previous ticket" @click="go((active ?? s.center) - 1, false)">
                <i class="bi bi-chevron-left" aria-hidden="true"></i>
            </button>
            <button type="button" class="belt-control" aria-label="Pause belt" :aria-pressed="paused" @click="togglePause">
                <i :class="['bi', paused ? 'bi-play-fill' : 'bi-pause-fill']" aria-hidden="true"></i>
            </button>
            <button type="button" class="belt-control" aria-label="Next ticket" @click="go((active ?? s.center) + 1, false)">
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
        </div>
        <div v-else-if="count === 1" class="belt-controls">
            <button type="button" class="belt-control" aria-label="Pause belt" :aria-pressed="paused" @click="togglePause">
                <i :class="['bi', paused ? 'bi-play-fill' : 'bi-pause-fill']" aria-hidden="true"></i>
            </button>
        </div>

        <div :id="`${uid}-caption`" class="belt-caption" aria-live="polite">
            <template v-if="current && currentBand">
                <p class="belt-caption-main">Ticket {{ current.letter }} <span class="belt-caption-time">· about <span class="num">{{ current.minutes }}</span> min</span></p>
                <p class="belt-caption-sub">A {{ BANDS[currentBand].label.toLowerCase() }} ride. Click, tap or press Enter to take this ticket.</p>
            </template>
            <p v-else class="belt-caption-sub">{{ caption }}</p>
        </div>
    </section>
</template>

<style scoped>
/* Belt colours, mixed from the ink and paper tokens (the source's theme vars, light only). */
.belt-menu {
  --belt: color-mix(in oklab, var(--wb-ink) 78%, var(--wb-surface));
  --belt-side: color-mix(in oklab, var(--wb-ink) 92%, var(--wb-surface));
  --rail: color-mix(in oklab, var(--wb-muted) 45%, white);
  --island: color-mix(in oklab, var(--wb-muted) 16%, var(--wb-surface));
  --island-low: color-mix(in oklab, var(--wb-muted) 27%, var(--wb-surface));
  --island-wall: color-mix(in oklab, var(--wb-muted) 42%, var(--wb-surface));
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.belt-legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-1) 14px;
  margin: 0 0 var(--sp-2);
  padding: 0;
  font-size: var(--fs-meta);
  color: var(--wb-text-2);
}

.belt-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.belt-legend-swatch {
  width: 14px;
  height: 8px;
  border: 1.5px solid var(--wb-ink);
  border-radius: 3px;
}

.belt-stage {
  position: relative;
  width: 100%;
  overflow-x: clip;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.belt-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.belt-svg {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
}

/* The mascot and its lever: above the island, below every ticket (tickets start at z-index 100). */
.belt-crew {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 50;
  pointer-events: none;
}

.belt-crew-mascot {
  display: block;
}

.belt-lever {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
}

.belt-lever rect {
  fill: var(--wb-ink);
}

.belt-lever line {
  stroke: var(--wb-ink);
  stroke-width: 3.5;
  stroke-linecap: round;
}

.belt-lever circle {
  fill: var(--wb-amber);
  stroke: var(--wb-ink);
  stroke-width: 2;
}

/* Leans right (away from the mascot) while the belt runs, pulled back upright-left while paused. */
.belt-lever-arm {
  transform-box: view-box;
  transform-origin: 12px 34px;
  transform: rotate(22deg);
  transition: transform var(--t-ui) var(--ease-spring);
}

.belt-lever.is-pulled .belt-lever-arm {
  transform: rotate(-10deg);
}

/* One ticket on the belt: positioned and scaled each frame by the sim. */
.belt-ticket {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.belt-ticket:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 4px;
}

.belt-ticket-shadow-wrap {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.5;
}

.belt-ticket-shadow {
  position: absolute;
  inset: 22% 4% -12%;
  border-radius: 8px;
  background: #000;
}

.belt-ticket-lift {
  position: absolute;
  inset: 0;
  display: block;
}

.belt-ticket-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.face-paper {
  fill: var(--wb-surface);
}

.face-perf {
  stroke: var(--wb-ink);
  stroke-width: 2;
  stroke-dasharray: 0.1 6;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.face-letter {
  font-family: var(--font-display);
  font-size: 38px;
  font-weight: 600;
  fill: var(--wb-ink);
  text-anchor: middle;
}

.face-mark {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
  text-anchor: middle;
}

/* Sunset theme: apricot paper, warm ink letter (13.84:1) */
.belt-ticket.theme-sunset .face-paper { fill: var(--wb-sunset-face); }
.belt-ticket.theme-sunset .face-letter { fill: var(--wb-sunset-ink); }

.face-shade {
  fill: #000;
  opacity: 0;
}

.face-edge {
  fill: none;
  stroke: var(--wb-ink);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

/* The chip rides above the lifted ticket, counter-scaled so it always reads at full size. */
.belt-anchor {
  position: absolute;
  left: 50%;
  top: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.belt-chip {
  position: absolute;
  bottom: 7px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px var(--sp-2);
  border: 2px solid var(--wb-ink);
  border-radius: var(--r-pill);
  background: var(--wb-surface);
  color: var(--wb-ink);
  font-size: var(--fs-meta);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity var(--t-ui) var(--ease), transform var(--t-ui) var(--ease);
}

.belt-chip.is-shown {
  opacity: 1;
  transform: translate(-50%, 0);
}

.belt-chip-dot {
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--wb-ink);
  border-radius: 50%;
}

.belt-chip-time {
  font-weight: 500;
  color: var(--wb-text-2);
}

.belt-controls {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
}

.belt-control {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid var(--wb-line);
  border-radius: 50%;
  background: var(--wb-surface);
  color: var(--wb-text-2);
  font-size: var(--fs-body);
  cursor: pointer;
  touch-action: manipulation;
  transition: color var(--t-micro) var(--ease), transform var(--t-micro) var(--ease);
}

.belt-control:hover {
  color: var(--wb-ink);
}

.belt-control:active {
  transform: scale(0.95);
}

.belt-control[aria-pressed='true'] {
  border-color: var(--wb-ink);
  color: var(--wb-ink);
}

.belt-control:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 3px;
}

.belt-caption {
  max-width: 28rem;
  min-height: 3.25rem;
  margin-top: var(--sp-3);
  padding-inline: var(--sp-2);
  text-align: center;
}

.belt-caption p {
  margin: 0;
}

.belt-caption-main {
  font-weight: 600;
  color: var(--wb-ink);
}

.belt-caption-time {
  font-weight: 400;
  color: var(--wb-text-2);
}

.belt-caption-sub {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

@media (prefers-reduced-motion: reduce) {
  .belt-chip,
  .belt-control,
  .belt-lever-arm { transition: none; }
  .belt-control:active { transform: none; }
}
</style>
