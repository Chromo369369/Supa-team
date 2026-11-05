<script setup>
import { ref, onMounted } from 'vue'

const { $supabase } = useNuxtApp()

const isAdmin = ref(false)
const loading = ref(true)
const pendingPhotos = ref([])
const photosLoading = ref(false)
const reviewingId = ref(null)

onMounted(async () => {
    // Check who is logged in
    const { data: { user }, error: userError } =
        await $supabase.auth.getUser()

    if (userError || !user) {
        loading.value = false
        return
    }

    // Check if this user is an admin
    const { data, error } = await $supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) {
        console.error('Error checking admin role:', error.message)
    }

    isAdmin.value = !!data

    if (isAdmin.value) {
        await fetchPendingPhotos()
    }

    loading.value = false
})

async function fetchPendingPhotos() {
    photosLoading.value = true

    try {
        const { data, error } = await $supabase
            .from('place_photos')
            .select('id, place_name, path, user_id, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) throw error

        pendingPhotos.value = await Promise.all(
            (data ?? []).map(async (photo) => {
                const { data: signed, error: urlError } =
                    await $supabase.storage
                        .from('place-photos')
                        .createSignedUrl(photo.path, 600)

                return {
                    ...photo,
                    url: urlError ? null : signed.signedUrl
                }
            })
        )
    } catch (error) {
        console.error('Error loading pending photos:', error)
        alert('Failed to load pending photos.')
    } finally {
        photosLoading.value = false
    }
}
</script>

<template>
    <div class="container py-5">

        <div v-if="loading" class="text-center">
            <p>Checking admin access...</p>
        </div>

        <div v-else-if="!isAdmin" class="text-center">
            <h2>Access Denied</h2>
            <p>You do not have permission to view this page.</p>
            <NuxtLink to="/home" class="btn btn-primary">
                Back to Home
            </NuxtLink>
        </div>

        <div v-else>
            <h1 class="mb-4">🚌 WanderBus Admin Dashboard</h1>

            <div class="alert alert-success">
                Welcome, Admin! You have successfully logged in.
            </div>

            <div class="row g-4">
                <div class="col-md-6">
                    <div class="card p-4 h-100">
                        <h4>📸 Photo Approvals</h4>
                        <p>Review and manage user-submitted amenity photos.</p>
                        <span class="text-muted">
                            Coming soon
                        </span>
                    </div>
                </div>

                
                <div class="col-md-6">
                    <div class="card p-4 h-100">
                        <h4>📸 Photo Approvals</h4>
                        <p>Review user-submitted amenity photos.</p>

                        <p v-if="photosLoading">Loading submissions...</p>

                        <p v-else-if="pendingPhotos.length === 0">
                            No pending photos.
                        </p>

                        <div
                            v-for="photo in pendingPhotos"
                            :key="photo.id"
                            class="border rounded p-3 mb-3"
                        >
                            <h5>{{ photo.place_name }}</h5>

                            <img
                                v-if="photo.url"
                                :src="photo.url"
                                alt="Submitted amenity photo"
                                class="img-fluid rounded mb-3"
                                style="max-height: 200px;"
                            />

                            <p v-else class="text-muted">
                                Preview unavailable
                            </p>

                            <div class="d-flex gap-2">
                                <button
                                    class="btn btn-success"
                                    :disabled="reviewingId === photo.id"
                                    @click="approvePhoto(photo)"
                                >
                                    Approve
                                </button>

                                <button
                                    class="btn btn-danger"
                                    :disabled="reviewingId === photo.id"
                                    @click="rejectPhoto(photo)"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            
        </div>

    </div>
</template>