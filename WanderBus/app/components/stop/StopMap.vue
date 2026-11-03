<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
    stop: Object,       // { code, name, road, lat, lon }
    radius: Number,     // metres
    places: Array,      // places currently shown (already filtered by category)
    selectedId: String
})

const emit = defineEmits(['select'])

const waves = 12        // the sweep is split into 12 slices of 30 degrees
const sweepMs = 2000

const mapEl = ref(null)
const sweeping = ref(false)
let map = null
let placeLayer = null
let markers = {}    // place id -> leaflet marker
let sweepTimer = null

// which slice of the sweep a place is in, from its compass bearing (0 = north, clockwise)
function waveOf(place) {
    let dx = (place.lon - props.stop.lon) * Math.cos(props.stop.lat * Math.PI / 180)
    let dy = place.lat - props.stop.lat
    let bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
    return Math.min(waves - 1, Math.floor(bearing / (360 / waves)))
}

function pinIcon(place, selected) {
    const style = placeStyle(place.category)
    const size = selected ? 44 : 32
    return L.divIcon({
        className: '',
        html: `<div class="place-pin wave-${waveOf(place)} ${selected ? 'is-selected' : ''}" style="--pin:${style.colour}">${style.icon}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    })
}

function drawPlaces() {
    placeLayer.clearLayers()
    markers = {}
    for (let place of props.places) {
        let selected = place.id === props.selectedId
        let marker = L.marker([place.lat, place.lon], {
            icon: pinIcon(place, selected),
            title: place.name,
            zIndexOffset: selected ? 1000 : 0
        })
        marker.on('click', () => emit('select', place.id))
        marker.addTo(placeLayer)
        markers[place.id] = marker
    }
}

// a radar sweep that goes round the 1 km circle once, each pin pops in as the sweep passes it
function runSweep() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    sweeping.value = true
    clearTimeout(sweepTimer)
    sweepTimer = setTimeout(() => { sweeping.value = false }, sweepMs + 500)
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

    const walkCircle = L.circle([props.stop.lat, props.stop.lon], {
        radius: props.radius,
        color: '#1e8a4c',
        weight: 2,
        dashArray: '6 6',
        fillColor: '#1e8a4c',
        fillOpacity: 0.08
    }).addTo(map)

    L.marker([props.stop.lat, props.stop.lon], {
        icon: L.divIcon({ className: '', html: '<div class="stop-pin">🚌</div>', iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: props.stop.name,
        zIndexOffset: 2000
    }).addTo(map)

    // circle.getBounds() needs the map to already have a view, so work the bounds out from the stop instead
    map.fitBounds(L.latLng(props.stop.lat, props.stop.lon).toBounds(props.radius * 2), { padding: [16, 16] })

    placeLayer = L.layerGroup().addTo(map)
    drawPlaces()
    runSweep()
})

watch(() => props.places, drawPlaces)

watch(() => props.selectedId, (newId, oldId) => {
    for (let id of [oldId, newId]) {
        let place = props.places.find(p => p.id === id)
        if (!place) continue
        markers[id].setIcon(pinIcon(place, id === newId))
        markers[id].setZIndexOffset(id === newId ? 1000 : 0)
    }
    if (newId) map.panTo(markers[newId].getLatLng())
})

onBeforeUnmount(() => {
    clearTimeout(sweepTimer)
    map.remove()
})
</script>

<template>
    <div class="stop-map-wrap">
        <div class="stop-map-box" :class="{ 'is-sweeping': sweeping }">
            <div ref="mapEl" class="stop-map"></div>
            <div v-if="sweeping" class="map-sweep" aria-hidden="true"><span class="sweep-disc"></span></div>
        </div>
        <ul class="map-legend">
            <li v-for="(style, key) in placeSections" :key="key">
                <span class="legend-dot" :style="{ background: style.colour }"></span>{{ style.label }}
            </li>
            <li><span class="legend-dot legend-stop"></span>Bus stop</li>
        </ul>
    </div>
</template>

<style scoped>
.stop-map {
  height: 480px;
  border: 1px solid #e3e5ec;
  border-radius: 16px;
  overflow: hidden;
  z-index: 0;
}

/* leaflet injects these, so they need :deep() to get styled */
.stop-map :deep(.place-pin) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--pin);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(20, 26, 51, 0.35);
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.15s;
}

.stop-map :deep(.place-pin:hover) {
  transform: scale(1.12);
}

.stop-map :deep(.place-pin.is-selected) {
  font-size: 20px;
  box-shadow: 0 0 0 4px #f5a623, 0 2px 8px rgba(20, 26, 51, 0.4);
}

.stop-map :deep(.stop-pin) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #141a33;
  border: 2px solid #f5a623;
  font-size: 17px;
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
  border-radius: 16px;
  overflow: hidden;
  pointer-events: none;
  container-type: size;
  animation: sweep-fade 0.3s ease 2.2s both;
}

.sweep-disc {
  width: calc(min(100cqw, 100cqh) - 32px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0deg 270deg, rgba(30, 138, 76, 0.04) 270deg, rgba(30, 138, 76, 0.38) 358deg, rgba(245, 166, 35, 0.9) 360deg);
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
  animation: pin-pop 380ms ease-out both;
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
  gap: 4px 16px;
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: #4a5068;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
}

.legend-stop {
  background: #141a33;
  border: 2px solid #f5a623;
  border-radius: 2px;
}

@media (max-width: 991.98px) {
  .stop-map {
    height: 340px;
  }
}
</style>
