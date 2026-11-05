<!--
  SeatMap: the crew lobby seen from above, like the top deck of a bus (design.md §4.6).
  A 2 × 3 grid of seats sits inside a flat bus-outline SVG, with the LED sign `CREW <code>` above
  the windscreen. The driver sits front-right, as on Singapore's right-hand-drive buses, and the
  host sits right behind them under a crown; members fill the other seats in join order as mascots
  in their own colour; empty seats are dashed and read "Free seat". The list order (and so what a
  screen reader hears) stays Seat 1 host, Seat 2, 3…; only the grid placement moves the host.

  UI only: no Realtime. The one read is each rider's best badge (useBadges, batched and cached),
  shown as a small mark on their mascot with its name in the seat's label and a tooltip.

  Props
    members        crew members other than the host: [{ user_id, display_name }]
    hostName       the host's display name
    isHost         the viewer is the host (their seat is marked "You")
    code           the crew code, shown on the LED sign
    capacity       number of seats, host included                      (default 6)
    currentUserId  the viewer's user_id, to mark their seat "You"      (optional)
    hostId         the host's user_id, for the host's badge              (optional)
    compact        smaller seats and mascots, so six seats fit on one screen   (default false)
    showSign       draw the LED sign on top of the bus, as wide as its body   (default true)
                   Pass false when the parent draws the sign itself.

  Slots
    sign-action    sits beside the LED sign, e.g. a "Copy code" button (the sign then shares the row)

  Accessibility: the seats are a real list. Each seat reads as one line ("Seat 1, Alex, host",
  "Seat 4, free seat"); the bus drawing and the mascots are decorative. Members pop into their
  seat with a small spring, skipped under prefers-reduced-motion.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import LedBoard from '~/components/ui/LedBoard.vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'
import type { MascotMood } from '~/components/ui/WanderMascot.vue'
import { useMotionPrefs } from '~/composables/usePointer'
import { userColor } from '~/utils/userColor'
import { crewCheer } from '~/utils/crewCheer'

interface CrewMember {
  user_id: string
  display_name?: string | null
}

const props = withDefaults(defineProps<{
  members?: CrewMember[]
  hostName?: string
  isHost?: boolean
  code: string | number
  capacity?: number
  currentUserId?: string
  hostId?: string
  compact?: boolean
  showSign?: boolean
}>(), {
  members: () => [],
  hostName: 'Host',
  isHost: false,
  capacity: 6,
  currentUserId: '',
  hostId: '',
  compact: false,
  showSign: true,
})

interface Seat {
  number: number
  key: string
  userId: string
  name: string
  color: string
  host: boolean
  you: boolean
  empty: boolean
  label: string
}
const rewards = useRewards()
// fetch everyone's looks whenever someone joins or leaves
watch(
  () => [props.hostId, ...props.members.map(m => m.user_id)],
  ids => rewards.lookFor(ids),
  { immediate: true }
)

const FALLBACK_NAME = 'Rider'
const seatCount = computed(() => Math.max(1, Math.floor(props.capacity)))

const seats = computed<Seat[]>(() => {
  const list: Seat[] = []
  const hostName = props.hostName || FALLBACK_NAME
  list.push({
    number: 1,
    key: 'host',
    userId: props.hostId,
    name: hostName,
    color: userColor(hostName),
    host: true,
    you: props.isHost,
    empty: false,
    label: `Seat 1, ${hostName}, host${props.isHost ? ', you' : ''}`,
  })

  const riders = props.members.slice(0, seatCount.value - 1)
  for (let i = 1; i < seatCount.value; i++) {
    const member = riders[i - 1]
    const number = i + 1
    if (!member) {
      list.push({ number, key: `free-${number}`, userId: '', name: '', color: '', host: false, you: false, empty: true, label: `Seat ${number}, free seat` })
      continue
    }
    const name = member.display_name || FALLBACK_NAME
    const you = !!props.currentUserId && member.user_id === props.currentUserId
    list.push({
      number,
      key: member.user_id,
      userId: member.user_id,
      name,
      color: userColor(member.display_name || member.user_id),
      host: false,
      you,
      empty: false,
      label: `Seat ${number}, ${name}${you ? ', you' : ''}`,
    })
  }
  return list
})

