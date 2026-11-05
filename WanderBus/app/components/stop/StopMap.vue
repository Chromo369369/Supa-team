<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
    stop: Object,       // { code, name, road, lat, lon }
    radius: Number,     // metres
    places: Array,      // places currently shown (already filtered by category)
    activities: { type: Array, default: () => [] },   // signposts/challenges currently shown (feature 3)
    draft: Object,      // { kind, lat, lon } while leaving a signpost/challenge, else null
    selectedId: String, // a place id or an activity key ('signpost:12')
    placing: { type: String, default: '' },    // 'signpost' | 'challenge' while waiting for a tap on the map
    incoming: { type: String, default: '' },   // the kind being dragged in from the "Leave a signpost" / "Set a challenge" buttons
    hoverId: { type: String, default: '' },    // a card that's hovered or focused, its pin lights up
    pulseId: { type: String, default: '' }     // a pin that was just saved, it pulses twice
})

// place = a tap on the map in placing mode, hover = a pin is hovered or focused ('' when it stops),
// confirm-draft = Enter on the focused draft pin
const emit = defineEmits(['select', 'drop', 'drop-outside', 'move-draft', 'place', 'hover', 'confirm-draft'])

const waves = 12        // the sweep is split into 12 slices of 30 degrees
const sweepMs = 2000
const hitSize = 44      // every pin is a 44px tap target, the visible circle/square sits inside it
const nudgeM = 10       // arrow keys move the draft pin 10 m, Shift+arrow 50 m
const nudgeBigM = 50
const metresPerDegree = 111320

const mapEl = ref(null)
const sweeping = ref(false)
const dragging = ref(false)   // the draft pin, or a button dragged in from the page, is over the map
const outside = ref(false)    // ...and it's outside the circle right now
const helper = ref('')        // the polite live line on the map, e.g. "Drop it inside the circle"
const helperWarns = ref(false) // red when it's telling the user the pin can't go there
const ghost = reactive({ visible: false, x: 0, y: 0 })   // the pin under the pointer while a button is dragged in
let map = null
let placeLayer = null
let activityLayer = null
let draftMarker = null
let markers = {}    // place id / activity key -> leaflet marker
let sweepTimer = null
let helperTimer = null
let classTimers = []

const mapLabel = computed(() => `Map of places within ${props.radius >= 1000 ? `${props.radius / 1000} km` : `${props.radius} m`} of ${props.stop.name}`)
const ghostStyle = computed(() => activityStyles[props.incoming] ?? activityStyles.signpost)

function reduceMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// which slice of the sweep a place is in, from its compass bearing (0 = north, clockwise)
function waveOf(place) {
    let dx = (place.lon - props.stop.lon) * Math.cos(props.stop.lat * Math.PI / 180)
    let dy = place.lat - props.stop.lat
    let bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
    return Math.min(waves - 1, Math.floor(bearing / (360 / waves)))
}

// the outer div is leaflet's (and the 44px hit area), the inner span is the pin people see
function pinHtml(kindClass, style, selected, extraClass = '') {
    return `<span class="${kindClass} ${extraClass} ${selected ? 'is-selected' : ''}" style="--pin:${style.colour};--glyph:${style.glyph}">`
        + `<i class="bi ${style.icon}" aria-hidden="true"></i></span>`
}

// a hovered card lights up its pin, and the pin stays lit when the pins are redrawn
function linkClass(id) {
    return id && id === props.hoverId ? 'is-linked' : ''
}

function pinIcon(place, selected) {
    return L.divIcon({
        className: 'wb-pin',
        html: pinHtml('place-pin', placeStyle(place.category), selected, `wave-${waveOf(place)} ${linkClass(place.id)}`),
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize / 2]
    })
}

function activityIcon(activity, selected) {
    return L.divIcon({
        className: 'wb-pin',
        html: pinHtml('activity-pin', activityStyles[activity.kind], selected, linkClass(activity.key)),
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize / 2]
    })
}

// the draft pin brings a ground ellipse under its anchor (shown while it's lifted) and a ripple ring (played when it lands)
function draftIcon(kind) {
    return L.divIcon({
        className: 'wb-pin wb-draft',
        html: '<span class="draft-shadow" aria-hidden="true"></span><span class="draft-ripple" aria-hidden="true"></span>'
            + pinHtml('activity-pin', activityStyles[kind], true, 'is-draft'),
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize / 2]
    })
}

