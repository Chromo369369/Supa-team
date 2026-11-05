<script setup>
    import StopMap from '~/components/stop/StopMap.vue';
    import PlaceCard from '~/components/stop/PlaceCard.vue';
    import ActivityCard from '~/components/stop/ActivityCard.vue';
    import ActivityForm from '~/components/stop/ActivityForm.vue';
    import PhotoStrip from '~/components/stop/PhotoStrip.vue';
    import PhotoViewer from '~/components/ui/PhotoViewer.vue';
    //Check for session validity first
    definePageMeta( {middleware: 'auth' })
    const {$supabase} = useNuxtApp()
    
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()
    const { confirm } = useConfirm()
    // not awaited, so the page shows a loading state while the places load
    // ?prefer= is the activity filter from the spin, so those places are ranked first
    const { data, status, error, refresh } = useFetch(() => `/api/stops/${route.params.code}/places`, {
        query: { prefer: computed(() => route.query.prefer) }
    })

    const tabs = [
        { key: 'all', label: 'All' },
        { key: 'places', label: 'Places' },
        { key: 'activities', label: 'Activities' }
    ]
    const tab = ref('all')                // all | places | activities
    const selectedSection = ref('all')    // food, nature, heritage, art, shopping
    const selectedSub = ref('all')        // cafe, park, museum... inside the selected section
    const showKinds = reactive({ signpost: true, challenge: true })   // the signposts / challenges pills
    const selectedId = ref('')            // a place id or an activity key ('signpost:12')
    const search = ref(typeof route.query.q === 'string' ? route.query.q : '')   // the search field, kept in ?q=
    const searchInput = ref(null)

    const { photosByPlace, loadError: photosError, loadPhotosNear, uploadPhoto, deletePhoto } = usePlacePhotos()
    const { activities, loadError: activitiesError, loadActivities, saveActivity, deleteActivity, toggleHelpful, completeChallenge } = useStopActivities()
    const uploadingId = ref('')
    const busyKey = ref('')               // the signpost/challenge whose vote or completion is saving
    const notice = ref(null)    // { type: 'success' | 'error', text }, for hints about the map itself
    // admins can delete any photo, signpost or challenge on this page
    const isAdmin = ref(false)
    onMounted(async () => {
        const { data: { user } } = await $supabase.auth.getUser()
        if (!user) return
        const { data: admin } = await $supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
        isAdmin.value = !!admin
    })
    async function removePhoto(place, photo) {
    const ok = await confirm({
        title: `Delete this photo of ${place.name}?`,
        body: 'It will be removed for everyone.',
        confirmLabel: 'Delete photo',
        danger: true
    })
    if (!ok) return
    try {
        await deletePhoto(photo)
        toast.success('Photo deleted.')
    } catch (e) {
        toast.error(`Couldn’t delete the photo. ${e.message}`)
    }
}
    
    // ?tab=&section=&sub= keep the filters in the URL, so a reload or a shared link opens the same view
    function fromQuery(name, allowed) {
        let value = route.query[name]
        return typeof value === 'string' && allowed(value) ? value : null
    }

    watch(data, (value) => {
        if (value) {
            loadPhotosNear(value.stop, value.radius)
            loadActivities(value.stop)

            // coming from the spin ticket: open the section of the user's picks, e.g. mall -> All tab > Shopping.
            // picks from different sections (e.g. cafe + park) stay on Any, they're already ranked first there.
            // a pick's first sub-filter decides its section, so museum (museums + galleries) opens Heritage
            // a tab/section/sub already in the URL wins over the picks
            let picks = String(route.query.prefer).split(',').filter(pick => pick in spinToSubcategories)
            let pickedSections = [...new Set(picks.map(pick => placeSubcategories[spinToSubcategories[pick][0]].section))]
            let section = fromQuery('section', key => key === 'all' || key in placeSections)
            tab.value = fromQuery('tab', key => tabs.some(item => item.key === key)) ?? 'all'
            selectedSection.value = section ?? (pickedSections.length == 1 ? pickedSections[0] : 'all')
            selectedSub.value = fromQuery('sub', key => key in placeSubcategories && placeSubcategories[key].section === selectedSection.value) ?? 'all'
        }
    }, { immediate: true })

    // every filter is written at once, so two quick changes can't overwrite each other's part of the URL
    function syncQuery() {
        let query = { ...route.query, section: selectedSection.value }
        delete query.tab
        delete query.sub
        delete query.q
        if (tab.value !== 'all') query.tab = tab.value
        if (selectedSub.value !== 'all') query.sub = selectedSub.value
        if (search.value.trim()) query.q = search.value.trim()
        router.replace({ query })
    }

    watch([tab, selectedSection, selectedSub], syncQuery)

    // typing filters right away, the URL catches up once the typing pauses
    let searchTimer = null
    watch(search, () => {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(syncQuery, 300)
    })

    function clearSearch() {
        search.value = ''
        searchInput.value?.focus()
    }

    // case and accents don't matter: "Cafe" finds "Café"
    function normalise(text) {
        return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    }

    const searchTerm = computed(() => normalise(search.value).trim())

    // the search runs first, then the chips and pills filter what's left (so their counts follow the search)
    const matchedPlaces = computed(() => searchTerm.value
        ? data.value.places.filter(place => normalise(place.name).includes(searchTerm.value))
        : data.value.places)

    const matchedActivities = computed(() => searchTerm.value
        ? activities.value.filter(activity => [activity.title, activity.note, activity.description].some(text => normalise(text).includes(searchTerm.value)))
        : activities.value)

    // every photo around the stop (the same ones the place cards get), newest first, for the strip at the top of Places.
    // a photo outside the walking circle (the query is a box) has no place in the list, so it's left out
    const stripViewer = ref(null)
    const stripPhotos = computed(() => {
        let names = Object.fromEntries((data.value?.places ?? []).map(place => [place.id, place.name]))
        return Object.entries(photosByPlace.value)
            .flatMap(([placeId, photos]) => placeId in names ? photos.map(photo => ({ ...photo, placeName: names[placeId] })) : [])
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 24)
            .map(photo => ({
                id: photo.id,
                url: photo.url,
                placeName: photo.placeName,
                caption: photo.placeName,
                alt: `Photo of ${photo.placeName}`,
                isPioneer: photo.is_pioneer,
                createdAt: photo.created_at
            }))
    })

    
    async function handleUpload(place, file) {
        uploadingId.value = place.id

        try {
            await uploadPhoto(file, place, data.value.stop.code)

            toast.success(
                `Photo of ${place.name} submitted! Waiting for admin approval.`
            )
        } catch (e) {
            toast.error(
                `Couldn't upload your photo of ${place.name}. ${e.message}`,
                {
                    action: {
                        label: 'Retry',
                        run: () => handleUpload(place, file)
                    }
                }
            )
        } finally {
            uploadingId.value = ''
        }
    }


    // how many places per section and per sub-filter, and how many signposts/challenges
    const counts = computed(() => {
        let total = { all: 0, sections: {}, subs: {}, kinds: { signpost: 0, challenge: 0 } }
        for (let place of matchedPlaces.value) {
            total.all += 1
            total.sections[place.section] = (total.sections[place.section] ?? 0) + 1
            total.subs[place.category] = (total.subs[place.category] ?? 0) + 1
        }
        for (let activity of matchedActivities.value) total.kinds[activity.kind] += 1
        return total
    })

    const tabCounts = computed(() => ({
        all: counts.value.all + matchedActivities.value.length,
        places: counts.value.all,
        activities: matchedActivities.value.length
    }))

    // every section chip always shows, an empty one gets a "no nearby ..." message instead.
    // a sub-filter with no matches for the search hides, unless it's the one that's on
    const shownSubs = computed(() => Object.keys(placeSubcategoryInfo).filter(key =>
        placeSubcategories[key].section === selectedSection.value && (counts.value.subs[key] > 0 || key === selectedSub.value)
    ))

    // the spin picks that have something here (a pick with nothing nearby isn't worth mentioning). Not affected by the search
    const shownPicks = computed(() => data.value.preferred.filter(key => data.value.places.some(place => place.category === key)))

    const shownPlaces = computed(() => {
        if (tab.value === 'activities') return []
        let places = matchedPlaces.value
        if (selectedSection.value !== 'all') places = places.filter(place => place.section === selectedSection.value)
        if (selectedSub.value !== 'all') places = places.filter(place => place.category === selectedSub.value)
        return places
    })

    // the one being edited is hidden, its draggable draft pin stands in for it
    const shownActivities = computed(() => {
        if (tab.value === 'places') return []
        return matchedActivities.value.filter(activity => showKinds[activity.kind] && !(draft.value && draft.value.editing === activity))
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
        placing.value = ''
    }

    // tabs: arrow keys / Home / End move between them (roving tabindex), picking as they go
    function onTabKey(event, index) {
        let next = null
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = tabs.length - 1
        if (next === null) return
        event.preventDefault()
        pickTab(tabs[next].key)
        nextTick(() => document.getElementById(`stop-tab-${tabs[next].key}`)?.focus())
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
    const saveError = ref('')
    const placing = ref('')     // 'signpost' | 'challenge' while waiting for a tap on the map (placing mode)
    const incoming = ref('')    // the kind being dragged from its button onto the map, so the map can show a ghost pin
    const hoverId = ref('')     // the card or pin under the pointer (or focused), the other one lights up to match
    const freshKey = ref('')    // just saved: its pin pulses and its card flashes
    const mapRef = ref(null)
    const formRef = ref(null)
    let freshTimer = null

    function onDragStart(event, kind) {
        event.dataTransfer.setData('text/plain', kind)
        event.dataTransfer.effectAllowed = 'copy'
        incoming.value = kind
        placing.value = ''
    }

    function onDragEnd() {
        incoming.value = ''
    }

    // tapping "Leave a signpost" / "Set a challenge" enters placing mode, tapping it again leaves it
    function togglePlacing(kind) {
        placing.value = placing.value === kind ? '' : kind
        notice.value = null
    }

    // dropped on the map, or tapped on it in placing mode
    function startDraft(kind, lat, lon) {
        draft.value = { kind, lat, lon, editing: null }
        saveError.value = ''
        selectedId.value = ''
        notice.value = null
        placing.value = ''
    }

    // placing mode's "Place at the stop": the pin starts on the stop and gets focus, so the arrow keys can move it
    async function placeAtStop() {
        startDraft(placing.value, data.value.stop.lat, data.value.stop.lon)
        await nextTick()
        mapRef.value?.focusDraft()
    }

    // Enter on the draft pin: its spot is set, so on to the form
    function confirmDraft() {
        formRef.value?.focusFirst()
    }

    function onOutside() {
        notice.value = { type: 'error', text: placing.value
            ? 'Tap inside the circle, within 1 km of the stop.'
            : 'Drop the pin inside the circle, within 1 km of the stop.' }
    }

    // Escape leaves placing mode
    function onWindowKey(event) {
        if (event.key === 'Escape' && placing.value) placing.value = ''
    }

    onMounted(() => window.addEventListener('keydown', onWindowKey))
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', onWindowKey)
        clearTimeout(freshTimer)
        clearTimeout(searchTimer)
    })

    function moveDraft(lat, lon) {
        draft.value.lat = lat
        draft.value.lon = lon
    }

    function editActivity(activity) {
        placing.value = ''
        draft.value = { kind: activity.kind, lat: activity.lat, lon: activity.lon, editing: activity }
        saveError.value = ''
        selectedId.value = ''
    }

    function closeDraft() {
        draft.value = null
        saveError.value = ''
    }

    // a failed save stays inside the form (its Post button is the retry), a good one gets a toast
    async function saveDraft(fields, file) {
        saving.value = true
        saveError.value = ''
        notice.value = null
        try {
            const editing = draft.value.editing
            const saved = await saveActivity(draft.value.kind, fields, file, editing)
            toast.success(editing ? 'Changes saved.' : `Your ${saved.kind} is up!`)
            showKinds[saved.kind] = true
            draft.value = null
            selectedId.value = saved.key
            flashSaved(saved.key)
        } catch (e) {
            saveError.value = e.message
        } finally {
            saving.value = false
        }
    }

    // the saved pin pulses twice and its card flashes (the selectedId watch below scrolls the card into view)
    async function flashSaved(key) {
        clearTimeout(freshTimer)
        freshKey.value = ''
        await nextTick()
        freshKey.value = key
        freshTimer = setTimeout(() => { freshKey.value = '' }, 1600)
    }

    function shorten(text, length = 60) {
        return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text
    }

    async function removeActivity(activity) {
        const ok = await confirm({
            title: `Delete this ${activity.kind} at ${data.value.stop.name}?`,
            body: `“${shorten(activity.kind == 'signpost' ? activity.note : activity.title)}” will be removed for everyone.`,
            confirmLabel: `Delete ${activity.kind}`
        })
        if (ok) await deleteNow(activity)
    }

    async function deleteNow(activity) {
        try {
            await deleteActivity(activity)
            toast.success(`${activityStyles[activity.kind].label} deleted.`)
        } catch (e) {
            toast.error(`Couldn’t delete that ${activity.kind}. ${e.message}`, { action: { label: 'Retry', run: () => deleteNow(activity) } })
        }
    }

    async function handleHelpful(signpost) {
        busyKey.value = signpost.key
        try {
            await toggleHelpful(signpost)
        } catch (e) {
            toast.error(`Couldn’t save your vote. ${e.message}`, { action: { label: 'Retry', run: () => handleHelpful(signpost) } })
        } finally {
            busyKey.value = ''
        }
    }

    async function handleComplete(challenge, file) {
        busyKey.value = challenge.key
        try {
            await completeChallenge(challenge, file)
            toast.success(`Challenge complete: “${challenge.title}”`)
        } catch (e) {
            toast.error(`Couldn’t complete “${challenge.title}”. ${e.message}`, { action: { label: 'Retry', run: () => handleComplete(challenge, file) } })
        } finally {
            busyKey.value = ''
        }
    }

    // clicking a pin on the map scrolls its card into view (instantly when the user prefers reduced motion)
    watch(selectedId, async (id) => {
        if (!id) return
        await nextTick()
        const card = document.getElementById(`place-${id}`)
        if (!card) return
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' })
    })