// each rider's best badge (one batched read for the whole bus)
const badges = useBadges()
const riderIds = computed(() => seats.value.map((seat) => seat.userId).filter(Boolean))
watch(riderIds, (ids) => { if (ids.length) badges.forUsers(ids) }, { immediate: true })
const badgeOf = (seat: Seat) => (seat.userId ? badges.bestOf(seat.userId) : null)

const taken = computed(() => seats.value.filter((seat) => !seat.empty).length)
const overflow = computed(() => Math.max(0, props.members.length - (seatCount.value - 1)))
const sign = computed(() => `CREW ${props.code}`)
const mascotSize = computed(() => (props.compact ? 30 : 48))

/* ── the crew cheers when the ticket is torn ──
   For CHEER_MS every seated mascot alternates a hop (happy) and a wave, each seat a beat behind
   the one before, so the bus reads as a crowd. Reduced motion: one plain smile, no loop. */
const CHEER_MS = 2400
const CHEER_BEAT = 600
const CHEER_STAGGER = 75
const { reducedMotion } = useMotionPrefs()
const cheerMoods = ref<Record<number, MascotMood>>({})
let cheerTimers: ReturnType<typeof setTimeout>[] = []

function stopCheer() {
  cheerTimers.forEach(clearTimeout)
  cheerTimers = []
}

function setMood(index: number, mood: MascotMood) {
  cheerMoods.value = { ...cheerMoods.value, [index]: mood }
}

function cheer() {
  stopCheer()
  cheerMoods.value = {}
  const riders = seats.value.map((seat, index) => (seat.empty ? -1 : index)).filter((index) => index >= 0)
  if (reducedMotion.value) {
    riders.forEach((index) => setMood(index, 'happy'))
    cheerTimers.push(setTimeout(() => { cheerMoods.value = {} }, CHEER_MS))
    return
  }
  riders.forEach((index, order) => {
    const start = order * CHEER_STAGGER
    for (let t = 0, beat = 0; t < CHEER_MS; t += CHEER_BEAT, beat++) {
      const mood: MascotMood = beat % 2 ? 'wave' : 'happy'
      cheerTimers.push(setTimeout(() => setMood(index, mood), start + t))
    }
    cheerTimers.push(setTimeout(() => setMood(index, 'idle'), start + CHEER_MS))
  })
}

watch(crewCheer, cheer)
onBeforeUnmount(stopCheer)
</script>

