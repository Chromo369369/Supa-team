<!--
  End adventure dialog (F1). Mounted once in layouts/default.vue, opened through useAdventure().endPrompt
  (by AdventureBar or SpinResults' End adventure). Native <dialog>: focus stays inside, Esc keeps exploring,
  and focus goes back to the button that opened it (or to <main> when that button is gone after End).
  Shows the trip like a passport stamp, with optional notes and a photo (shrunk by utils/compressImage), then Save to passport / End without saving /
  Keep exploring. A trip already saved from the ticket says so instead of offering a second save.
-->
<script setup lang="ts">
const { session, active, elapsed, endPrompt, end, save } = useAdventure()
const toast = useToast()

const dialog = ref<HTMLDialogElement | null>(null)
const keepBtn = ref<HTMLButtonElement | null>(null)
const notes = ref('')
const photo = ref<string | null>(null)   // JPEG data URL, the format passport.vue stores in photo_url
const photoBusy = ref(false)
const photoError = ref('')
const photoInput = ref<HTMLInputElement | null>(null)
const addPhotoBtn = ref<HTMLButtonElement | null>(null)
const saving = ref(false)
const saveError = ref('')
// undefined while closed; null when nothing had focus at open time
let opener: HTMLElement | null | undefined

const trip = computed(() => session.value?.trip ?? null)
const saved = computed(() => session.value?.saved ?? false)

const outFor = computed(() => {
  const min = Math.floor(elapsed.value / 60)
  if (min < 1) return 'less than a minute'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
})

function close() {
  endPrompt.value = false
}

watch(endPrompt, async (open) => {
  await nextTick()
  const el = dialog.value
  if (!el) return
  if (open && active.value && !el.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    notes.value = ''
    photo.value = null
    photoError.value = ''
    saveError.value = ''
    el.showModal()
    keepBtn.value?.focus()
  } else if (!open && opener !== undefined) {
    if (el.open) el.close()
    // the bar (or the ticket's button) is gone once the adventure ended, so fall back to the page
    const target = opener?.isConnected ? opener : document.getElementById('main')
    target?.focus()
    opener = undefined
  }
})

// nothing to end any more (ended elsewhere): close too
watch(active, (isActive) => { if (!isActive) close() })

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value && !saving.value) close()
}

function pickPhoto() {
  photoInput.value?.click()
}

// the same checks and messages as passport.vue's handleFile
async function onPhotoPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // so picking the same file again still fires change
  photoError.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    photoError.value = 'Choose an image file, like a JPG, PNG or WEBP.'
    return
  }
  if (file.size > PHOTO_MAX_FILE_MB * 1024 * 1024) {
    photoError.value = `That image is over ${PHOTO_MAX_FILE_MB} MB. Pick a smaller one.`
    return
  }
  photoBusy.value = true
  try {
    photo.value = await compressImage(file)
  } catch {
    photoError.value = 'Couldn’t read that image. If it’s a HEIC photo, convert it to JPG first.'
  } finally {
    photoBusy.value = false
  }
}

async function removePhoto() {
  photo.value = null
  photoError.value = ''
  await nextTick()
  addPhotoBtn.value?.focus()
}

async function onSave() {
  if (saving.value || photoBusy.value || !active.value) return
  saving.value = true
  saveError.value = ''
  try {
    await save(notes.value, photo.value)
    toast.success('Saved to your passport', { action: { label: 'View passport', run: () => navigateTo('/passport') } })
    end()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Check your connection and try again.'
    saveError.value = `Couldn’t save your trip: ${message}`
    toast.error(`Couldn’t save your trip: ${message}`, { action: { label: 'Retry', run: onSave } })
  } finally {
    saving.value = false
  }
}

