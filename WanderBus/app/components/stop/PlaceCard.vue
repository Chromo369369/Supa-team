<script setup>
import PhotoViewer from '~/components/ui/PhotoViewer.vue'
const props = defineProps({
    place: Object,
    stop: Object,
    selected: Boolean,
    photos: { type: Array, default: () => [] },   // newest first
    uploading: Boolean,
    isAdmin: Boolean
})

const emit = defineEmits(['select', 'upload', 'delete-photo'])

const style = computed(() => placeStyle(props.place.category))
const fileInput = ref(null)
function onFilePicked(event) {
    if (event.target.files[0]) emit('upload', props.place, event.target.files[0])
    event.target.value = ''   // so picking the same file again still triggers change
}

// the cover is the Pioneer photo (the first one ever posted) when there is one, otherwise the newest
const coverIndex = computed(() => {
    const pioneer = props.photos.findIndex(photo => photo.is_pioneer)
    return pioneer === -1 ? 0 : pioneer
})
const cover = computed(() => props.photos[coverIndex.value])

// the gallery gets every photo of this place, newest first (same order as the prop), and opens on the cover
const viewer = ref(null)
const galleryPhotos = computed(() => props.photos.map((photo, i) => ({
    url: photo.url,
    alt: `Photo ${i + 1} of ${props.place.name}`,
    isPioneer: photo.is_pioneer,
    createdAt: photo.created_at
})))
const galleryLabel = computed(() => props.photos.length > 1
    ? `See all ${props.photos.length} photos of ${props.place.name}`
    : `See the photo of ${props.place.name}`)

const walkLink = computed(() =>
    `https://www.google.com/maps/dir/?api=1&origin=${props.stop.lat},${props.stop.lon}&destination=${props.place.lat},${props.place.lon}&travelmode=walking`
)
</script>

<template>
    <!-- the card itself isn't clickable: the name is the button that picks the pin, the other controls sit beside it -->
    <article :id="`place-${place.id}`" class="place-card" :class="{ 'is-selected': selected }">
        <!-- the photo and its count are one button that opens the gallery -->
        <button v-if="photos.length" type="button" class="place-photo has-photo" :aria-label="galleryLabel" @click="viewer.open(coverIndex)">
            <img :src="cover.url" :alt="`${cover.is_pioneer ? 'Pioneer photo' : 'Photo'} of ${place.name}`" width="120" height="120" loading="lazy" decoding="async" />
            <span v-if="photos.length > 1" class="photo-count num" aria-hidden="true">
                <i class="bi bi-images"></i> {{ photos.length }}
            </span>
        </button>
        <div v-else class="place-photo undiscovered">
            <i class="bi bi-camera" aria-hidden="true"></i>
            <span class="place-photo-label">Be the first to add a photo</span>
        </div>

        <div class="place-body">
            <div class="place-badges">
                <span class="place-badge" :style="{ background: style.tint, color: style.text }">
                    <i class="bi" :class="style.icon" aria-hidden="true"></i> {{ style.label }}
                </span>
                <span v-if="place.preferred" class="place-badge pick-badge"><i class="bi bi-star-fill" aria-hidden="true"></i> Your pick</span>
            </div>
            <h3 class="place-name">
                <button type="button" class="title-btn" :aria-current="selected ? 'true' : undefined" @click="emit('select', place.id)">
                    {{ place.name }}
                </button>
            </h3>
            <p class="place-subtype">{{ place.subtype }}</p>
            <p class="place-walk">
                <i class="bi bi-person-walking" aria-hidden="true"></i>
                <strong class="num">{{ place.walkMin }} min walk</strong> · <span class="num">{{ place.distanceM }} m</span> from the stop
            </p>
            <p v-if="!photos.length" class="place-pioneer-note">
                <i class="bi bi-award-fill" aria-hidden="true"></i> Post the first photo to become this place’s Pioneer (<span class="num">+100</span> credits).
            </p>

            <div class="place-actions">
                <button type="button" class="btn-wb btn-wb-secondary btn-sm" :disabled="uploading" :aria-busy="uploading ? 'true' : undefined" @click="fileInput.click()">
                    <i v-if="!uploading" class="bi bi-camera" aria-hidden="true"></i>
                    {{ uploading ? 'Uploading…' : photos.length ? 'Add a photo' : 'Add the first photo' }}
                </button>
                <a :href="walkLink" target="_blank" rel="noopener noreferrer" class="btn-wb-ghost btn-sm">
                    Walk there <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i><span class="visually-hidden"> (opens Google Maps in a new tab)</span>
                </a>
                <button type="button" class="btn-wb btn-wb-danger btn-sm" @click="emit(`delete-photo`,place,cover)" :hidden="!isAdmin || !photos.length">
                  Delete Photo
                </button>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="d-none" tabindex="-1" aria-hidden="true" @change="onFilePicked" />
        </div>

        <PhotoViewer v-if="photos.length" ref="viewer" :photos="galleryPhotos" :title="`Photos of ${place.name}`" />
    </article>