</script>


<template>
    <section class="container py-4 stop-page">
        <NuxtLink to="/home" class="back-link"><i class="bi bi-arrow-left" aria-hidden="true"></i> Back to spin</NuxtLink>
        <h1 class="page-title">Around this stop</h1>

        <p v-if="status === 'pending'" class="stop-note" role="status">Finding places near stop <span class="num">{{ route.params.code }}</span>…</p>

        <div v-else-if="error" class="load-error" role="alert">
            <p class="mb-0">{{ error.statusCode === 404 ? 'We couldn’t find that bus stop, so head back and spin again.' : 'We couldn’t load the places near this stop.' }}</p>
            <button v-if="error.statusCode !== 404" type="button" class="btn-wb btn-wb-secondary btn-sm" @click="refresh()">
                <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry
            </button>
        </div>

        <template v-else-if="data">
            <div class="stop-banner">
                <p class="mb-0">
                    <i class="bi bi-bus-front" aria-hidden="true"></i>
                    You’re exploring around <strong>{{ data.stop.name }}</strong> (<span class="num">{{ data.stop.code }}</span>), {{ data.stop.road }}
                </p>
                <p v-if="shownPicks.length" class="banner-picks">
                    <i class="bi bi-stars" aria-hidden="true"></i>
                    Showing your picks first: {{ shownPicks.map(key => placeStyle(key).label).join(', ') }}
                </p>
            </div>

            <div v-if="notice" class="stop-notice" :class="notice.type" :role="notice.type === 'error' ? 'alert' : 'status'">
                <span>
                    <i class="bi" :class="notice.type === 'error' ? 'bi-geo-alt-fill' : 'bi-check-circle-fill'" aria-hidden="true"></i>
                    {{ notice.text }}
                </span>
                <button type="button" class="btn-wb-ghost notice-close" aria-label="Dismiss" @click="notice = null">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>

            <div class="stop-tabs" role="tablist" aria-label="What to show">
                <button
                    v-for="(item, index) in tabs"
                    :id="`stop-tab-${item.key}`"
                    :key="item.key"
                    type="button"
                    role="tab"
                    class="stop-tab"
                    :class="{ active: tab === item.key }"
                    :aria-selected="tab === item.key ? 'true' : 'false'"
                    aria-controls="stop-panel"
                    :tabindex="tab === item.key ? 0 : -1"
                    @click="pickTab(item.key)"
                    @keydown="onTabKey($event, index)"
                >
                    {{ item.label }} <span class="chip-count num">{{ tabCounts[item.key] }}</span>
                </button>
            </div>

            <div id="stop-panel" role="tabpanel" :aria-labelledby="`stop-tab-${tab}`">
                <!-- the photos around the stop as one curved, streaming row; a tile opens the coverflow at that photo -->
                <template v-if="tab === 'places' && stripPhotos.length >= 3">
                    <PhotoStrip :photos="stripPhotos" @open="index => stripViewer.open(index)" />
                    <PhotoViewer ref="stripViewer" :photos="stripPhotos" title="Photos around this stop" />
                </template>

                <!-- filters what's already loaded as you type: places by name, signposts/challenges by their text -->
                <div class="stop-search" role="search">
                    <label for="stop-search-input" class="search-label">Search places</label>
                    <div class="search-field">
                        <i class="bi bi-search search-icon" aria-hidden="true"></i>
                        <input
                            id="stop-search-input"
                            ref="searchInput"
                            v-model="search"
                            type="search"
                            class="form-control search-input"
                            placeholder="A name, a note or a challenge…"
                            autocomplete="off"
                            spellcheck="false"
                            enterkeyhint="search"
                        />
                        <button v-if="search" type="button" class="search-clear" aria-label="Clear search" @click="clearSearch">
                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                        </button>
                    </div>
                    <p class="visually-hidden" aria-live="polite">{{ searchTerm ? `${listItems.length} ${listItems.length === 1 ? 'match' : 'matches'} for ${search.trim()}` : '' }}</p>
                </div>

                <div class="chip-row">
                    <div v-if="tab !== 'activities'" class="chip-group" role="group" aria-label="Kind of place">
                        <button type="button" class="btn-chip" :class="{ active: selectedSection === 'all' }" :aria-pressed="selectedSection === 'all' ? 'true' : 'false'" @click="pickSection('all')">
                            Any <span class="chip-count num">{{ counts.all }}</span>
                        </button>
                        <button
                            v-for="(section, key) in placeSections"
                            :key="key"
                            type="button"
                            class="btn-chip"
                            :class="{ active: selectedSection === key }"
                            :aria-pressed="selectedSection === key ? 'true' : 'false'"
                            @click="pickSection(key)"
                        >
                            <i class="bi chip-icon" :class="section.icon" :style="{ color: section.colour }" aria-hidden="true"></i>
                            {{ section.label }} <span class="chip-count num">{{ counts.sections[key] ?? 0 }}</span>
                        </button>
                    </div>

                    <div v-if="tab !== 'places'" class="chip-group" role="group" aria-label="Signposts and challenges">
                        <button
                            v-for="(style, kind) in activityStyles"
                            :key="kind"
                            type="button"
                            class="btn-chip"
                            :class="{ active: showKinds[kind] }"
                            :aria-pressed="showKinds[kind] ? 'true' : 'false'"
                            @click="toggleKind(kind)"
                        >
                            <i class="bi chip-icon" :class="style.icon" :style="{ color: style.text }" aria-hidden="true"></i>
                            {{ style.label }}s <span class="chip-count num">{{ counts.kinds[kind] }}</span>
                        </button>
                    </div>
                </div>

                <!-- more specific filters inside the chosen section, only worth showing when there's more than one -->
                <div v-if="tab !== 'activities' && selectedSection !== 'all' && shownSubs.length > 1" class="chip-row sub-chip-row" role="group" :aria-label="`Kind of ${placeSections[selectedSection].label.toLowerCase()}`">
                    <button type="button" class="btn-chip btn-sub" :class="{ active: selectedSub === 'all' }" :aria-pressed="selectedSub === 'all' ? 'true' : 'false'" @click="pickSub('all')">
                        All {{ placeSections[selectedSection].label.toLowerCase() }} <span class="chip-count num">{{ counts.sections[selectedSection] }}</span>
                    </button>
                    <button
                        v-for="key in shownSubs"
                        :key="key"
                        type="button"
                        class="btn-chip btn-sub"
                        :class="{ active: selectedSub === key }"
                        :aria-pressed="selectedSub === key ? 'true' : 'false'"
                        @click="pickSub(key)"
                    >
                        <i class="bi" :class="placeSubcategoryInfo[key].icon" aria-hidden="true"></i>
                        {{ placeSubcategoryInfo[key].label }} <span class="chip-count num">{{ counts.subs[key] }}</span>
                    </button>
                </div>

                <!-- drag a button onto the map to drop a pin there, or tap it and then tap the map (placing mode) -->
                <div v-if="tab === 'activities'" class="activity-bar">
                    <button
                        v-for="(style, kind) in activityStyles"
                        :key="kind"
                        type="button"
                        draggable="true"
                        class="btn-drag"
                        :class="[kind === 'signpost' ? 'btn-wb-signal' : 'btn-wb-secondary', { 'is-placing': placing === kind }]"
                        :aria-pressed="placing === kind ? 'true' : 'false'"
                        @dragstart="onDragStart($event, kind)"
                        @dragend="onDragEnd"
                        @click="togglePlacing(kind)"
                    >
                        <i class="bi drag-icon" :class="style.icon" aria-hidden="true"></i>
                        {{ kind === 'signpost' ? 'Leave a signpost' : 'Set a challenge' }}
                    </button>
                    <span class="drag-hint">Drag a button onto the map, or tap it and then tap the map. Your pin has to sit inside the circle.</span>
                </div>

                <!-- placing mode: the next tap on the map places the pin -->
                <p class="visually-hidden" aria-live="polite">{{ placing ? `Tap the map to place your ${placing}, or choose Place at the stop` : '' }}</p>
                <div v-if="placing" class="placing-banner">
                    <p class="placing-text">
                        <i class="bi bi-hand-index" aria-hidden="true"></i>
                        Tap the map to place your {{ placing }}
                    </p>
                    <div class="placing-buttons">
                        <button type="button" class="btn-wb-primary btn-sm" @click="placeAtStop">
                            <i class="bi bi-bus-front" aria-hidden="true"></i> Place at the stop
                        </button>
                        <button type="button" class="btn-wb-ghost btn-sm" @click="placing = ''">Cancel placing</button>
                    </div>
                </div>

                <div class="stop-layout">
                    <StopMap
                        ref="mapRef"
                        :key="data.stop.code"
                        :stop="data.stop"
                        :radius="data.radius"
                        :places="shownPlaces"
                        :activities="shownActivities"
                        :draft="draft"
                        :selected-id="selectedId"
                        :placing="placing"
                        :incoming="incoming"
                        :hover-id="hoverId"
                        :pulse-id="freshKey"
                        @select="id => selectedId = id"
                        @drop="startDraft"
                        @place="(lat, lon) => startDraft(placing, lat, lon)"
                        @drop-outside="onOutside"
                        @move-draft="moveDraft"
                        @hover="id => hoverId = id"
                        @confirm-draft="confirmDraft"
                    />

                    <div class="place-list">
                        <ActivityForm
                            v-if="draft"
                            ref="formRef"
                            :key="draft.editing ? draft.editing.key : `new-${draft.kind}`"
                            :kind="draft.kind"
                            :draft="draft"
                            :stop="data.stop"
                            :existing="draft.editing"
                            :saving="saving"
                            :error="saveError"
                            @save="saveDraft"
                            @cancel="closeDraft"
                            @place-at-stop="moveDraft(data.stop.lat, data.stop.lon)"
                        />

                        <!-- a part of the page that failed to load says so here, with a retry -->
                        <div v-if="tab !== 'activities' && photosError" class="load-error" role="alert">
                            <p class="mb-0">Couldn’t load the photos for these places.</p>
                            <button type="button" class="btn-wb btn-wb-secondary btn-sm" @click="loadPhotosNear(data.stop, data.radius)">
                                <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry
                            </button>
                        </div>
                        <div v-if="tab !== 'places' && activitiesError" class="load-error" role="alert">
                            <p class="mb-0">Couldn’t load the signposts and challenges at this stop.</p>
                            <button type="button" class="btn-wb btn-wb-secondary btn-sm" @click="loadActivities(data.stop)">
                                <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry
                            </button>
                        </div>

                        <!-- the search found nothing in this view -->
                        <div v-if="searchTerm && listItems.length === 0 && !draft" class="empty-state">
                            <i class="bi bi-search empty-icon" aria-hidden="true"></i>
                            <p class="empty-title">{{ tab === 'activities' ? 'No signposts or challenges match' : 'No places match' }} “{{ search.trim() }}”</p>
                            <p class="stop-note">Check the spelling, try a shorter word, or turn off a filter above.</p>
                            <button type="button" class="btn-wb btn-wb-secondary btn-sm empty-action" @click="clearSearch">
                                <i class="bi bi-x-lg" aria-hidden="true"></i> Clear search
                            </button>
                        </div>

                        <template v-else-if="tab !== 'activities' && !searchTerm">
                            <div v-if="data.places.length === 0" class="empty-state">
                                <i class="bi bi-compass empty-icon" aria-hidden="true"></i>
                                <p class="empty-title">Uncharted territory</p>
                                <p class="stop-note">
                                    Nothing’s on the map within a <span class="num">{{ walkMinutes(data.radius) }} min</span> walk of this stop yet.
                                    Have a wander and see what you find.
                                </p>
                            </div>
                            <div v-else-if="shownPlaces.length === 0" class="empty-state">
                                <i class="bi empty-icon" :class="placeSections[selectedSection].icon" aria-hidden="true"></i>
                                <p class="empty-title">Nothing here yet</p>
                                <p class="stop-note">We didn’t find any {{ placeSections[selectedSection].label.toLowerCase() }} places near this stop.</p>
                            </div>
                        </template>

                        <div v-if="tab === 'activities' && !searchTerm && shownActivities.length === 0 && !draft && !activitiesError" class="empty-state">
                            <i class="bi bi-signpost-2 empty-icon" aria-hidden="true"></i>
                            <p class="empty-title">No signposts or challenges yet</p>
                            <p class="stop-note">
                                {{ showKinds.signpost || showKinds.challenge
                                    ? 'Tap “Leave a signpost” or “Set a challenge” above, and then tap the map, or drag one onto the map, to add the first.'
                                    : 'Turn on Signposts or Challenges above to see them.' }}
                            </p>
                        </div>

                        <template v-for="item in listItems" :key="item.kind ? item.key : item.id">
                            <ActivityCard
                                v-if="item.kind"
                                :activity="item"
                                :selected="item.key === selectedId"
                                :busy="busyKey === item.key"
                                :class="{ 'is-linked': hoverId === item.key, 'is-fresh': freshKey === item.key }"
                                :is-admin="isAdmin"
                                @mouseenter="hoverId = item.key"
                                @mouseleave="hoverId = ''"
                                @focusin="hoverId = item.key"
                                @focusout="hoverId = ''"
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
                                :class="{ 'is-linked': hoverId === item.id }"
                                :photos="photosByPlace[item.id]"
                                :is-admin="isAdmin"
                                @delete-photo="removePhoto"
                                @mouseenter="hoverId = item.id"
                                @mouseleave="hoverId = ''"
                                @focusin="hoverId = item.id"
                                @focusout="hoverId = ''"
                                :uploading="uploadingId === item.id"
                                @select="id => selectedId = id"
                                @upload="handleUpload"
                            />
                        </template>
                    </div>
                </div>
            </div>
        </template>
    </section>