function endWithoutSaving() {
  end()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="adv-end"
    aria-labelledby="adv-end-title"
    @cancel.prevent="close"
    @close="close"
    @click="onBackdrop"
  >
    <div v-if="trip" class="adv-end-inner">
      <h2 id="adv-end-title" class="adv-end-title">
        {{ saved ? 'Already in your passport' : 'End this adventure?' }}
      </h2>
      <p class="adv-end-lead">You’ve been out for <span class="num">{{ outFor }}</span>.</p>

      <!-- the trip as a passport stamp -->
      <div class="adv-stamp">
        <dl class="adv-stamp-route">
          <div>
            <dt class="adv-stamp-label">From</dt>
            <dd class="adv-stamp-value">{{ trip.starting_stop }}</dd>
          </div>
          <i class="bi bi-arrow-right adv-stamp-arrow" aria-hidden="true"></i>
          <div>
            <dt class="adv-stamp-label">To</dt>
            <dd class="adv-stamp-value">{{ trip.end_stop }}</dd>
          </div>
        </dl>
        <p class="adv-stamp-meta">
          <span v-if="trip.bus_taken"><i class="bi bi-bus-front" aria-hidden="true"></i> Bus <span class="num">{{ trip.bus_taken }}</span></span>
          <span v-else><i class="bi bi-person-walking" aria-hidden="true"></i> Walk</span>
          <span><i class="bi bi-stopwatch" aria-hidden="true"></i> About <span class="num">{{ trip.time_taken }}</span> min</span>
        </p>
      </div>

      <template v-if="!saved">
        <label for="adv-end-notes" class="adv-end-label">Notes for your passport (optional)</label>
        <textarea
          id="adv-end-notes"
          v-model="notes"
          class="form-control"
          rows="3"
          maxlength="500"
          placeholder="What did you find there?"
        ></textarea>

        <!-- photo: a real file input (visually hidden) behind visible buttons, like passport.vue.
             No capture attribute on purpose: phones then offer the camera and the photo library. -->
        <div class="adv-photo">
          <label for="adv-end-photo" class="adv-end-label">Photo for your passport (optional)</label>
          <input
            id="adv-end-photo"
            ref="photoInput"
            type="file"
            accept="image/*"
            class="visually-hidden"
            tabindex="-1"
            aria-describedby="adv-end-photo-hint"
            @change="onPhotoPicked"
          >
          <div v-if="photo" class="adv-photo-preview">
            <img :src="photo" alt="Your photo for this trip" class="adv-photo-img" width="96" height="96">
            <div class="adv-photo-actions">
              <button type="button" class="btn-wb-secondary btn-sm" :disabled="photoBusy || saving" aria-describedby="adv-end-photo-hint" @click="pickPhoto">
                <i class="bi bi-arrow-repeat" aria-hidden="true"></i> Replace photo
              </button>
              <button type="button" class="btn-wb-ghost btn-sm" :disabled="photoBusy || saving" @click="removePhoto">
                <i class="bi bi-trash3" aria-hidden="true"></i> Remove photo
              </button>
            </div>
          </div>
          <button
            v-else
            ref="addPhotoBtn"
            type="button"
            class="btn-wb-secondary btn-sm"
            :disabled="photoBusy || saving"
            :aria-busy="photoBusy"
            aria-describedby="adv-end-photo-hint"
            @click="pickPhoto"
          >
            <i class="bi bi-camera" aria-hidden="true"></i>
            {{ photoBusy ? 'Preparing photo…' : 'Add a photo' }}
          </button>
          <p id="adv-end-photo-hint" class="adv-photo-hint">
            One image up to <span class="num">{{ PHOTO_MAX_FILE_MB }}</span> MB. It’s shrunk before saving.
          </p>
          <p v-if="photoError" class="adv-end-error" role="alert">
            <i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ photoError }}
          </p>
        </div>

        <p v-if="saveError" class="adv-end-error" role="alert">
          <i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ saveError }}
        </p>
      </template>

      <div class="adv-end-actions">
        <button ref="keepBtn" type="button" class="btn-wb-ghost" :disabled="saving" @click="close">
          Keep exploring
        </button>
        <template v-if="saved">
          <NuxtLink to="/passport" class="btn-wb-secondary" @click="close">View passport</NuxtLink>
          <button type="button" class="btn-wb-primary" @click="endWithoutSaving">End adventure</button>
        </template>
        <template v-else>
          <button type="button" class="btn-wb-secondary" :disabled="saving" @click="endWithoutSaving">
            End without saving
          </button>
          <button type="button" class="btn-wb-primary" :aria-busy="saving" :disabled="saving || photoBusy" @click="onSave">
            {{ saving ? 'Saving…' : saveError ? 'Try again' : 'Save to passport' }}
          </button>
        </template>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.adv-end {
  width: min(480px, calc(100vw - 2 * var(--gutter)));
  max-height: calc(100dvh - 2 * var(--sp-4));
  padding: 0;
  border: 0;
  border-radius: var(--r-card);
  background: var(--wb-surface);
  color: var(--wb-ink);
  box-shadow: var(--wb-float); /* taste-skill-ignore: floating overlay */
}
.adv-end::backdrop { background: rgba(20, 26, 51, .5); }

.adv-end-inner { padding: var(--sp-5); }

.adv-end-title {
  margin: 0 0 var(--sp-1);
  font-family: var(--font-ui);
  font-size: var(--fs-lead);
  font-weight: 600;
}

.adv-end-lead {
  margin: 0 0 var(--sp-4);
  color: var(--wb-text-2);
}

/* the stamp: a green-tinted plate with a dashed edge, like the ink stamps on the passport page */
.adv-stamp {
  margin-bottom: var(--sp-5);
  padding: var(--sp-4);
  border: 2px dashed var(--wb-green);
  border-radius: var(--r-control);
  background: var(--wb-green-tint);
}

.adv-stamp-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--sp-3);
  margin: 0 0 var(--sp-3);
}

.adv-stamp-label {
  color: var(--wb-text-2);
  font-size: var(--fs-small);
  font-weight: 500;
}

.adv-stamp-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--fs-lead);
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.adv-stamp-arrow {
  color: var(--wb-green);
  font-size: 1.25rem;
}

.adv-stamp-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  margin: 0;
  color: var(--wb-ink);
  font-size: var(--fs-small);
  font-weight: 500;
}

.adv-stamp-meta .bi { color: var(--wb-green); }

.adv-end-label {
  display: block;
  margin-bottom: var(--sp-2);
  font-weight: 500;
}

.adv-photo { margin-top: var(--sp-4); }

.adv-photo-preview {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.adv-photo-img {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border-radius: var(--r-control);
  object-fit: cover;
  background: var(--wb-green-tint);
}

.adv-photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.adv-photo-hint {
  margin: var(--sp-2) 0 0;
  color: var(--wb-text-2);
  font-size: var(--fs-small);
}

.adv-end-error {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: var(--sp-3) 0 0;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
  font-size: var(--fs-small);
  font-weight: 500;
}

.adv-end-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}

@media (max-width: 479.98px) {
  .adv-end-actions { flex-direction: column-reverse; align-items: stretch; }
}
</style>
