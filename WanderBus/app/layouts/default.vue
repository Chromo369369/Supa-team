<!-- design navbar, footer to navigate multiple pages -->
<!-- login, register, home -->

<script setup>
</script>

<template>
    <div class="app-layout">
        <SiteHeader />

        <main>
            <slot />
        </main>

        <SiteFooter />
    </div>

</template>