<template>
  <div class="seat-map" :class="{ 'is-compact': compact }">
    <div v-if="showSign" class="seat-map__sign-row">
      <LedBoard class="seat-map__sign" badge="" :pitch="3" :line1="sign" :label="`Crew ${code}`" />
      <slot name="sign-action" />
    </div>

    <div class="bus">
      <!-- body outline, wheels, mirrors and rear grille: stretches with the seat grid -->
      <svg class="bus__shell" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <rect class="bus__wheel" x="2" y="24" width="6" height="16" rx="2" />
        <rect class="bus__wheel" x="92" y="24" width="6" height="16" rx="2" />
        <rect class="bus__wheel" x="2" y="114" width="6" height="16" rx="2" />
        <rect class="bus__wheel" x="92" y="114" width="6" height="16" rx="2" />
        <rect class="bus__mirror" x="0" y="7" width="6" height="3" rx="1.5" />
        <rect class="bus__mirror" x="94" y="7" width="6" height="3" rx="1.5" />
        <rect class="bus__body" x="5" y="1" width="90" height="148" rx="12" ry="9" vector-effect="non-scaling-stroke" />
        <line class="bus__grille" x1="36" y1="143" x2="64" y2="143" vector-effect="non-scaling-stroke" />
        <line class="bus__grille" x1="40" y1="146" x2="60" y2="146" vector-effect="non-scaling-stroke" />
      </svg>

      <!-- the front: windscreen, entry step on the left, driver on the right -->
      <svg class="bus__cab" viewBox="0 0 240 70" aria-hidden="true" focusable="false">
        <path class="bus__windscreen" d="M18 26 Q120 2 222 26 L216 38 Q120 18 24 38 Z" />
        <line class="bus__dash" x1="24" y1="48" x2="216" y2="48" />
        <rect class="bus__step" x="22" y="56" width="44" height="5" rx="2.5" />
        <rect class="bus__driver-seat" x="164" y="56" width="34" height="12" rx="4" />
        <circle class="bus__wheel-ring" cx="181" cy="47" r="9" />
        <line class="bus__wheel-ring" x1="172" y1="47" x2="190" y2="47" />
      </svg>

      <ul class="bus__seats" role="list" aria-label="Seats on the bus">
        <li
          v-for="(seat, index) in seats"
          :key="seat.number"
          class="seat"
          :class="{ 'is-empty': seat.empty, 'is-host': seat.host, 'is-you': seat.you }"
        >
          <span class="visually-hidden">{{ seat.label }}<template v-if="badgeOf(seat)">, badge: {{ badgeOf(seat)!.name }}</template></span>
          <Transition name="seat-pop" mode="out-in" appear>
            <span
              v-if="seat.empty"
              key="free"
              class="seat__inner"
              aria-hidden="true"
            >
              <span class="seat__free">Free seat</span>
            </span>
            <span
              v-else
              :key="seat.key"
              class="seat__inner"
              :style="{ '--i': index }"
              aria-hidden="true"
            >
              <span class="seat__rider">
                <WanderMascot :size="mascotSize" :color="seat.color" :gaze="false" :mood="cheerMoods[index] ?? 'idle'" :hat="rewards.hatOf(seat.userId)"  />
                <span v-if="seat.host" class="seat__crown">
                  <i class="bi bi-award-fill" aria-hidden="true"></i>
                </span>
                <span v-if="badgeOf(seat)" class="seat__badge" :title="badgeOf(seat)!.name">
                  <i class="bi" :class="badgeOf(seat)!.icon || 'bi-award'" aria-hidden="true"></i>
                </span>
              </span>
              <span class="seat__name" :title="seat.name">{{ seat.name }}</span>
              <span v-if="seat.host || seat.you" class="seat__tag">
                {{ seat.host ? (seat.you ? 'Host, you' : 'Host') : 'You' }}
              </span>
            </span>
          </Transition>
        </li>
      </ul>
    </div>

    <p class="seat-map__count">
      <span class="num">{{ taken }}</span> of <span class="num">{{ seatCount }}</span> seats taken<template v-if="overflow">, <span class="num">{{ overflow }}</span> more standing</template>
    </p>
  </div>
</template>

<style scoped>
.seat-map {
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
}

.seat-map.is-compact {
  max-width: 340px;
}

/* the destination sign: small (3px dots), centred on top of the bus and as wide as its body
   (the body spans 5% to 95% of the drawing); an action in the slot shares the row */
.seat-map__sign-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2) var(--sp-3);
  margin: 0 0 var(--sp-2);
  padding: 0 5%;
}

.seat-map__sign {
  flex: 1 1 200px;
  min-width: 0;
  max-width: 100%;
}

/* ── the bus ── */
.bus {
  position: relative;
  padding: var(--sp-2) 12% var(--sp-6);
}

.bus__shell {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.bus__body {
  fill: var(--wb-surface);
  stroke: var(--wb-ink);
  stroke-width: 2;
}

.bus__wheel,
.bus__mirror {
  fill: var(--wb-ink);
}

.bus__grille {
  stroke: var(--wb-control);
  stroke-width: 2;
  stroke-linecap: round;
}

.bus__cab {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  margin-bottom: var(--sp-3);
}

.bus__windscreen {
  fill: var(--wb-ink);
}

.bus__dash {
  stroke: var(--wb-line);
  stroke-width: 2;
}

/* the yellow step edge at the front door */
.bus__step {
  fill: var(--wb-amber);
}

.bus__driver-seat {
  fill: var(--wb-surface-2);
  stroke: var(--wb-control);
  stroke-width: 1.5;
}

.bus__wheel-ring {
  fill: none;
  stroke: var(--wb-ink);
  stroke-width: 2.5;
  stroke-linecap: round;
}

/* ── seats ── */
.bus__seats {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--sp-5); /* the aisle */
  row-gap: var(--sp-3);
  grid-auto-flow: row dense; /* members back-fill the front-left seat the host leaves free */
  margin: 0;
  padding: 0;
  list-style: none;
}