</template>

<style scoped>
.page-title {
  font-size: var(--fs-title);
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 0 0 var(--sp-4);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  color: var(--wb-text-2);
  text-decoration: none;
  font-size: var(--fs-small);
  margin-bottom: var(--sp-1);
}

.back-link:hover {
  color: var(--wb-ink);
  text-decoration: underline;
}

.stop-note {
  color: var(--wb-text-2);
  padding: var(--sp-5) 0;
  margin: 0;
}

.stop-banner {
  background: var(--wb-amber-tint);
  color: var(--wb-amber-ink);
  border-radius: var(--r-control);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-4);
}

.banner-picks {
  font-size: var(--fs-small);
  margin: var(--sp-1) 0 0;
}

.stop-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  border-radius: var(--r-control);
  padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-4);
  margin-bottom: var(--sp-4);
  font-weight: 500;
}

.stop-notice.success {
  background: var(--wb-green-tint);
  color: var(--wb-green);
}

.stop-notice.error {
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
}

/* 44px dismiss, in the notice's own colour */
.notice-close {
  flex-shrink: 0;
  width: 44px;
  padding: 0;
  color: inherit;
}

.notice-close:hover {
  background: var(--wb-surface);
  color: inherit;
}

/* a block that failed to load: one sentence and a retry */
.load-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  background: var(--wb-danger-bg);
  color: var(--wb-danger);
  border-radius: var(--r-control);
  padding: var(--sp-3) var(--sp-4);
  flex-shrink: 0;
}