function placeLabel(place) {
    return `${place.name}, ${placeStyle(place.category).label}, ${place.distanceM} m from the stop`
}

function activityLabel(activity) {
    let who = activity.isMine ? 'Your' : `${activity.author_name}’s`
    let what = activity.kind == 'signpost' ? 'signpost' : `challenge “${activity.title}”`
    return `${who} ${what}, ${activity.distanceM} m from the stop`
}

function metresFromStop(latlng) {
    return Math.round(distanceInMetres(props.stop.lat, props.stop.lon, latlng.lat, latlng.lng))
}

function draftLabel() {
    let where = draftMarker ? `, ${metresFromStop(draftMarker.getLatLng())} m from the stop` : ''
    return `${props.draft.editing ? 'Your' : 'Your new'} ${props.draft.kind}${where}. Drag it or use the arrow keys to move it, then press Enter to confirm.`
}

// leaflet makes markers focusable buttons (keyboard: true), this names them and lets Enter/Space pick them
function labelMarker(marker, label, selected) {
    let el = marker.getElement()
    if (!el) return
    el.setAttribute('aria-label', label)
    if (selected !== undefined) el.setAttribute('aria-pressed', String(selected))
}

function onPinKey(event, run) {
    let key = event.originalEvent.key
    if (key === 'Enter' || key === ' ') {
        event.originalEvent.preventDefault()
        run()
    }
}

// hovering or focusing a pin lights up its card (the page passes the id back down as hoverId)
function linkHover(marker, id) {
    marker.on('mouseover', () => emit('hover', id))
    marker.on('mouseout', () => emit('hover', ''))
    let el = marker.getElement()
    if (!el) return
    el.addEventListener('focus', () => emit('hover', id))
    el.addEventListener('blur', () => emit('hover', ''))
}

function isInside(latlng) {
    return distanceInMetres(props.stop.lat, props.stop.lon, latlng.lat, latlng.lng) <= props.radius
}

// adds a class for one play of an animation, skipped when the user prefers reduced motion
function playClass(el, name, ms) {
    if (!el || reduceMotion()) return
    el.classList.remove(name)
    void el.offsetWidth   // restarts the animation if it's already playing
    el.classList.add(name)
    classTimers.push(setTimeout(() => el.classList.remove(name), ms))
}

function say(text, clearAfterMs = 0, warn = false) {
    helper.value = text
    helperWarns.value = warn
    clearTimeout(helperTimer)
    if (clearAfterMs) helperTimer = setTimeout(() => { helper.value = '' }, clearAfterMs)
}

function drawPlaces() {
    placeLayer.clearLayers()
    activityLayer.clearLayers()
    markers = {}
    for (let activity of props.activities) {
        let selected = activity.key === props.selectedId
        let marker = L.marker([activity.lat, activity.lon], {
            icon: activityIcon(activity, selected),
            title: activityLabel(activity),
            zIndexOffset: selected ? 1000 : 500
        })
        marker.on('click', () => emit('select', activity.key))
        marker.on('keydown', event => onPinKey(event, () => emit('select', activity.key)))
        marker.addTo(activityLayer)
        labelMarker(marker, activityLabel(activity), selected)
        linkHover(marker, activity.key)
        markers[activity.key] = marker
    }
    for (let place of props.places) {
        let selected = place.id === props.selectedId
        let marker = L.marker([place.lat, place.lon], {
            icon: pinIcon(place, selected),
            title: placeLabel(place),
            zIndexOffset: selected ? 1000 : 0
        })
        marker.on('click', () => emit('select', place.id))
        marker.on('keydown', event => onPinKey(event, () => emit('select', place.id)))
        marker.addTo(placeLayer)
        labelMarker(marker, placeLabel(place), selected)
        linkHover(marker, place.id)
        markers[place.id] = marker
    }
}

function resetDragCues() {
    ghost.visible = false
    dragging.value = false
    outside.value = false
}

