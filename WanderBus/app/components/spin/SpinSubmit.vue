<script setup>
defineProps({
    submitted: Boolean,
    saving: Boolean,
    saved: Boolean
})
defineEmits(['saveTrip'])
</script>

<template>
    <button
        v-if="submitted"
        type="button"
        class="btn btn-wb-secondary"
        :disabled="saving || saved"
        :aria-busy="saving ? 'true' : undefined"
        @click="$emit('saveTrip')"
    >
        <template v-if="saved">
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            Saved
        </template>
        <template v-else-if="saving">Saving…</template>
        <template v-else>
            <i class="bi bi-journal-bookmark" aria-hidden="true"></i>
            Save to passport
        </template>
    </button>
</template>