.load-error .btn-wb-secondary {
  background: var(--wb-surface);
}

/* All | Places | Activities: pill tabs on a tone track */
.stop-tabs {
  display: inline-flex;
  max-width: 100%;
  gap: var(--sp-1);
  padding: var(--sp-1);
  background: var(--wb-surface-2);
  border-radius: var(--r-pill);
  margin-bottom: var(--sp-4);
}

.stop-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: 44px;
  padding: 0 var(--sp-4);
  background: none;
  border: none;
  border-radius: var(--r-pill);
  font-weight: 500;
  color: var(--wb-text-2);
  white-space: nowrap;
  transition: background-color var(--t-micro) var(--ease), color var(--t-micro) var(--ease);
}

.stop-tab:hover {
  color: var(--wb-ink);
}

.stop-tab.active {
  background: var(--wb-green);
  color: var(--wb-on-ink);
}

.stop-tab:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

/* search: a labelled field with its own clear button (the browser's own one is hidden) */
.stop-search {
  max-width: 480px;
  margin-bottom: var(--sp-4);
}

.search-label {
  display: block;
  font-size: var(--fs-small);
  font-weight: 500;
  color: var(--wb-ink);
  margin-bottom: var(--sp-1);
}

.search-field {
  position: relative;
}

.search-icon {
  position: absolute;
  top: 50%;
  left: var(--sp-3);
  translate: 0 -50%;
  color: var(--wb-text-2);
  pointer-events: none;
}

