<!--
  SeatMap: the crew lobby seen from above, like the top deck of a bus (design.md §4.6).
  A 2 × 3 grid of seats sits inside a flat bus-outline SVG, with the LED sign `CREW <code>` above
  the windscreen. The host sits front-left under a crown; members fill the other seats in join
  order as mascots in their own colour; empty seats are dashed and read "Free seat".
  The driver sits front-right, as on Singapore's right-hand-drive buses.

  UI only: no Realtime and no Supabase calls. The parent passes what it already has.

  Props
    members        crew members other than the host: [{ user_id, display_name }]
    hostName       the host's display name
    isHost         the viewer is the host (their seat is marked "You")
    code           the crew code, shown on the LED sign
    capacity       number of seats, host included                      (default 6)
    currentUserId  the viewer's user_id, to mark their seat "You"      (optional)

  Accessibility: the seats are a real list. Each seat reads as one line ("Seat 1, Alex, host",
  "Seat 4, free seat"); the bus drawing and the mascots are decorative. Members pop into their
  seat with a small spring, skipped under prefers-reduced-motion.
-->
<script setup lang="ts">
import { computed } from 'vue'
import LedBoard from '~/components/ui/LedBoard.vue'
import WanderMascot from '~/components/ui/WanderMascot.vue'
import { userColor } from '~/utils/userColor'

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
}>(), {
  members: () => [],
  hostName: 'Host',
  isHost: false,
  capacity: 6,
  currentUserId: '',
})

interface Seat {
  number: number
  key: string
  name: string
  color: string
  host: boolean
  you: boolean
  empty: boolean
  label: string
}

const FALLBACK_NAME = 'Rider'
const seatCount = computed(() => Math.max(1, Math.floor(props.capacity)))

const seats = computed<Seat[]>(() => {
  const list: Seat[] = []
  const hostName = props.hostName || FALLBACK_NAME
  list.push({
    number: 1,
    key: 'host',
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
      list.push({ number, key: `free-${number}`, name: '', color: '', host: false, you: false, empty: true, label: `Seat ${number}, free seat` })
      continue
    }
    const name = member.display_name || FALLBACK_NAME
    const you = !!props.currentUserId && member.user_id === props.currentUserId
    list.push({
      number,
      key: member.user_id,
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

const taken = computed(() => seats.value.filter((seat) => !seat.empty).length)
const overflow = computed(() => Math.max(0, props.members.length - (seatCount.value - 1)))
const sign = computed(() => `CREW ${props.code}`)
</script>

<template>
  <div class="seat-map">
    <LedBoard class="seat-map__sign" badge="" :line1="sign" :label="`Crew ${code}`" />

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
          <span class="visually-hidden">{{ seat.label }}</span>
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
                <WanderMascot :size="48" :color="seat.color" :gaze="false" />
                <span v-if="seat.host" class="seat__crown">
                  <i class="bi bi-award-fill" aria-hidden="true"></i>
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

.seat-map__sign {
  margin: 0 auto var(--sp-3);
  width: 88%;
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
  margin: 0;
  padding: 0;
  list-style: none;
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
