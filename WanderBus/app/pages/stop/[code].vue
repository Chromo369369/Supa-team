<script setup>
    import StopMap from '~/components/stop/StopMap.vue';
    import PlaceCard from '~/components/stop/PlaceCard.vue';
    //Check for session validity first
    definePageMeta( {middleware: 'auth' })

    const route = useRoute()
    // not awaited, so the page shows a loading state while the places load
    // ?prefer= is the activity filter from the spin, so those places are ranked first
    const { data, status, error, refresh } = useFetch(() => `/api/stops/${route.params.code}/places`, {
        query: { prefer: computed(() => route.query.prefer) }
    })

    const selectedSection = ref('all')    // food, nature, heritage, art, shopping
    const selectedSub = ref('all')        // cafe, park, museum... inside the selected section
    const selectedId = ref('')

    const { photosByPlace, loadPhotosNear, uploadPhoto } = usePlacePhotos()
    const uploadingId = ref('')
    const notice = ref(null)    // { type: 'success' | 'error', text }

    watch(data, (value) => {
        if (value) loadPhotosNear(value.stop, value.radius)
    }, { immediate: true })

    async function handleUpload(place, file) {
        uploadingId.value = place.id
        notice.value = null
        try {
            const photo = await uploadPhoto(file, place, data.value.stop.code)
            notice.value = photo.is_pioneer
                ? { type: 'success', text: `🏅 You're the Pioneer of ${place.name}! +100 credits` }
                : { type: 'success', text: `📷 Thanks! Your photo of ${place.name} is up.` }
        } catch (e) {
            notice.value = { type: 'error', text: e.message }
        } finally {
            uploadingId.value = ''
        }
    }

    // how many places per section and per sub-filter
    const counts = computed(() => {
        let total = { all: 0, sections: {}, subs: {} }
        for (let place of data.value.places) {
            total.all += 1
            total.sections[place.section] = (total.sections[place.section] ?? 0) + 1
            total.subs[place.category] = (total.subs[place.category] ?? 0) + 1
        }
        return total
    })

    // only show chips that have places here, so there's never an empty "Sights 0" chip
    const shownSections = computed(() => Object.keys(placeSections).filter(key => counts.value.sections[key] > 0))
    const shownSubs = computed(() => Object.keys(placeSubcategoryInfo).filter(key =>
        placeSubcategories[key].section === selectedSection.value && counts.value.subs[key] > 0
    ))

    // the spin picks that have something here (a pick with nothing nearby isn't worth mentioning)
    const shownPicks = computed(() => data.value.preferred.filter(key => counts.value.subs[key] > 0))

    const shownPlaces = computed(() => {
        let places = data.value.places
        if (selectedSection.value !== 'all') places = places.filter(place => place.section === selectedSection.value)
        if (selectedSub.value !== 'all') places = places.filter(place => place.category === selectedSub.value)
        return places
    })

    function pickSection(section) {
        selectedSection.value = section
        selectedSub.value = 'all'
        selectedId.value = ''
    }

    function pickSub(sub) {
        selectedSub.value = sub
        selectedId.value = ''
    }

    // clicking a pin on the map scrolls its card into view
    watch(selectedId, async (id) => {
        if (!id) return
        await nextTick()
        document.getElementById(`place-${id}`).scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
</script>


<template>
    <section class="container py-4 stop-page">
        <NuxtLink to="/home" class="back-link">← Back to spin</NuxtLink>
        <h1 class="page-title">Around this stop</h1>

        <div v-if="status === 'pending'" class="stop-note">Searching for places near stop {{ route.params.code }}...</div>

        <div v-else-if="error" class="stop-note">
            <p>{{ error.statusCode === 404 ? 'We couldn\'t find that bus stop.' : 'Something went wrong loading places, please try again.' }}</p>
            <button v-if="error.statusCode !== 404" class="btn-chip mt-2" @click="refresh()">Try again</button>
        </div>

        <template v-else-if="data">
            <div class="stop-banner">
                🚏 You're exploring around <strong>{{ data.stop.name }}</strong> ({{ data.stop.code }}), {{ data.stop.road }}
                <span v-if="shownPicks.length" class="d-block small mt-1">
                    ⭐ Showing your picks first: {{ shownPicks.map(key => placeStyle(key).label).join(', ') }}
                </span>
            </div>

            <div v-if="notice" class="stop-notice" :class="notice.type" role="status">
                {{ notice.text }}
                <button type="button" class="notice-close" aria-label="Dismiss" @click="notice = null">×</button>
            </div>

            <div v-if="counts.all" class="chip-row">
                <button class="btn-chip" :class="{ active: selectedSection === 'all' }" @click="pickSection('all')">
                    ✨ Anything <span class="chip-count">{{ counts.all }}</span>
                </button>
                <button
                    v-for="key in shownSections"
                    :key="key"
                    class="btn-chip"
                    :class="{ active: selectedSection === key }"
                    @click="pickSection(key)"
                >
                    <span class="chip-dot" :style="{ background: placeSections[key].colour }"></span>
                    {{ placeSections[key].icon }} {{ placeSections[key].label }} <span class="chip-count">{{ counts.sections[key] }}</span>
                </button>
            </div>

            <!-- more specific filters inside the chosen section, only worth showing when there's more than one -->
            <div v-if="selectedSection !== 'all' && shownSubs.length > 1" class="chip-row sub-chip-row">
                <button class="btn-chip btn-sub" :class="{ active: selectedSub === 'all' }" @click="pickSub('all')">
                    All {{ placeSections[selectedSection].label.toLowerCase() }} <span class="chip-count">{{ counts.sections[selectedSection] }}</span>
                </button>
                <button
                    v-for="key in shownSubs"
                    :key="key"
                    class="btn-chip btn-sub"
                    :class="{ active: selectedSub === key }"
                    @click="pickSub(key)"
                >
                    {{ placeSubcategoryInfo[key].icon }} {{ placeSubcategoryInfo[key].label }} <span class="chip-count">{{ counts.subs[key] }}</span>
                </button>
            </div>

            <div class="stop-layout">
                <StopMap
                    :key="data.stop.code"
                    :stop="data.stop"
                    :radius="data.radius"
                    :places="shownPlaces"
                    :selected-id="selectedId"
                    @select="id => selectedId = id"
                />

                <div class="place-list">
                    <div v-if="counts.all === 0" class="empty-state">
                        <p class="empty-title">🧭 Uncharted territory</p>
                        <p class="stop-note">
                            Nothing's been mapped within a {{ walkMinutes(data.radius) }} min walk of this stop yet.
                            Have a wander, you might find something nobody has listed!
                        </p>
                    </div>
                    <PlaceCard
                        v-for="place in shownPlaces"
                        :key="place.id"
                        :place="place"
                        :stop="data.stop"
                        :selected="place.id === selectedId"
                        :photos="photosByPlace[place.id]"
                        :uploading="uploadingId === place.id"
                        @select="id => selectedId = id"
                        @upload="handleUpload"
                    />
                </div>
            </div>
        </template>
    </section>
</template>

<style scoped>
.page-title {
  font-size: 2.4rem;
  font-weight: 800;
  color: #141a33;
  margin-bottom: 16px;
}

.back-link {
  display: inline-block;
  color: #4a5068;
  text-decoration: none;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.stop-note {
  color: #4a5068;
  padding: 24px 0;
}

.stop-banner {
  background: #fdf3d7;
  color: #7a5200;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 16px;
}

.stop-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-weight: 600;
}

.stop-notice.success {
  background: #e6f4ec;
  color: #0b7a4b;
}

.stop-notice.error {
  background: #fdecea;
  color: #b3261e;
}

.notice-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.3rem;
  line-height: 1;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.btn-chip {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 6px 14px;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-chip:hover {
  background: #f1f2f6;
}

.btn-chip.active {
  background: #141a33;
  border-color: #141a33;
  color: #fff;
}

.sub-chip-row {
  margin-top: -10px;
  padding-left: 12px;
  border-left: 3px solid #e3e5ec;
}

.btn-sub {
  font-size: 0.85rem;
  padding: 4px 12px;
}

.chip-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 2px;
  vertical-align: middle;
}

.empty-state {
  background: #fff;
  border: 1px dashed #c9ccd6;
  border-radius: 14px;
  padding: 24px;
  text-align: center;
}

.empty-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #141a33;
  margin-bottom: 4px;
}

.empty-state .stop-note {
  padding: 0;
}

.chip-count {
  font-weight: 400;
  opacity: 0.7;
  margin-left: 2px;
}

/* map on the left, scrolling list of cards on the right */
.stop-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

.place-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 520px;
  overflow-y: auto;
  padding: 2px;
}

@media (max-width: 991.98px) {
  .stop-layout {
    grid-template-columns: 1fr;
  }

  .place-list {
    max-height: none;
    overflow-y: visible;
  }
}
</style>
