<!-- design navbar, footer to navigate multiple pages -->
<!-- login, register, home -->

<script setup>
</script>

<template>
    <div class="app-layout">
        <nav>
            <NuxtLink to="/home">Home</NuxtLink>
            <NuxtLink to="/login">Login</NuxtLink>
            <NuxtLink to="/register">Register</NuxtLink>
        </nav>

        <main>
            <slot />
        </main>

        <footer>
            <p>WanderBus Footer</p>
        </footer>
    </div>

</template>