// ---- a "Leave a signpost" / "Set a challenge" button dragged onto the map ----
// while it's over the map a ghost pin follows the pointer, and the circle shows whether it can land there
function onDragOver(event) {
    if (!props.incoming) return
    let point = map.mouseEventToContainerPoint(event)
    let inside = isInside(map.containerPointToLatLng(point))
    ghost.visible = true
    ghost.x = point.x
    ghost.y = point.y
    dragging.value = true
    outside.value = !inside
    event.dataTransfer.dropEffect = inside ? 'copy' : 'none'
    if (!inside) say('Drop it inside the circle', 0, true)
    else if (helper.value) say('')
}

function onDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    resetDragCues()
}

// the button was dropped on the map: inside the circle starts a draft there, outside it says why not
function onDrop(event) {
    resetDragCues()
    let kind = event.dataTransfer.getData('text/plain')
    if (kind != 'signpost' && kind != 'challenge') return
    let latlng = map.mouseEventToLatLng(event)
    if (isInside(latlng)) {
        say('')
        emit('drop', kind, latlng.lat, latlng.lng)
    } else {
        emit('drop-outside')
    }
}

// let go outside the circle: the browser doesn't fire drop there (dropEffect is none), so say it when the drag ends
watch(() => props.incoming, (now, before) => {
    if (now || !before) return
    if (ghost.visible && outside.value) {
        emit('drop-outside')
        say('Drop it inside the circle', 3000, true)
    }
    resetDragCues()
})

// placing mode: the next tap on the map places the pin
function onMapClick(event) {
    if (!props.placing) return
    if (isInside(event.latlng)) {
        say('')
        emit('place', event.latlng.lat, event.latlng.lng)
    } else {
        say('Tap inside the circle', 3000, true)
        emit('drop-outside')
    }
}

// ---- the draft pin: drag it, or nudge it with the arrow keys, Enter confirms. Outside the circle = snaps back ----
function landDraft() {
    playClass(draftMarker?.getElement(), 'is-landing', 460)
}

function onDraftKey(event) {
    let key = event.originalEvent.key
    if (key === 'Enter') {
        event.originalEvent.preventDefault()
        emit('confirm-draft')
        return
    }
    let step = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[key]
    if (!step) return
    event.originalEvent.preventDefault()
    event.originalEvent.stopPropagation()
    let metres = event.originalEvent.shiftKey ? nudgeBigM : nudgeM
    let from = draftMarker.getLatLng()
    let to = L.latLng(
        from.lat + step[0] * metres / metresPerDegree,
        from.lng + step[1] * metres / (metresPerDegree * Math.cos(from.lat * Math.PI / 180))
    )
    if (!isInside(to)) {
        playClass(draftMarker.getElement(), 'is-blocked', 340)
        say('Keep it inside the circle', 3000, true)
        return
    }
    draftMarker.setLatLng(to)
    labelMarker(draftMarker, draftLabel())
    say(`Your pin is ${metresFromStop(to)} m from the stop`, 3000)
    if (!map.getBounds().pad(-0.1).contains(to)) map.panTo(to, { animate: !reduceMotion() })
    emit('move-draft', to.lat, to.lng)
}

function drawDraft() {
    if (draftMarker) draftMarker.remove()
    draftMarker = null
    resetDragCues()
    if (!props.draft) return
    draftMarker = L.marker([props.draft.lat, props.draft.lon], {
        icon: draftIcon(props.draft.kind),
        title: `Your new ${props.draft.kind}`,
        draggable: true,
        zIndexOffset: 3000
    }).addTo(map)
    labelMarker(draftMarker, draftLabel())
    draftMarker.on('keydown', onDraftKey)
    draftMarker.on('dragstart', () => {
        dragging.value = true
        draftMarker.getElement()?.classList.add('is-lifted')
    })
    draftMarker.on('drag', () => {
        let inside = isInside(draftMarker.getLatLng())
        outside.value = !inside
        if (!inside) say('Drop it inside the circle', 0, true)
        else if (helper.value) say('')
    })
    draftMarker.on('dragend', () => {
        dragging.value = false
        outside.value = false
        draftMarker.getElement()?.classList.remove('is-lifted')
        let latlng = draftMarker.getLatLng()
        if (isInside(latlng)) {
            say('')
            emit('move-draft', latlng.lat, latlng.lng)
        } else {
            draftMarker.setLatLng([props.draft.lat, props.draft.lon])
            say('Drop it inside the circle', 3000, true)
            emit('drop-outside')
        }
        labelMarker(draftMarker, draftLabel())
        landDraft()
    })
    if (!props.draft.editing) landDraft()
}

