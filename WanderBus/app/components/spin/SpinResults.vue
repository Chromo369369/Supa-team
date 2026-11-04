<!--
  Spin results: the LED board and one stage that walks through the F1 states (design.md §3.3, §4.3).
    idle       parked bus, the mascot waiting at the stop (eyes follow the pointer)
    searching  the bus idles in place while live arrivals load
    bays       up to three buses pull into bays A/B/C (BusBays); pick one to board
    ticket     the picked bus's face-down ticket slides up (420 ms), then the tear runs
    torn       a boarding pass: from → to, the legs, what's within 1 km, the total and the actions
    no result  the bus breaks down, with a Retry button that runs the same search again
  Nothing about the destination stop shows before the tear (bays show only the bus, road and time).
  Boarding-pass layout loosely after 21st "Ticket Confirmation Card" (id 6492), as a layout
  reference only; no code was downloaded or ported.
-->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LedBoard from '~/components/ui/LedBoard.vue';
import SpinTicket from '~/components/ui/SpinTicket.vue';
import SpinSubmit from '~/components/spin/SpinSubmit.vue';
import BusBays from '~/components/spin/BusBays.vue';
import BusDriveBy from '~/components/ui/BusDriveBy.vue';
import WanderMascot from '~/components/ui/WanderMascot.vue';
import { useMotionPrefs } from '~/composables/usePointer';
import { categoryInfo } from '~/utils/spinCategories';