.search-input {
  min-height: 48px;
  padding-left: calc(var(--sp-3) + 24px);
  padding-right: 48px;
  background: var(--wb-surface);
}

.search-input::placeholder {
  color: var(--wb-muted);
}

.search-input::-webkit-search-cancel-button {
  appearance: none;
}

.search-clear {
  position: absolute;
  top: 50%;
  right: 2px;
  translate: 0 -50%;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--r-control);
  background: none;
  color: var(--wb-text-2);
}

.search-clear:hover {
  color: var(--wb-ink);
  background: var(--wb-surface-2);
}

.search-clear:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: -3px;
}

.empty-action {
  margin-top: var(--sp-3);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-5);
  margin-bottom: var(--sp-5);
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.btn-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: 44px;
  background: var(--wb-surface-2);
  border: 2px solid transparent;
  color: var(--wb-ink);
  border-radius: var(--r-pill);
  padding: 0 var(--sp-4);
  font-weight: 500;
  font-size: var(--fs-small);
  transition: background-color var(--t-micro) var(--ease), border-color var(--t-micro) var(--ease);
}

.btn-chip:hover {
  border-color: var(--wb-control);
}

/* selected = green (the selected-state colour) */
.btn-chip.active {
  background: var(--wb-green-tint);
  border-color: var(--wb-green);
  color: var(--wb-ink);
}

