<!-- design navbar, footer to navigate multiple pages -->
<!-- login, register, home -->

<script setup>
import WbToast from '~/components/ui/WbToast.vue'
import WbConfirm from '~/components/ui/WbConfirm.vue'
</script>

<template>
    <div class="app-layout">
        <a href="#main" class="skip-link">Skip to content</a>
        <SiteHeader />

        <main id="main" tabindex="-1">
            <slot />
        </main>

        <SiteFooter />

        <WbToast />
        <WbConfirm />
    </div>

</template>