const props = defineProps({
    submitted: Boolean,
    saving: Boolean,
    saved: Boolean,
    errorMessage: String,
    chosenStop: [Object, String],
    /** Up to 3 different { destination, chosen } picks, one per bay. */
    ticketOptions: { type: Array, default: () => [] },
    /** /api/allBusStops, to name the road under each bay. */
    busStops: { type: Array, default: () => [] },
    stopDetails: [Object, String],
    startDetails: [Object, String],
    startingStops: [Object, String],
    preferences: { type: Array, default: () => [] },
    /** /api/allAmenities: { stopCode: { category: [names] } } */
    amenities: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['reroll', 'saveTrip', 'choose', 'retry'])

const { reducedMotion } = useMotionPrefs()

const torn = ref(false)
// A new ticket every spin, even if the same stop comes up twice.
const ticketKey = ref(0)
watch(() => props.chosenStop, () => {
    torn.value = false
    ticketKey.value += 1
})

const isDesktop = ref(false)
let desktopQuery = null
const onBreakpoint = (e) => { isDesktop.value = e.matches }
onMounted(() => {
    desktopQuery = window.matchMedia('(min-width: 992px)')
    isDesktop.value = desktopQuery.matches
    desktopQuery.addEventListener('change', onBreakpoint)
})

const searching = computed(() => props.submitted && !props.errorMessage && !props.chosenStop && !props.ticketOptions.length)
const picking = computed(() => props.submitted && !props.errorMessage && !props.chosenStop && props.ticketOptions.length > 0)

const BAY_LETTERS = ['A', 'B', 'C']
const bays = computed(() => props.ticketOptions.map((option, i) => {
    const stop = props.busStops.find((s) => s.BusStopCode === option.destination)
    return {
        letter: BAY_LETTERS[i],
        bus: option.chosen.bus,
        area: stop?.RoadName ?? '',
        minutes: Math.ceil(option.chosen.totalTime)
    }
}))
const baysNote = computed(() => {
    const n = bays.value.length
    if (n === 1) return 'One bus fits your time. Pick it to get your ticket.'
    return `${n === 2 ? 'Two' : 'Three'} buses pulled in. Pick one to get its ticket.`
})

// Picking a bay: the ticket slides up, then focus lands on the stub so the tear can start.
const revealEl = ref(null)
let focusTimer = null
function onChoose(index) {
    emit('choose', props.ticketOptions[index])
    clearTimeout(focusTimer)
    focusTimer = setTimeout(() => {
        revealEl.value?.querySelector('[data-testid="tear-stub"]')?.focus()
    }, reducedMotion.value ? 0 : 420)
}
onBeforeUnmount(() => {
    desktopQuery?.removeEventListener('change', onBreakpoint)
    clearTimeout(focusTimer)
})

const trip = computed(() => props.chosenStop?.chosen ?? null)
const walkMin = computed(() => (trip.value ? Math.ceil(props.startingStops[trip.value.boardAt]) : 0))
const walkM = computed(() => (trip.value ? Math.round(props.startingStops[trip.value.boardAt] / 12 * 1000) : 0))
const totalMin = computed(() => (trip.value ? Math.ceil(trip.value.totalTime) : 0))
const walkingLink = computed(() => {
    const stop = props.startDetails
    return stop ? `https://www.google.com/maps/dir/?api=1&destination=${stop.Latitude},${stop.Longitude}&travelmode=walking` : ''
})

// Up to 6 named places within 1 km, the user's preferred categories first.
const nearby = computed(() => {
    const byCategory = props.amenities?.[props.chosenStop?.destination] ?? {}
    const order = Object.keys(byCategory).sort((a, b) => props.preferences.includes(b) - props.preferences.includes(a))
    const places = []
    for (const category of order) {
        for (const name of byCategory[category].slice(0, 2)) places.push({ name, category })
    }
    return places.slice(0, 6)
})

// The board only shows the sign; the live region below says what changed, once.
const board = computed(() => {
    if (!props.submitted) return { badge: '??', messages: [['READY WHEN', 'YOU ARE'], ['SOMEWHERE NEW', 'ANY BUS, ANY STOP']] }
    if (props.errorMessage) return { badge: '??', messages: [['NO BUS', 'FITS']] }
    if (searching.value) return { badge: '??', messages: [['FINDING YOUR', 'STOP']] }
    if (picking.value) return { badge: '??', messages: [['PICK YOUR', 'BUS']] }
    if (!torn.value) return { badge: '??', messages: [['YOUR TICKET', 'IS READY'], ['TEAR THE STUB', 'TO SEE WHERE']] }
    const destination = props.stopDetails.Description.toUpperCase()
    const road = props.stopDetails.RoadName.toUpperCase()
    // Like the front of a real bus: service number on the left, destination on the right.
    return trip.value.bus
        ? { badge: trip.value.bus, messages: [[destination, road]] }
        : { badge: '>>', messages: [['WALK TO', destination]] }
})

const announcement = computed(() => {
    if (!props.submitted) return ''
    if (props.errorMessage) return `No bus fits. ${props.errorMessage}`
    if (searching.value) return 'Checking live arrivals…'
    if (picking.value) return `${baysNote.value} Use the arrow keys to move between bays.`
    if (!torn.value) return 'Your ticket is ready. Drag, tap or press Enter to tear the stub.'
    return trip.value.bus
        ? `Here’s your side quest: bus ${trip.value.bus} to ${props.stopDetails.Description}, about ${totalMin.value} min.`
        : `Here’s your side quest: walk to ${props.stopDetails.Description}, about ${totalMin.value} min.`
})
</script>

<template>
    <section class="results">
        <LedBoard :badge="board.badge" :messages="board.messages" class="results-board" />
        <p class="visually-hidden" role="status" aria-live="polite">{{ announcement }}</p>

        <div class="results-body">
            <div v-if="!submitted" class="stage">
                <div class="scene">
                    <BusDriveBy class="scene-bus" mode="parked" label="READY WHEN YOU ARE" />
                    <WanderMascot class="scene-mascot" mood="idle" gaze :size="56" />
                </div>
                <p class="results-note">Set your time and tap Spin. Up to three buses pull in; pick one, then tear its stub to find out where you’re going.</p>
            </div>

            <div v-else-if="errorMessage" class="stage">
                <div class="scene">
                    <BusDriveBy class="scene-bus" mode="breakdown" label="NO BUS FITS" />
                    <WanderMascot class="scene-mascot" mood="sad" :size="56" />
                </div>
                <p class="results-error"><i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ errorMessage }}</p>
                <button type="button" class="btn btn-wb-primary" @click="$emit('retry')">
                    <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                    Retry the search
                </button>
            </div>

            <div v-else-if="searching" class="stage">
                <BusDriveBy class="scene-bus" mode="idle-loop" label="FINDING YOUR STOP" />
                <p class="results-note">Checking live arrivals…</p>
            </div>

            <div v-else-if="picking" class="stage stage--bays">
                <p class="results-note">{{ baysNote }}</p>
                <BusBays :bays="bays" @choose="onChoose" />
            </div>

            <template v-else>
                <p class="reveal-head">
                    <template v-if="!torn">Drag, tap or press Enter to tear the stub</template>
                    <template v-else>Here’s your side quest. Head out, or spin again for a new ticket.</template>
                </p>

                <div ref="revealEl" class="reveal" :class="{ 'is-torn': torn }">
                    <div :key="ticketKey" class="ticket-slot">
                        <SpinTicket
                            icon="bi-bus-front"
                            :heading-level="2"
                            title="Mystery stop"
                            subtitle="A random stop within your travel time"
                            :travel-time="totalMin"
                            :bus="trip.bus"
                            :board-at="startDetails.Description"
                            :walk="`${walkM} m walk`"
                            :get-off-at="stopDetails.Description"
                            :area="stopDetails.RoadName"
                            :stops="trip.stops"
                            :orientation="isDesktop ? 'vertical' : 'horizontal'"
                            :resettable="false"
                            @tear="torn = true"
                        />
                    </div>

                    <section v-if="torn" class="pass" aria-labelledby="quest-title">
                        <h2 id="quest-title" class="quest-title">Your side quest</h2>

                        <dl class="pass-route">
                            <div class="pass-end pass-end--from">
                                <dt class="pass-label">From</dt>
                                <template v-if="trip.bus">
                                    <dd class="pass-value">{{ startDetails.Description }}</dd>
                                    <dd class="pass-sub">Stop <span class="num">{{ trip.boardAt }}</span>, {{ startDetails.RoadName }}</dd>
                                </template>
                                <dd v-else class="pass-value">Your starting point</dd>
                            </div>
                            <div class="pass-end">
                                <dt class="pass-label">To</dt>
                                <dd class="pass-value">{{ stopDetails.Description }}</dd>
                                <dd class="pass-sub">Stop <span class="num">{{ chosenStop.destination }}</span>, {{ stopDetails.RoadName }}</dd>
                            </div>
                        </dl>

                        <ol class="legs">
                            <li>
                                <span class="leg-icon" aria-hidden="true"><i class="bi bi-person-walking"></i></span>
                                <div v-if="trip.bus" class="leg-body">
                                    <p class="leg">Walk <span class="num">{{ walkM }}</span> m to {{ startDetails.Description }}</p>
                                    <p class="leg-sub">
                                        <a :href="walkingLink" target="_blank" rel="noopener noreferrer">Walking directions<span class="visually-hidden"> (opens Google Maps)</span></a>
                                    </p>
                                </div>
                                <div v-else class="leg-body">
                                    <p class="leg">Walk to {{ stopDetails.Description }}</p>
                                    <p class="leg-sub">No bus needed. It’s close enough to walk.</p>
                                </div>
                                <span class="leg-time"><span class="num">{{ walkMin }}</span> min</span>
                            </li>
                            <template v-if="trip.bus">
                                <li>
                                    <span class="leg-icon" aria-hidden="true"><i class="bi bi-bus-front"></i></span>
                                    <div class="leg-body"><p class="leg">Board bus <span class="num">{{ trip.bus }}</span></p></div>
                                </li>
                                <li>
                                    <span class="leg-icon" aria-hidden="true"><i class="bi bi-arrow-down"></i></span>
                                    <div class="leg-body"><p class="leg">Ride the bus</p></div>
                                    <span class="leg-time"><span class="num">{{ trip.stops }}</span> stops</span>
                                </li>
                            </template>
                            <li>
                                <span class="leg-icon leg-icon--arrive" aria-hidden="true"><i class="bi bi-geo-alt-fill"></i></span>
                                <div class="leg-body"><p class="leg">{{ trip.bus ? 'Get off at' : 'Arrive at' }} {{ stopDetails.Description }}</p></div>
                                <span class="leg-time"><span class="num">{{ totalMin }}</span> min</span>
                            </li>
                        </ol>
                    </section>
                </div>

                <template v-if="torn">
                    <div v-if="nearby.length" class="nearby-block">
                        <h3 class="nearby-title">Within 1 km of the stop</h3>
                        <ul class="nearby">
                            <li v-for="place in nearby" :key="place.name">
                                <i :class="['bi', categoryInfo(place.category).icon]" aria-hidden="true"></i>
                                {{ place.name }}
                                <span class="visually-hidden">({{ categoryInfo(place.category).label }})</span>
                            </li>
                        </ul>
                    </div>

                    <p class="quest-time">
                        <span class="quest-time-label"><i class="bi bi-stopwatch" aria-hidden="true"></i> Total travel time</span>
                        <span class="quest-time-value">about <strong class="num">{{ totalMin }} min</strong></span>
                    </p>

                    <div class="actions">
                        <NuxtLink
                            :to="{ path: `/stop/${chosenStop.destination}`, query: { prefer: preferences.join(',') } }"
                            class="btn btn-wb-primary"
                        >
                            Explore this stop
                        </NuxtLink>
                        <button type="button" class="btn btn-wb-secondary" @click="$emit('reroll')">
                            <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
                            Spin again
                        </button>
                        <span class="save-slot" :class="{ 'is-stamped': saved && !reducedMotion }">
                            <SpinSubmit :submitted="true" :saving="saving" :saved="saved" @save-trip="$emit('saveTrip')" />
                        </span>
                    </div>
                </template>
            </template>
        </div>
    </section>
