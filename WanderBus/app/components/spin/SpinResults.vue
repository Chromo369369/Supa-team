<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LedBoard from '~/components/ui/LedBoard.vue';
import SpinTicket from '~/components/ui/SpinTicket.vue';
import SpinSubmit from '~/components/spin/SpinSubmit.vue';
import TicketBelt, { bandFor } from '~/components/spin/TicketBelt.vue';
import ConfettiBurst from '~/components/ui/ConfettiBurst.vue';
import BusDriveBy from '~/components/ui/BusDriveBy.vue';
import WanderMascot from '~/components/ui/WanderMascot.vue';
import { useMotionPrefs } from '~/composables/usePointer';
import { categoryInfo } from '~/utils/spinCategories';
import { cheerCrew } from '~/utils/crewCheer';
import { useAdventure } from '~/composables/useAdventure';

const props = defineProps({
    submitted: Boolean,
    saving: Boolean,
    saved: Boolean,
    errorMessage: String,
    chosenStop: [Object, String],
    /**
     * Up to 3 different { destination, chosen } picks, one per ticket on the belt. Passing it at all
     * (the home page) turns on the belt: "Spin again" then emits `retry` to run the search again.
     * Left out (the lobby), "Spin again" emits `reroll`.
     */
    ticketOptions: { type: Array, default: undefined },
    /** /api/allBusStops (no longer read here: the belt shows no stop or road before the pick). */
    busStops: { type: Array, default: () => [] },
    stopDetails: [Object, String],
    startDetails: [Object, String],
    startingStops: [Object, String],
    preferences: { type: Array, default: () => [] },
    /** /api/allAmenities: { stopCode: { category: [names] } } */
    amenities: { type: Object, default: () => ({}) },
    /** The OneMap place the spin started from ({ ADDRESS, ... }); shown as the first step. Optional. */
    startPlace: { type: [Object, String], default: '' }
})

const emit = defineEmits(['reroll', 'saveTrip', 'choose', 'retry', 'endAdventure'])

const { reducedMotion } = useMotionPrefs()
const adventure = useAdventure()

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

const usesBelt = computed(() => props.ticketOptions !== undefined)
const options = computed(() => props.ticketOptions ?? [])
const searching = computed(() => props.submitted && !props.errorMessage && !props.chosenStop && !options.value.length)
const picking = computed(() => props.submitted && !props.errorMessage && !props.chosenStop && options.value.length > 0)

// Only the letter and the time reach the belt, so nothing on it can give the trip away.
const BAY_LETTERS = ['A', 'B', 'C']
const bays = computed(() => options.value.map((option, i) => ({
    letter: BAY_LETTERS[i],
    minutes: Math.ceil(option.chosen.totalTime)
})))
const baysNote = computed(() => {
    const n = bays.value.length
    if (n === 1) return 'One ticket fits your time. Pick it to take it.'
    return `${n === 2 ? 'Two' : 'Three'} mystery tickets are riding the belt. Pick one to take it.`
})

// Where the picked ticket lands: roughly where SpinTicket appears (centred under the hint line).
const bodyEl = ref(null)
function ticketLanding() {
    const body = bodyEl.value
    if (!body) return null
    const box = body.getBoundingClientRect()
    const css = getComputedStyle(body)
    const left = box.left + parseFloat(css.paddingLeft)
    const inner = box.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
    const width = isDesktop.value ? Math.min(272, Math.max(220, inner)) : Math.min(580, Math.max(280, inner))
    const height = isDesktop.value ? 392 : width < 400 ? 210 : 230
    const top = box.top + parseFloat(css.paddingTop) + 44
    return new DOMRect(left + (inner - width) / 2, top, width, height)
}

// Picking a ticket: it flies off the belt, slides up, then focus lands on the stub so the tear can start.
const revealEl = ref(null)
let focusTimer = null
function onChoose(index) {
    emit('choose', options.value[index])
    clearTimeout(focusTimer)
    focusTimer = setTimeout(() => {
        revealEl.value?.querySelector('[data-testid="tear-stub"]')?.focus()
    }, reducedMotion.value ? 0 : 420)
}
onBeforeUnmount(() => {
    desktopQuery?.removeEventListener('change', onBreakpoint)
    clearTimeout(focusTimer)
})

// Confetti once per ticket, from where the stub tore off (the stub's own box has fallen by now,
// so take the ticket's untransformed stage and its stub end).
const confetti = ref(null)
let confettiFor = -1
function onTear() {
    torn.value = true
    cheerCrew()
    startAdventure()
    if (confettiFor === ticketKey.value) return
    confettiFor = ticketKey.value
    const stage = revealEl.value?.querySelector('.tear-ticket__stage')
    if (!stage) return
    const box = stage.getBoundingClientRect()
    const origin = isDesktop.value
        ? { x: box.left + box.width / 2, y: box.bottom - 48 }
        : { x: box.right - (box.width < 400 ? 46 : 65), y: box.top + box.height / 2 }
    confetti.value?.fire(origin)
}

const trip = computed(() => props.chosenStop?.chosen ?? null)
const walkMin = computed(() => (trip.value ? Math.ceil(props.startingStops[trip.value.boardAt]) : 0))
const walkM = computed(() => (trip.value ? Math.round(props.startingStops[trip.value.boardAt] / 12 * 1000) : 0))
const totalMin = computed(() => (trip.value ? Math.ceil(trip.value.totalTime) : 0))
// The same minutes and the same rule as the belt, so the ticket keeps the colour it rode in on.
// The lobby has no belt and keeps the default green.
const band = computed(() => (usesBelt.value && trip.value ? bandFor(totalMin.value) : 'short'))
// The ride itself: the total minus the walk to the stop, never under a minute.
const rideMin = computed(() => Math.max(1, totalMin.value - walkMin.value))