// so the page can hand focus to the new pin, e.g. after "Place at the stop"
function focusDraft() {
    draftMarker?.getElement()?.focus()
}

defineExpose({ focusDraft })

// a radar sweep that goes round the 1 km circle once, each pin pops in as the sweep passes it
function runSweep() {
    if (reduceMotion()) return
    sweeping.value = true
    clearTimeout(sweepTimer)
    sweepTimer = setTimeout(() => { sweeping.value = false }, sweepMs + 500)
}

// leaflet draws the circle as SVG attributes, which can't read CSS variables, so read the token's value.
// Its .radius-circle class lets CSS pulse it, and turn it red, while a pin is dragged
function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

onMounted(() => {
    map = L.map(mapEl.value, { minZoom: 11, maxZoom: 19 })

    // OneMap tiles, attribution is required by their terms of use
    L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
        detectRetina: true,
        maxZoom: 19,
        minZoom: 11,
        attribution: '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> &copy; contributors | <a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'
    }).addTo(map)

    L.circle([props.stop.lat, props.stop.lon], {
        radius: props.radius,
        color: token('--wb-green'),
        weight: 2,
        dashArray: '6 6',
        fillColor: token('--wb-green'),
        fillOpacity: 0.08,
        interactive: false,
        className: 'radius-circle'
    }).addTo(map)

    let stopMarker = L.marker([props.stop.lat, props.stop.lon], {
        icon: L.divIcon({
            className: 'wb-pin',
            html: '<span class="stop-pin"><i class="bi bi-bus-front" aria-hidden="true"></i></span>',
            iconSize: [hitSize, hitSize],
            iconAnchor: [hitSize / 2, hitSize / 2]
        }),
        title: `Bus stop: ${props.stop.name}`,
        zIndexOffset: 2000
    }).addTo(map)
    labelMarker(stopMarker, `Bus stop: ${props.stop.name} (${props.stop.code})`)

    // circle.getBounds() needs the map to already have a view, so work the bounds out from the stop instead
    map.fitBounds(L.latLng(props.stop.lat, props.stop.lon).toBounds(props.radius * 2), { padding: [16, 16] })

    map.on('click', onMapClick)

    placeLayer = L.layerGroup().addTo(map)
    activityLayer = L.layerGroup().addTo(map)
    drawPlaces()
    drawDraft()
    runSweep()
})

watch(() => [props.places, props.activities], drawPlaces)
watch(() => props.draft, drawDraft)   // a new draft or it was closed. Dragging only changes its lat/lon, so it isn't redrawn

// the page moved the draft itself ("Place at the stop"), so the pin goes there and lands
watch(() => props.draft && [props.draft.lat, props.draft.lon], (spot) => {
    if (!spot || !draftMarker) return
    let at = draftMarker.getLatLng()
    if (at.lat === spot[0] && at.lng === spot[1]) return
    draftMarker.setLatLng(spot)
    labelMarker(draftMarker, draftLabel())
    landDraft()
})

watch(() => props.selectedId, (newId, oldId) => {
    for (let id of [oldId, newId]) {
        let place = props.places.find(p => p.id === id)
        let activity = props.activities.find(a => a.key === id)
        if (place && markers[id]) {
            markers[id].setIcon(pinIcon(place, id === newId))
            markers[id].setZIndexOffset(id === newId ? 1000 : 0)
            labelMarker(markers[id], placeLabel(place), id === newId)
        }
        if (activity && markers[id]) {
            markers[id].setIcon(activityIcon(activity, id === newId))
            markers[id].setZIndexOffset(id === newId ? 1000 : 500)
            labelMarker(markers[id], activityLabel(activity), id === newId)
        }
    }
    if (newId && markers[newId]) map.panTo(markers[newId].getLatLng(), { animate: !reduceMotion() })
})

// a card is hovered: light its pin. Only a class changes, so a focused pin keeps its focus
watch(() => props.hoverId, (newId, oldId) => {
    for (let id of [oldId, newId]) {
        let pin = markers[id]?.getElement()?.querySelector('.place-pin, .activity-pin')
        pin?.classList.toggle('is-linked', !!newId && id === newId)
    }
})

// just saved: the new pin pulses twice, once the pins have been redrawn with it
watch(() => props.pulseId, async (id) => {
    if (!id) return
    await nextTick()
    playClass(markers[id]?.getElement(), 'is-pulsing', 1300)
})