</template>

<style scoped>
/* The stage is one flat surface; no outline, no dotted grid (design.md §1). */
.results {
  background: var(--wb-surface);
  border-radius: var(--r-card);
  overflow: hidden;
}

.results .results-board {
  border-radius: 0;
}

.results-body {
  min-height: 22rem;
  padding: var(--sp-5);
}

@media (min-width: 992px) {
  .results-body {
    min-height: 34rem;
    padding: var(--sp-6);
  }
}

.results-note {
  max-width: 28rem;
  margin: 0;
  color: var(--wb-text-2);
}

.results-error {
  display: inline-flex;
  align-items: baseline;
  gap: var(--sp-2);
  max-width: 28rem;
  margin: 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
  font-weight: 500;
  text-align: left;
}

/* idle, searching, no result and bays: the bus on the road, copy underneath */
.stage {
  display: grid;
  justify-items: center;
  gap: 20px;
  padding-block: var(--sp-5);
  text-align: center;
}

.stage--bays {
  gap: var(--sp-5);
}

.scene {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--sp-3);
  width: 100%;
  max-width: 440px;
}

.scene-bus {
  justify-self: center;
}

.scene-mascot {
  margin-bottom: 2px;
}

.reveal-head {
  margin: 0 0 20px;
  color: var(--wb-text-2);
  text-align: center;
}