.btn-chip:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.sub-chip-row {
  margin-top: calc(var(--sp-3) * -1);
  padding-left: var(--sp-4);
}

.btn-sub .bi {
  color: var(--wb-text-2);
}

.empty-state {
  flex-shrink: 0;
  background: var(--wb-surface-2);
  border-radius: var(--r-card);
  padding: var(--sp-5);
  text-align: center;
}

.empty-icon {
  display: block;
  font-size: 24px;
  color: var(--wb-text-2);
  margin-bottom: var(--sp-2);
}

.empty-title {
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
  margin: 0 0 var(--sp-1);
}

.empty-state .stop-note {
  padding: 0;
}

.chip-count {
  font-weight: 400;
  opacity: 0.8;
  margin-left: 2px;
}

.activity-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}

.btn-drag {
  cursor: grab;
}

.btn-drag:active {
  cursor: grabbing;
}

/* hover: the button lifts (the shared .btn-wb-* rule) and its pin icon wiggles once */
.drag-icon {
  display: inline-block;
  transform-origin: 50% 100%;
}

.btn-drag:hover .drag-icon,
.btn-drag:focus-visible .drag-icon {
  animation: pin-wiggle var(--t-reveal) var(--ease) 1;
}

@keyframes pin-wiggle {
  25% { transform: rotate(-12deg); }
  50% { transform: rotate(10deg); }
  75% { transform: rotate(-4deg); }
}