onBeforeUnmount(() => {
    clearTimeout(sweepTimer)
    clearTimeout(helperTimer)
    classTimers.forEach(clearTimeout)
    map.remove()
})
</script>

<template>
    <div class="stop-map-wrap" role="region" :aria-label="mapLabel">
        <div
            class="stop-map-box"
            :class="{ 'is-sweeping': sweeping, 'is-dragging': dragging, 'is-outside': outside, 'is-placing': placing }"
            @dragover.prevent="onDragOver"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop"
        >
            <div ref="mapEl" class="stop-map"></div>
            <div v-if="sweeping" class="map-sweep" aria-hidden="true"><span class="sweep-disc"></span></div>

            <!-- the pin under the pointer while a button is dragged in from the page -->
            <div v-if="ghost.visible" class="drag-ghost" :style="{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }" aria-hidden="true">
                <span class="ghost-shadow"></span>
                <span class="ghost-pin" :style="{ '--pin': ghostStyle.colour, '--glyph': ghostStyle.glyph }"><i class="bi" :class="ghostStyle.icon"></i></span>
            </div>

            <p class="map-helper" :class="{ 'is-shown': helper, 'is-warning': helperWarns }" aria-live="polite">{{ helper }}</p>
        </div>
        <ul class="map-legend" aria-label="Map key">
            <li v-for="(style, key) in placeSections" :key="key">
                <span class="legend-dot" :style="{ '--pin': style.colour, '--glyph': style.glyph }"><i class="bi" :class="style.icon" aria-hidden="true"></i></span>{{ style.label }}
            </li>
            <li v-for="(style, key) in activityStyles" :key="key">
                <span class="legend-dot legend-activity" :style="{ '--pin': style.colour, '--glyph': style.glyph }"><i class="bi" :class="style.icon" aria-hidden="true"></i></span>{{ style.label }}
            </li>
            <li><span class="legend-dot legend-stop"><i class="bi bi-bus-front" aria-hidden="true"></i></span>Bus stop</li>
        </ul>
    </div>
</template>

<style scoped>
.stop-map {
  height: 480px;
  border-radius: var(--r-card);
  background: var(--wb-surface-2);
  overflow: hidden;
  z-index: 0;
}

/* placing mode: the next tap on the map places the pin */
.is-placing .stop-map {
  cursor: crosshair;
}

/* leaflet injects these, so they need :deep() to get styled.
   .wb-pin is leaflet's 44px hit area, the pin people see is centred inside it */
.stop-map :deep(.wb-pin) {
  display: grid;
  place-items: center;
  background: none;
  border: none;
  border-radius: var(--r-pill);
}

/* the draft pin stacks its shadow, ripple and pin in one cell */
.stop-map :deep(.wb-pin > *) {
  grid-area: 1 / 1;
}

.stop-map :deep(.wb-pin:focus-visible) {
  outline: 3px solid var(--wb-ink);
  outline-offset: -3px;
}

.stop-map :deep(.place-pin),
.stop-map :deep(.activity-pin) {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pin);
  color: var(--glyph);
  border: 2px solid var(--wb-surface);
  font-size: var(--fs-body);
  line-height: 1;
  cursor: pointer;
  transition: transform var(--t-micro) var(--ease), width var(--t-micro) var(--ease), height var(--t-micro) var(--ease);
}

.stop-map :deep(.place-pin) {
  border-radius: 50%;
}

.stop-map :deep(.activity-pin) {
  border-radius: calc(var(--r-control) - 4px);
}

.stop-map :deep(.wb-pin:hover .place-pin) {
  transform: scale(1.12);
}

/* selected = green ring (the selected state colour), a touch bigger */
.stop-map :deep(.place-pin.is-selected),
.stop-map :deep(.activity-pin.is-selected) {
  width: 40px;
  height: 40px;
  font-size: var(--fs-lead);
  outline: 3px solid var(--wb-green);
  outline-offset: 1px;
}

/* its card is hovered or focused: an amber ring, the same one the card gets */
.stop-map :deep(.place-pin.is-linked),
.stop-map :deep(.activity-pin.is-linked) {
  transform: scale(1.15);
  outline: 3px solid var(--wb-amber);
  outline-offset: 1px;
}

