<script setup>
const props = defineProps({
    place: Object,
    stop: Object,
    selected: Boolean,
    photos: { type: Array, default: () => [] },   // newest first
    uploading: Boolean
})

const emit = defineEmits(['select', 'upload'])

const style = computed(() => placeStyle(props.place.category))
const fileInput = ref(null)

function onFilePicked(event) {
    emit('upload', props.place, event.target.files[0])
    event.target.value = ''   // so picking the same file again still triggers change
}

const walkLink = computed(() =>
    `https://www.google.com/maps/dir/?api=1&origin=${props.stop.lat},${props.stop.lon}&destination=${props.place.lat},${props.place.lon}&travelmode=walking`
)
</script>

<template>
    <article :id="`place-${place.id}`" class="place-card" :class="{ 'is-selected': selected }" @click="$emit('select', place.id)">
        <div v-if="photos.length" class="place-photo has-photo">
            <img :src="photos[0].url" :alt="`Photo of ${place.name}`" loading="lazy" />
            <span v-if="photos.length > 1" class="photo-count">📷 {{ photos.length }}</span>
        </div>
        <div v-else class="place-photo undiscovered" :style="{ background: style.tint, color: style.colour }">
            <span class="place-photo-icon">{{ style.icon }}</span>
            <span class="place-photo-label">Undiscovered</span>
        </div>

        <div class="place-body">
            <span class="place-badge" :style="{ background: style.tint, color: style.colour }">{{ style.label }}</span>
            <span v-if="place.preferred" class="place-badge pick-badge">⭐ Your pick</span>
            <h3 class="place-name">{{ place.name }}</h3>
            <p class="place-subtype">{{ place.subtype }}</p>
            <p class="place-walk">🚶 <strong>{{ place.walkMin }} min walk</strong> · {{ place.distanceM }} m from the stop</p>
            <p v-if="!photos.length" class="place-pioneer-note">📷 No photos yet. The first one earns Pioneer credit (+100).</p>

            <div class="place-actions">
                <button type="button" class="btn-photo" :class="{ pioneer: !photos.length }" :disabled="uploading" @click.stop="fileInput.click()">
                    {{ uploading ? 'Uploading...' : photos.length ? '📷 Add a photo' : '📷 Be the Pioneer' }}
                </button>
                <a :href="walkLink" target="_blank" rel="noopener noreferrer" class="btn-walk" @click.stop>Walk there</a>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="d-none" @click.stop @change="onFilePicked" />
        </div>
    </article>
</template>

<style scoped>
.place-card {
  flex-shrink: 0;   /* the list is a fixed-height flex column, without this the cards get squashed into lines */
  display: grid;
  grid-template-columns: 120px 1fr;
  background: #fff;
  border: 1px solid #e3e5ec;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.place-card:hover {
  border-color: #c9ccd6;
}

.place-card.is-selected {
  border-color: #f5a623;
  box-shadow: 0 0 0 2px #f5a623;
}

.place-photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background-image: radial-gradient(rgba(20, 26, 51, 0.08) 1px, transparent 1px) !important;
  background-size: 12px 12px !important;
}

.place-photo-icon {
  font-size: 1.6rem;
}

.place-photo-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.place-body {
  padding: 14px 16px;
}

.place-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 50px;
  padding: 2px 10px;
}

.pick-badge {
  margin-left: 6px;
  background: #fdf3d7;
  color: #7a5200;
}

.place-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: #141a33;
  margin: 8px 0 2px;
}

.place-subtype {
  font-size: 0.85rem;
  color: #6b7085;
  margin-bottom: 8px;
}

.place-walk {
  font-size: 0.85rem;
  color: #4a5068;
  margin-bottom: 10px;
}

.btn-walk {
  display: inline-block;
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 5px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}

.btn-walk:hover {
  background: #f1f2f6;
}

.place-photo.has-photo {
  position: relative;
  padding: 0;
  background: #e3e5ec !important;
}

.place-photo.has-photo img {
  width: 100%;
  height: 100%;
  min-height: 150px;
  object-fit: cover;
}

.photo-count {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(20, 26, 51, 0.75);
  color: #fff;
  border-radius: 50px;
  padding: 1px 8px;
  font-size: 0.75rem;
}

.place-pioneer-note {
  font-size: 0.8rem;
  color: #7a5200;
  margin-bottom: 10px;
}

.place-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-photo {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 5px 14px;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-photo.pioneer {
  background: #f5a623;
  border-color: #f5a623;
}

.btn-photo:hover:not(:disabled) {
  filter: brightness(0.95);
}

.btn-photo:disabled {
  opacity: 0.6;
}

@media (max-width: 575.98px) {
  .place-card {
    grid-template-columns: 88px 1fr;
  }
}
</style>
