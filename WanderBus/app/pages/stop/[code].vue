<script setup>
    import StopMap from '~/components/stop/StopMap.vue';
    import PlaceCard from '~/components/stop/PlaceCard.vue';
    import ActivityCard from '~/components/stop/ActivityCard.vue';
    import ActivityForm from '~/components/stop/ActivityForm.vue';
    //Check for session validity first
    definePageMeta( {middleware: 'auth' })

    const route = useRoute()
    // not awaited, so the page shows a loading state while the places load
    // ?prefer= is the activity filter from the spin, so those places are ranked first
    const { data, status, error, refresh } = useFetch(() => `/api/stops/${route.params.code}/places`, {
        query: { prefer: computed(() => route.query.prefer) }
    })

    const tab = ref('all')                // all | places | activities
    const selectedSection = ref('all')    // food, nature, heritage, art, shopping
    const selectedSub = ref('all')        // cafe, park, museum... inside the selected section
    const showKinds = reactive({ signpost: true, challenge: true })   // the signposts / challenges pills
    const selectedId = ref('')            // a place id or an activity key ('signpost:12')

    const { photosByPlace, loadPhotosNear, uploadPhoto } = usePlacePhotos()
    const { activities, loadActivities, saveActivity, deleteActivity, toggleHelpful, completeChallenge } = useStopActivities()
    const uploadingId = ref('')
    const busyKey = ref('')               // the signpost/challenge whose vote or completion is saving
    const notice = ref(null)    // { type: 'success' | 'error', text }

    watch(data, (value) => {
        if (value) {
            loadPhotosNear(value.stop, value.radius)
            loadActivities(value.stop)

            // coming from the spin ticket: open the section of the user's picks, e.g. mall -> All tab > Shopping.
            // picks from different sections (e.g. cafe + park) stay on Any, they're already ranked first there.
            // a pick's first sub-filter decides its section, so museum (museums + galleries) opens Heritage
            let picks = String(route.query.prefer).split(',').filter(pick => pick in spinToSubcategories)
            let pickedSections = [...new Set(picks.map(pick => placeSubcategories[spinToSubcategories[pick][0]].section))]
            tab.value = 'all'
            selectedSection.value = pickedSections.length == 1 ? pickedSections[0] : 'all'
            selectedSub.value = 'all'
        }
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

    // how many places per section and per sub-filter, and how many signposts/challenges
    const counts = computed(() => {
        let total = { all: 0, sections: {}, subs: {}, kinds: { signpost: 0, challenge: 0 } }
        for (let place of data.value.places) {
            total.all += 1
            total.sections[place.section] = (total.sections[place.section] ?? 0) + 1
            total.subs[place.category] = (total.subs[place.category] ?? 0) + 1
        }
        for (let activity of activities.value) total.kinds[activity.kind] += 1
        return total
    })

    // every section chip always shows, an empty one gets a "no nearby ..." message instead
    const shownSubs = computed(() => Object.keys(placeSubcategoryInfo).filter(key =>
        placeSubcategories[key].section === selectedSection.value && counts.value.subs[key] > 0
    ))

    // the spin picks that have something here (a pick with nothing nearby isn't worth mentioning)
    const shownPicks = computed(() => data.value.preferred.filter(key => counts.value.subs[key] > 0))

    const shownPlaces = computed(() => {
        if (tab.value === 'activities') return []
        let places = data.value.places
        if (selectedSection.value !== 'all') places = places.filter(place => place.section === selectedSection.value)
        if (selectedSub.value !== 'all') places = places.filter(place => place.category === selectedSub.value)
        return places
    })

    // the one being edited is hidden, its draggable draft pin stands in for it
    const shownActivities = computed(() => {
        if (tab.value === 'places') return []
        return activities.value.filter(activity => showKinds[activity.kind] && !(draft.value && draft.value.editing === activity))
    })

    // all tab mixes both, closest to the stop first
    const listItems = computed(() => {
        if (tab.value === 'places') return shownPlaces.value
        if (tab.value === 'activities') return shownActivities.value
        return [...shownPlaces.value, ...shownActivities.value].sort((a, b) => a.distanceM - b.distanceM)
    })

    function pickTab(name) {
        tab.value = name
        selectedId.value = ''
    }

    function pickSection(section) {
        selectedSection.value = section
        selectedSub.value = 'all'
        selectedId.value = ''
    }

    function pickSub(sub) {
        selectedSub.value = sub
        selectedId.value = ''
    }

    function toggleKind(kind) {
        showKinds[kind] = !showKinds[kind]
        selectedId.value = ''
    }

    // ---- feature 3: leaving a signpost / setting a challenge ----
    // draft = the pin being placed: { kind, lat, lon, editing } (editing = the signpost/challenge being edited, or null)
    const draft = ref(null)
    const saving = ref(false)

    function onDragStart(event, kind) {
        event.dataTransfer.setData('text/plain', kind)
        event.dataTransfer.effectAllowed = 'copy'
    }

    // dropped on the map, or the button was clicked (drag and drop doesn't work on phones, so the pin starts on the stop)
    function startDraft(kind, lat, lon) {
        draft.value = { kind, lat, lon, editing: null }
        selectedId.value = ''
        notice.value = null
    }

    function moveDraft(lat, lon) {
        draft.value.lat = lat
        draft.value.lon = lon
    }

    function editActivity(activity) {
        draft.value = { kind: activity.kind, lat: activity.lat, lon: activity.lon, editing: activity }
        selectedId.value = ''
    }

    async function saveDraft(fields, file) {
        saving.value = true
        notice.value = null
        try {
            const saved = await saveActivity(draft.value.kind, fields, file, draft.value.editing)
            notice.value = { type: 'success', text: draft.value.editing ? '✏️ Changes saved.' : `${activityStyles[saved.kind].icon} Your ${saved.kind} is up!` }
            showKinds[saved.kind] = true
            draft.value = null
            selectedId.value = saved.key
        } catch (e) {
            notice.value = { type: 'error', text: e.message }
        } finally {
            saving.value = false
        }
    }

    async function removeActivity(activity) {
        if (!confirm(`Delete this ${activity.kind}?`)) return
        try {
            await deleteActivity(activity)
            notice.value = { type: 'success', text: `🗑️ ${activityStyles[activity.kind].label} deleted.` }
        } catch (e) {
            notice.value = { type: 'error', text: e.message }
        }
    }

    async function handleHelpful(signpost) {
        busyKey.value = signpost.key
        try {
            await toggleHelpful(signpost)
        } catch (e) {
            notice.value = { type: 'error', text: e.message }
        } finally {
            busyKey.value = ''
        }
    }

    async function handleComplete(challenge, file) {
        busyKey.value = challenge.key
        notice.value = null
        try {
            await completeChallenge(challenge, file)
            notice.value = { type: 'success', text: `🏆 Challenge complete: ${challenge.title}` }
        } catch (e) {
            notice.value = { type: 'error', text: e.message }
        } finally {
            busyKey.value = ''
        }
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

            <nav class="stop-tabs" aria-label="What to show">
                <button class="stop-tab" :class="{ active: tab === 'all' }" @click="pickTab('all')">
                    All <span class="chip-count">{{ counts.all + activities.length }}</span>
                </button>
                <button class="stop-tab" :class="{ active: tab === 'places' }" @click="pickTab('places')">
                    Places <span class="chip-count">{{ counts.all }}</span>
                </button>
                <button class="stop-tab" :class="{ active: tab === 'activities' }" @click="pickTab('activities')">
                    Activities <span class="chip-count">{{ activities.length }}</span>
                </button>
            </nav>

            <div class="chip-row">
                <template v-if="tab !== 'activities'">
                    <button class="btn-chip" :class="{ active: selectedSection === 'all' }" @click="pickSection('all')">
                        ✨ Any <span class="chip-count">{{ counts.all }}</span>
                    </button>
                    <button
                        v-for="(section, key) in placeSections"
                        :key="key"
                        class="btn-chip"
                        :class="{ active: selectedSection === key }"
                        @click="pickSection(key)"
                    >
                        <span class="chip-dot" :style="{ background: section.colour }"></span>
                        {{ section.icon }} {{ section.label }} <span class="chip-count">{{ counts.sections[key] ?? 0 }}</span>
                    </button>
                </template>

                <span v-if="tab === 'all'" class="chip-divider" aria-hidden="true"></span>

                <template v-if="tab !== 'places'">
                    <button
                        v-for="(style, kind) in activityStyles"
                        :key="kind"
                        class="btn-chip"
                        :class="{ active: showKinds[kind] }"
                        :aria-pressed="showKinds[kind]"
                        @click="toggleKind(kind)"
                    >
                        {{ style.icon }} {{ style.label }}s <span class="chip-count">{{ counts.kinds[kind] }}</span>
                    </button>
                </template>
            </div>

            <!-- more specific filters inside the chosen section, only worth showing when there's more than one -->
            <div v-if="tab !== 'activities' && selectedSection !== 'all' && shownSubs.length > 1" class="chip-row sub-chip-row">
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

            <!-- drag a button onto the map to drop a pin there, or click it to drop the pin on the stop -->
            <div v-if="tab === 'activities'" class="activity-bar">
                <button
                    v-for="(style, kind) in activityStyles"
                    :key="kind"
                    type="button"
                    draggable="true"
                    class="btn-drag"
                    :class="kind"
                    @dragstart="onDragStart($event, kind)"
                    @click="startDraft(kind, data.stop.lat, data.stop.lon)"
                >
                    {{ style.icon }} {{ kind === 'signpost' ? 'Leave a signpost' : 'Set a challenge' }}
                </button>
                <span class="drag-hint">Drag onto the map to pin it inside the circle</span>
            </div>

            <div class="stop-layout">
                <StopMap
                    :key="data.stop.code"
                    :stop="data.stop"
                    :radius="data.radius"
                    :places="shownPlaces"
                    :activities="shownActivities"
                    :draft="draft"
                    :selected-id="selectedId"
                    @select="id => selectedId = id"
                    @drop="startDraft"
                    @drop-outside="notice = { type: 'error', text: '📍 Drop the pin inside the circle, within 1 km of the stop.' }"
                    @move-draft="moveDraft"
                />

                <div class="place-list">
                    <ActivityForm
                        v-if="draft"
                        :key="draft.editing ? draft.editing.key : `new-${draft.kind}`"
                        :kind="draft.kind"
                        :draft="draft"
                        :stop="data.stop"
                        :existing="draft.editing"
                        :saving="saving"
                        @save="saveDraft"
                        @cancel="draft = null"
                    />

                    <template v-if="tab !== 'activities'">
                        <div v-if="counts.all === 0" class="empty-state">
                            <p class="empty-title">🧭 Uncharted territory</p>
                            <p class="stop-note">
                                Nothing's been mapped within a {{ walkMinutes(data.radius) }} min walk of this stop yet.
                                Have a wander, you might find something nobody has listed!
                            </p>
                        </div>
                        <div v-else-if="shownPlaces.length === 0" class="empty-state">
                            <p class="empty-title">{{ placeSections[selectedSection].icon }} Nothing here yet</p>
                            <p class="stop-note">There are no nearby {{ placeSections[selectedSection].label.toLowerCase() }} places around this stop.</p>
                        </div>
                    </template>

                    <div v-if="tab === 'activities' && shownActivities.length === 0 && !draft" class="empty-state">
                        <p class="empty-title">🪧 No signposts or challenges yet</p>
                        <p class="stop-note">
                            {{ showKinds.signpost || showKinds.challenge
                                ? 'Be the first! Drag "Leave a signpost" or "Set a challenge" onto the map.'
                                : 'Turn on Signposts or Challenges above to see them.' }}
                        </p>
                    </div>

                    <template v-for="item in listItems" :key="item.kind ? item.key : item.id">
                        <ActivityCard
                            v-if="item.kind"
                            :activity="item"
                            :selected="item.key === selectedId"
                            :busy="busyKey === item.key"
                            @select="id => selectedId = id"
                            @edit="editActivity"
                            @delete="removeActivity"
                            @helpful="handleHelpful"
                            @complete="handleComplete"
                        />
                        <PlaceCard
                            v-else
                            :place="item"
                            :stop="data.stop"
                            :selected="item.id === selectedId"
                            :photos="photosByPlace[item.id]"
                            :uploading="uploadingId === item.id"
                            @select="id => selectedId = id"
                            @upload="handleUpload"
                        />
                    </template>
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

/* All | Places | Activities */
.stop-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e3e5ec;
  margin-bottom: 16px;
}

.stop-tab {
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  padding: 8px 16px;
  font-weight: 700;
  color: #4a5068;
}

.stop-tab.active {
  color: #141a33;
  border-bottom-color: #0b7a4b;
}

.chip-divider {
  width: 1px;
  align-self: stretch;
  background: #c9ccd6;
  margin: 2px 4px;
}

.activity-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.btn-drag {
  border-radius: 50px;
  padding: 10px 22px;
  font-weight: 700;
  cursor: grab;
}

.btn-drag:active {
  cursor: grabbing;
}

.btn-drag.signpost {
  background: #f5a623;
  border: 1px solid #f5a623;
  color: #141a33;
}

.btn-drag.challenge {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
}

.drag-hint {
  font-size: 0.85rem;
  color: #6b7085;
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