/* ---- the draft pin ---- */
.stop-map :deep(.activity-pin.is-draft) {
  cursor: grab;
  transform-origin: 50% 100%;
}

.stop-map :deep(.wb-draft:not(.is-lifted) .activity-pin.is-draft) {
  box-shadow: var(--wb-lift); /* taste-skill-ignore: draft pin floats until it's saved (design.md §1, shadows only on things that float) */
}

/* the ground shadow: an ellipse under the anchor, shown while the pin is lifted */
.stop-map :deep(.draft-shadow) {
  width: 26px;
  height: 8px;
  border-radius: 50%;
  background: var(--wb-ink);
  opacity: 0;
  transform: translateY(14px);
  transition: opacity var(--t-micro) var(--ease);
}

/* lifted = being dragged: the pin rises off its ground ellipse */
.stop-map :deep(.is-lifted .activity-pin.is-draft) {
  cursor: grabbing;
  transform: translateY(-14px);
}

.stop-map :deep(.is-lifted .draft-shadow) {
  opacity: 0.22;
}

.is-outside .stop-map :deep(.is-lifted .activity-pin.is-draft) {
  cursor: not-allowed;
  animation: pin-shake 320ms var(--ease) infinite;
}

/* an arrow key that would push it out of the circle: one shake */
.stop-map :deep(.is-blocked .activity-pin.is-draft) {
  animation: pin-shake-flat 320ms var(--ease) 1;
}

/* let go: the pin drops 24px on a spring, squashes, and a ripple ring spreads out */
.stop-map :deep(.is-landing .activity-pin.is-draft) {
  animation: pin-drop var(--t-reveal) var(--ease-spring) both;
}

.stop-map :deep(.draft-ripple) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--wb-green);
  opacity: 0;
  pointer-events: none;
}

.stop-map :deep(.is-landing .draft-ripple) {
  animation: pin-ripple var(--t-reveal) var(--ease) both;
}

/* just saved: a ring pulses out of the pin twice */
.stop-map :deep(.is-pulsing .activity-pin::after),
.stop-map :deep(.is-pulsing .place-pin::after) {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 3px solid var(--wb-green);
  opacity: 0;
  animation: pin-pulse 600ms var(--ease) 2;
}

@keyframes pin-shake {
  0%, 100% { transform: translateY(-14px) rotate(0deg); }
  25% { transform: translateY(-14px) rotate(-3deg); }
  75% { transform: translateY(-14px) rotate(3deg); }
}

@keyframes pin-shake-flat {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}

@keyframes pin-drop {
  0% { transform: translateY(-24px) scaleY(1); }
  60% { transform: translateY(0) scaleY(0.8); }
  100% { transform: translateY(0) scaleY(1); }
}

@keyframes pin-ripple {
  0% { opacity: 0.7; transform: scale(0.5); }
  100% { opacity: 0; transform: scale(2.2); }
}

@keyframes pin-pulse {
  0% { opacity: 0.8; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.8); }
}

/* ---- the 1 km circle: pulses while a pin is dragged, red when the pin is outside it ---- */
.stop-map :deep(.radius-circle) {
  transition: stroke var(--t-micro) var(--ease), fill var(--t-micro) var(--ease);
}

.is-dragging .stop-map :deep(.radius-circle) {
  animation: circle-pulse var(--t-signature) var(--ease) infinite;
}

.is-outside .stop-map :deep(.radius-circle) {
  stroke: var(--wb-danger);
  fill: var(--wb-danger);
}

/* the stroke and fill are the cue the spec asks for (design.md §4.4), it's an SVG path so there's no transform for it */
@keyframes circle-pulse {
  0%, 100% { stroke-width: 2px; fill-opacity: 0.08; }
  50% { stroke-width: 4px; fill-opacity: 0.14; }
}

.stop-map :deep(.stop-pin) {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--r-control) - 4px);
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  border: 2px solid var(--wb-amber);
  font-size: var(--fs-body);
  line-height: 1;
}

.stop-map-box {
  position: relative;
}