</template>

<style scoped>
.place-card {
  flex-shrink: 0;   /* the list is a fixed-height flex column, without this the cards get squashed into lines */
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: start;
  gap: var(--sp-4);
  background: var(--wb-surface-2);
  border-radius: var(--r-card);
  padding: var(--sp-3);
}

.place-card.is-selected {
  outline: 3px solid var(--wb-green);
  outline-offset: 0;
}

.place-photo {
  aspect-ratio: 1;
  width: 100%;
  border-radius: var(--r-control);
  overflow: hidden;
}

.place-photo.undiscovered {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  padding: var(--sp-2);
  background: var(--wb-surface);
  color: var(--wb-text-2);
  text-align: center;
}

.place-photo.undiscovered .bi {
  font-size: 24px;
}

.place-photo-label {
  font-size: var(--fs-meta);
  line-height: 1.3;
}

.place-photo.has-photo {
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  background: var(--wb-line);
  cursor: zoom-in;
}

.place-photo.has-photo:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.place-photo.has-photo img {
  transition: transform var(--t-ui) var(--ease);
}

.place-photo.has-photo:hover img {
  transform: scale(1.04);
}

@media (prefers-reduced-motion: reduce) {
  .place-photo.has-photo img { transition: none; }
  .place-photo.has-photo:hover img { transform: none; }
}

.place-photo.has-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-count {
  position: absolute;
  bottom: var(--sp-1);
  left: var(--sp-1);
  background: color-mix(in srgb, var(--wb-ink) 80%, transparent);
  color: var(--wb-on-ink);
  border-radius: var(--r-pill);
  padding: 2px var(--sp-2);
  font-size: var(--fs-meta);
}

.place-body {
  min-width: 0;
  padding: var(--sp-1) var(--sp-1) var(--sp-1) 0;
}

.place-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.place-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-meta);
  font-weight: 500;
  border-radius: var(--r-pill);
  padding: 2px 10px;
}

.pick-badge {
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
}

.place-name {
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.25;
  margin: var(--sp-2) 0 var(--sp-1);
}

/* the name is the button that picks the pin on the map */
.title-btn {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: var(--sp-1) 0;
  background: none;
  border: none;
  border-radius: var(--r-control);
  color: var(--wb-ink);
  font: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.title-btn:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.title-btn:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.place-subtype {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  margin: 0 0 var(--sp-2);
}

.place-walk {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
  margin: 0 0 var(--sp-3);
}

.place-walk strong {
  font-weight: 600;
  color: var(--wb-ink);
}

.place-pioneer-note {
  font-size: var(--fs-small);
  color: var(--wb-amber-ink);
  margin: 0 0 var(--sp-3);
}

.place-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

/* the ghost button's hover tone is the card's own tone, so step to the surface instead */
.place-actions .btn-wb-ghost:hover {
  background: var(--wb-surface);
}

@media (max-width: 575.98px) {
  .place-card {
    grid-template-columns: 88px minmax(0, 1fr);
    gap: var(--sp-3);
  }
}
</style>
