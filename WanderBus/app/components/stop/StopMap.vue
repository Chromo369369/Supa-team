<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
    stop: Object,       // { code, name, road, lat, lon }
    radius: Number,     // metres
    places: Array,      // places currently shown (already filtered by category)
    activities: { type: Array, default: () => [] },   // signposts/challenges currently shown (feature 3)
    draft: Object,      // { kind, lat, lon } while leaving a signpost/challenge, else null
    selectedId: String  // a place id or an activity key ('signpost:12')
})

const emit = defineEmits(['select', 'drop', 'drop-outside', 'move-draft'])

const waves = 12        // the sweep is split into 12 slices of 30 degrees
const sweepMs = 2000
const hitSize = 44      // every pin is a 44px tap target, the visible circle/square sits inside it

const mapEl = ref(null)
const sweeping = ref(false)
let map = null
let placeLayer = null
let activityLayer = null
let draftMarker = null
let markers = {}    // place id / activity key -> leaflet marker
let sweepTimer = null

const mapLabel = computed(() => `Map of places within ${props.radius >= 1000 ? `${props.radius / 1000} km` : `${props.radius} m`} of ${props.stop.name}`)

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

function pinIcon(place, selected) {
    return L.divIcon({
        className: 'wb-pin',
        html: pinHtml('place-pin', placeStyle(place.category), selected, `wave-${waveOf(place)}`),
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize / 2]
    })
}

function activityIcon(activity, selected, isDraft = false) {
    return L.divIcon({
        className: 'wb-pin',
        html: pinHtml('activity-pin', activityStyles[activity.kind], selected, isDraft ? 'is-draft' : ''),
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

function isInside(latlng) {
    return distanceInMetres(props.stop.lat, props.stop.lon, latlng.lat, latlng.lng) <= props.radius
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
        markers[place.id] = marker
    }
}

// the "Leave a signpost" / "Set a challenge" button was dropped on the map
function onDrop(event) {
    let kind = event.dataTransfer.getData('text/plain')
    if (kind != 'signpost' && kind != 'challenge') return
    let latlng = map.mouseEventToLatLng(event)
    if (isInside(latlng)) emit('drop', kind, latlng.lat, latlng.lng)
    else emit('drop-outside')
}

// the pin being placed, draggable until it's saved. Dragged outside the circle = snaps back
function drawDraft() {
    if (draftMarker) draftMarker.remove()
    draftMarker = null
    if (!props.draft) return
    let label = `Your new ${props.draft.kind}, drag to move it`
    draftMarker = L.marker([props.draft.lat, props.draft.lon], {
        icon: activityIcon(props.draft, true, true),
        title: label,
        draggable: true,
        zIndexOffset: 3000
    }).addTo(map)
    labelMarker(draftMarker, label)
    draftMarker.on('dragend', () => {
        let latlng = draftMarker.getLatLng()
        if (isInside(latlng)) {
            emit('move-draft', latlng.lat, latlng.lng)
        } else {
            draftMarker.setLatLng([props.draft.lat, props.draft.lon])
            emit('drop-outside')
        }
    })
}

// a radar sweep that goes round the 1 km circle once, each pin pops in as the sweep passes it
function runSweep() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    sweeping.value = true
    clearTimeout(sweepTimer)
    sweepTimer = setTimeout(() => { sweeping.value = false }, sweepMs + 500)
}

// leaflet draws the circle as SVG attributes, which can't read CSS variables, so read the token's value
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
        interactive: false
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

    placeLayer = L.layerGroup().addTo(map)
    activityLayer = L.layerGroup().addTo(map)
    drawPlaces()
    drawDraft()
    runSweep()
})

watch(() => [props.places, props.activities], drawPlaces)
watch(() => props.draft, drawDraft)   // a new draft or it was closed. Dragging only changes its lat/lon, so it isn't redrawn

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
    if (newId && markers[newId]) map.panTo(markers[newId].getLatLng())
})

onBeforeUnmount(() => {
    clearTimeout(sweepTimer)
    map.remove()
})
</script>

<template>
    <div class="stop-map-wrap" role="region" :aria-label="mapLabel" @dragover.prevent @drop.prevent="onDrop">
        <div class="stop-map-box" :class="{ 'is-sweeping': sweeping }">
            <div ref="mapEl" class="stop-map"></div>
            <div v-if="sweeping" class="map-sweep" aria-hidden="true"><span class="sweep-disc"></span></div>
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

/* leaflet injects these, so they need :deep() to get styled.
   .wb-pin is leaflet's 44px hit area, the pin people see is centred inside it */
.stop-map :deep(.wb-pin) {
  display: grid;
  place-items: center;
  background: none;
  border: none;
  border-radius: var(--r-pill);
}

.stop-map :deep(.wb-pin:focus-visible) {
  outline: 3px solid var(--wb-ink);
  outline-offset: -3px;
}

.stop-map :deep(.place-pin),
.stop-map :deep(.activity-pin) {
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

/* the draft pin is the one thing on the map that floats: it's being dragged */
.stop-map :deep(.activity-pin.is-draft) {
  cursor: grab;
  box-shadow: var(--wb-lift); /* taste-skill-ignore: dragged pin floats (design.md §1, shadows only on things that float) */
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