/* ---- the ghost pin that follows a button dragged in from the page ---- */
.drag-ghost {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 500;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ghost-shadow,
.ghost-pin {
  position: absolute;
  left: 0;
  top: 0;
}

.ghost-shadow {
  width: 26px;
  height: 8px;
  margin: -4px 0 0 -13px;
  border-radius: 50%;
  background: var(--wb-ink);
  opacity: 0.22;
}

.ghost-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: -16px 0 0 -16px;
  border-radius: calc(var(--r-control) - 4px);
  border: 2px solid var(--wb-surface);
  background: var(--pin);
  color: var(--glyph);
  line-height: 1;
  transform: translateY(-18px);
  opacity: 0.9;
}

.is-outside .ghost-pin {
  animation: pin-shake-ghost 320ms var(--ease) infinite;
}

@keyframes pin-shake-ghost {
  0%, 100% { transform: translateY(-18px) rotate(0deg); }
  25% { transform: translateY(-18px) rotate(-3deg); }
  75% { transform: translateY(-18px) rotate(3deg); }
}

/* the live helper line, pinned to the bottom of the map */
.map-helper {
  position: absolute;
  left: 50%;
  bottom: var(--sp-3);
  z-index: 600;
  max-width: calc(100% - var(--sp-6));
  margin: 0;
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-pill);
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  font-size: var(--fs-small);
  font-weight: 500;
  text-align: center;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 8px);
  transition: opacity var(--t-micro) var(--ease), transform var(--t-micro) var(--ease);
}

.map-helper.is-shown {
  opacity: 1;
  transform: translate(-50%, 0);
}

.map-helper.is-warning {
  background: var(--wb-danger);
}

/* the sweep sits on top of the map, sized to the 1 km circle (the map is fitted to it) */
.map-sweep {
  position: absolute;
  inset: 0;
  z-index: 450;
  display: grid;
  place-items: center;
  border-radius: var(--r-card);
  overflow: hidden;
  pointer-events: none;
  container-type: size;
  animation: sweep-fade 0.3s var(--ease) 2.2s both;
}

.sweep-disc {
  width: calc(min(100cqw, 100cqh) - 32px);
  aspect-ratio: 1;
  border-radius: 50%;
  /* the radar sweep is one of the two gradients the design allows (design.md §1) */
  background: conic-gradient(from 0deg, transparent 0deg 270deg, color-mix(in srgb, var(--wb-green) 4%, transparent) 270deg, color-mix(in srgb, var(--wb-green) 38%, transparent) 358deg, color-mix(in srgb, var(--wb-amber) 90%, transparent) 360deg); /* taste-skill-ignore: radar sweep, kept by design.md §0.3/§1 */
  animation: sweep-turn 2s linear both;
}

@keyframes sweep-turn {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes sweep-fade {
  to { opacity: 0; }
}

/* while the sweep runs, each pin pops in when the sweep reaches its slice */
.is-sweeping :deep(.place-pin) {
  animation: pin-pop 380ms var(--ease) both;
}

.is-sweeping :deep(.wave-1) { animation-delay: 167ms; }
.is-sweeping :deep(.wave-2) { animation-delay: 333ms; }
.is-sweeping :deep(.wave-3) { animation-delay: 500ms; }
.is-sweeping :deep(.wave-4) { animation-delay: 667ms; }
.is-sweeping :deep(.wave-5) { animation-delay: 833ms; }
.is-sweeping :deep(.wave-6) { animation-delay: 1000ms; }
.is-sweeping :deep(.wave-7) { animation-delay: 1167ms; }
.is-sweeping :deep(.wave-8) { animation-delay: 1333ms; }
.is-sweeping :deep(.wave-9) { animation-delay: 1500ms; }
.is-sweeping :deep(.wave-10) { animation-delay: 1667ms; }
.is-sweeping :deep(.wave-11) { animation-delay: 1833ms; }

@keyframes pin-pop {
  from { opacity: 0; transform: scale(0.3); }
  60% { opacity: 1; transform: scale(1.15); }
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  list-style: none;
  padding: 0;
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-meta);
  color: var(--wb-text-2);
}

.map-legend li {
  display: inline-flex;
  align-items: center;
}

.legend-dot {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-right: var(--sp-1);
  background: var(--pin);
  color: var(--glyph);
  font-size: 10px;
}

.legend-activity {
  border-radius: 4px;
}

.legend-stop {
  background: var(--wb-ink);
  color: var(--wb-on-ink);
  border: 2px solid var(--wb-amber);
  border-radius: 4px;
}

@media (max-width: 991.98px) {
  .stop-map {
    height: 340px;
  }
}
</style>