/* placing mode is on for this button */
.btn-drag.is-placing {
  outline: 3px solid var(--wb-green);
  outline-offset: 2px;
}

.placing-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  background: var(--wb-green-tint);
  color: var(--wb-ink);
  border-radius: var(--r-control);
  padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4);
  margin: calc(var(--sp-3) * -1) 0 var(--sp-5);
  animation: banner-in var(--t-ui) var(--ease) both;
}

.placing-text {
  margin: 0;
  font-weight: 500;
}

.placing-text .bi {
  color: var(--wb-green);
  margin-right: var(--sp-1);
}

.placing-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

@keyframes banner-in {
  from { opacity: 0; transform: translateY(-6px); }
}

/* a card whose pin is hovered (or the card itself is): an amber ring, the same one its pin gets */
.is-linked:not(.is-selected) {
  outline: 3px solid var(--wb-amber);
  outline-offset: 0;
}

/* just saved: the card flashes green once */
.is-fresh {
  position: relative;
}

.is-fresh::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--wb-green-tint);
  mix-blend-mode: multiply;
  pointer-events: none;
  opacity: 0;
  animation: card-flash var(--t-signature) var(--ease) both;
}

@keyframes card-flash {
  15% { opacity: 1; }
  100% { opacity: 0; }
}

.drag-hint {
  font-size: var(--fs-small);
  color: var(--wb-muted);
}

/* map on the left, scrolling list of cards on the right */
.stop-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-5);
  align-items: start;
}

/* position: relative makes the list the containing block for the cards' absolutely positioned
   .visually-hidden spans, so its overflow clips them; otherwise they escape the 520px scroll box and
   stretch the page past the footer (the blank space under it) */
.place-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  max-height: 520px;
  overflow-y: auto;
  padding: var(--sp-1);   /* room for the selected card's outline */
}

@media (max-width: 991.98px) {
  .stop-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .place-list {
    max-height: none;
    overflow-y: visible;
  }
}

@media (max-width: 399.98px) {
  .stop-tab {
    padding: 0 var(--sp-3);
    font-size: var(--fs-small);
  }

  .sub-chip-row {
    padding-left: 0;
  }
}
</style>