// Solo only (the belt means /home): the torn ticket starts the adventure the bar and timer follow.
// The trip carries the same fields home.vue's saveTrip inserts, so the End dialog can save it from any page.
function startAdventure() {
    if (!usesBelt.value || !trip.value) return
    adventure.start({
        trip: {
            starting_stop: props.startDetails.Description,
            end_stop: props.stopDetails.Description,
            time_taken: totalMin.value,
            bus_taken: trip.value.bus,
            starting_location: props.startPlace?.ADDRESS,
            end_stop_code: props.stopDetails.BusStopCode
        },
        stopName: props.stopDetails.Description,
        bus: trip.value.bus ?? null
    })
}

// Save trip: tell the adventure once the save went through, so the End dialog doesn't offer it twice.
watch(() => props.saved, (saved) => {
    if (saved && usesBelt.value && adventure.active.value) adventure.markSaved()
})

// Ending (from here, the bar or its dialog) tells the page, so /home can go back to a fresh spin.
let offEnd = null
onMounted(() => {
    if (usesBelt.value) offEnd = adventure.onEnd(() => emit('endAdventure'))
})
onBeforeUnmount(() => offEnd?.())

// Home: back to the search and a fresh belt. Lobby: the crew's own reroll.
function spinAgain() {
    if (usesBelt.value) emit('retry')
    else emit('reroll')
}
// OneMap sends addresses in capitals; show them in title case (display only, numbers untouched).
const SMALL_WORDS = new Set(['of', 'and', 'the', 'at', 'by', 'on', 'in', 'for', 'to'])
const ACRONYMS = new Set(['MRT', 'LRT', 'HDB', 'NTUC', 'NUS', 'NTU', 'SMU', 'SUTD', 'ITE', 'CPF', 'LTA', 'URA', 'JTC', 'MOE', 'ICA', 'CBD', 'YMCA', 'YWCA', 'SAFRA', 'PCF', 'RC', 'CC', 'DBS', 'POSB', 'OCBC', 'UOB', 'SGH', 'KKH', 'NUH', 'CGH', 'TTSH', 'II', 'III', 'IV', 'PIE', 'AYE', 'CTE', 'ECP', 'KPE', 'TPE', 'SLE', 'BKE'])
function titleCase(text) {
    if (!text) return ''
    return text.split(/\s+/).map((word, i) => {
        if (/\d/.test(word)) return word
        const bare = word.replace(/[^A-Za-z]/g, '').toUpperCase()
        if (ACRONYMS.has(bare)) return word.toUpperCase()
        const lower = word.toLowerCase()
        if (i > 0 && SMALL_WORDS.has(lower)) return lower
        // capitalise each part: "Kampong-Bahru", "(Bukit Timah)", but "Andrew's" keeps a small s
        return lower.replace(/(^|[-/(])([a-z])/g, (m, lead, ch) => lead + ch.toUpperCase())
    }).join(' ')
}
const startAddress = computed(() => titleCase(props.startPlace?.ADDRESS))
const startLabel = computed(() => startAddress.value || 'your starting point')
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
    if (picking.value) return { badge: '??', messages: [['PICK YOUR', 'TICKET']] }
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
    if (picking.value) return `${baysNote.value} Use the arrow keys to move between tickets.`
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

        <div ref="bodyEl" class="results-body">
            <div v-if="!submitted" class="stage">
                <div class="scene">
                    <BusDriveBy class="scene-bus" mode="parked" label="READY WHEN YOU ARE" />
                    <WanderMascot class="scene-mascot" mood="idle" gaze :size="56" />
                </div>
                <p class="results-note">Set your time and tap Spin. Up to three mystery tickets ride the belt; pick one, then tear its stub to find out where you’re going.</p>
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
                <TicketBelt :options="bays" label="Pick your ticket" :fly-to="ticketLanding" @choose="onChoose" />
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
                            :band="band"
                            :orientation="isDesktop ? 'vertical' : 'horizontal'"
                            :resettable="false"
                            @tear="onTear"
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
                                <dd v-else class="pass-value">{{ startAddress || 'Your starting point' }}</dd>
                            </div>
                            <div class="pass-end">
                                <dt class="pass-label">To</dt>
                                <dd class="pass-value">{{ stopDetails.Description }}</dd>
                                <dd class="pass-sub">Stop <span class="num">{{ chosenStop.destination }}</span>, {{ stopDetails.RoadName }}</dd>
                            </div>
                        </dl>

                        <ol class="legs">
                            <li>
                                <span class="leg-icon leg-icon--start" aria-hidden="true"><i class="bi bi-house-door"></i></span>
                                <div class="leg-body"><p class="leg">Start at {{ startLabel }}</p></div>
                            </li>
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
                                    <span class="leg-time"><span class="num">{{ trip.stops }}</span> stops · about <span class="num">{{ rideMin }}</span> min</span>
                                </li>
                            </template>
                            <li>
                                <span class="leg-icon leg-icon--arrive" aria-hidden="true"><i class="bi bi-geo-alt-fill"></i></span>
                                <div class="leg-body"><p class="leg">{{ trip.bus ? 'Get off at' : 'Arrive at' }} {{ stopDetails.Description }}</p></div>
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
                        <button type="button" class="btn btn-wb-secondary" @click="spinAgain">
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
        <ConfettiBurst ref="confetti" />
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
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--wb-text-2);
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

.leg-icon--start {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
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