/* One ticket centred; once torn it moves left and the boarding pass appears beside it */
.reveal {
  display: grid;
  gap: var(--sp-5);
  justify-items: center;
}

@media (min-width: 992px) {
  .reveal.is-torn {
    grid-template-columns: 272px minmax(0, 1fr);
    gap: var(--sp-6);
    align-items: start;
    justify-items: stretch;
  }
}

/* The picked bus's ticket slides up out of the bay (420 ms) */
.ticket-slot {
  width: 100%;
  animation: ticket-up var(--t-reveal) var(--ease) both;
}

@keyframes ticket-up {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: none; }
}

/* Boarding pass */
.pass {
  display: grid;
  gap: var(--sp-5);
  width: 100%;
  min-width: 0;
  animation: pass-in var(--t-reveal) var(--ease);
}

@keyframes pass-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}

.quest-title {
  margin: 0;
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.pass-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-5);
  margin: 0;
  padding-bottom: var(--sp-4);
  border-bottom: 2px dashed var(--wb-line);
}

.pass-end {
  position: relative;
  min-width: 0;
}

/* the arrow between the two ends */
.pass-end--from::after {
  content: '\2192';
  position: absolute;
  top: 1.1rem;
  right: calc(var(--sp-5) / -2);
  transform: translateX(50%);
  color: var(--wb-green);
  font-weight: 600;
}

.pass-label {
  font-size: var(--fs-meta);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wb-muted);
}

.pass-value {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.2;
  color: var(--wb-ink);
  overflow-wrap: anywhere;
}

.pass-sub {
  margin: 2px 0 0;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  overflow-wrap: anywhere;
}

/* Trip steps joined by a line (the route, not a divider) */
.legs {
  list-style: none;
  display: grid;
  margin: 0;
  padding: 0;
}

.legs li {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
}

.legs li:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 17px;
  top: 36px;
  bottom: 0;
  width: 2px;
  background: var(--wb-line);
}

.leg-icon {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font-size: var(--fs-body);
}

.leg-icon--arrive {
  background: var(--wb-green);
  color: var(--wb-on-ink);
}

.leg-body {
  min-width: 0;
}

.leg {
  margin: 0;
  padding-top: 6px;
  font-weight: 600;
  color: var(--wb-ink);
  overflow-wrap: anywhere;
}

.leg-sub {
  margin: 0;
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.leg-sub a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--wb-green);
}

.leg-time {
  padding-top: 6px;
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--wb-text-2);
  white-space: nowrap;
}

.nearby-block {
  margin-top: var(--sp-5);
}

.nearby-title {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--wb-ink);
}

.nearby {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
}

.nearby li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px var(--sp-3);
  border-radius: var(--r-pill);
  background: var(--wb-surface-2);
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.nearby li .bi {
  color: var(--wb-green);
}

/* Amber total strip, the last line of the pass */
.quest-time {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  margin: 20px 0 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
}

.quest-time-label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 500;
}

.quest-time-value strong {
  font-family: var(--font-display);
  font-size: var(--fs-lead);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-3);
  margin-top: 28px;
}

/* Saved: the button lands like a passport stamp (scale 1.15 → 1, 250 ms) */
.save-slot {
  display: inline-flex;
}

.save-slot.is-stamped {
  animation: stamp-thunk var(--t-ui) var(--ease-spring);
}

@keyframes stamp-thunk {
  from { transform: scale(1.15); }
  to { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .ticket-slot,
  .pass,
  .save-slot.is-stamped { animation: none; }
}
</style>