/* the host rides front-right, right behind the driver; the list order is unchanged */
.seat.is-host {
  grid-column: 2;
  grid-row: 1;
}

.seat {
  position: relative;
  min-width: 0;
  min-height: 108px;
  border-radius: var(--r-control);
  background: var(--wb-surface-2);
}

/* the seat back, facing the front of the bus */
.seat::before {
  content: "";
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 6px;
  border-radius: 0 0 var(--r-pill) var(--r-pill);
  background: var(--wb-line);
}

.seat.is-host::before {
  background: var(--wb-amber);
}

.seat.is-you {
  box-shadow: inset 0 0 0 2px var(--wb-ink); /* taste-skill-ignore: an inset outline, not elevation */
}

.seat.is-empty {
  background: transparent;
  border: 2px dashed var(--wb-control);
}

.seat.is-empty::before {
  display: none;
}

.seat__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  height: 100%;
  min-height: inherit;
  padding: var(--sp-3) var(--sp-2) var(--sp-2);
  text-align: center;
}

.seat__rider {
  position: relative;
  display: inline-flex;
}

.seat__crown {
  position: absolute;
  top: -6px;
  right: -10px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--wb-amber);
  border: 2px solid var(--wb-surface-2);
  color: var(--wb-ink);
  font-size: 12px;
  line-height: 1;
}

.seat__badge {
  position: absolute;
  bottom: -4px;
  left: -10px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--wb-rarity-legendary-tint);
  border: 2px solid var(--wb-surface-2);
  color: var(--wb-amber-ink);
  font-size: 12px;
  line-height: 1;
}

.seat__name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--wb-ink);
  font-size: var(--fs-small);
  font-weight: 500;
}

.seat__tag {
  color: var(--wb-text-2);
  font-size: var(--fs-meta);
}

.seat__free {
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

.seat-map__count {
  margin: var(--sp-3) 0 0;
  text-align: center;
  color: var(--wb-muted);
  font-size: var(--fs-small);
}

/* compact: shorter seats and smaller riders, so six seats and the lobby header share one screen */
/* compact also fits the 340px lobby column: 30px riders, tighter aisle and rows */
.is-compact .bus {
  padding: var(--sp-1) 10% var(--sp-4);
}

.is-compact .bus__cab {
  margin-bottom: var(--sp-2);
}

.is-compact .bus__seats {
  column-gap: var(--sp-4);
  row-gap: 6px;
}

.is-compact .seat {
  min-height: 62px;
}

.is-compact .seat__inner {
  gap: 2px;
  padding: 6px var(--sp-1) var(--sp-1);
}

.is-compact .seat__name,
.is-compact .seat__tag {
  line-height: 1.2;
}

.is-compact .seat__name,
.is-compact .seat__free {
  font-size: var(--fs-meta);
}

.is-compact .seat__crown {
  top: -5px;
  right: -9px;
  width: 18px;
  height: 18px;
  font-size: 10px;
}

.is-compact .seat-map__count {
  margin-top: var(--sp-2);
}

/* a member drops into their seat with a small spring */
.seat-pop-enter-active {
  transition: transform var(--t-reveal) var(--ease-spring), opacity var(--t-ui) var(--ease);
  transition-delay: calc(var(--i, 0) * 70ms);
}

.seat-pop-leave-active {
  transition: transform var(--t-micro) var(--ease), opacity var(--t-micro) var(--ease);
}

.seat-pop-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(.85);
}

.seat-pop-leave-to {
  opacity: 0;
  transform: scale(.9);
}

@media (prefers-reduced-motion: reduce) {
  .seat-pop-enter-active,
  .seat-pop-leave-active {
    transition: none;
  }
}
</style>
