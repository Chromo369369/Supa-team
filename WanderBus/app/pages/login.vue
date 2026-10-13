<script setup>
    import { ref } from 'vue'
    const email = ref('')
    const password = ref('')

    function handleLogin() {
    console.log('Email:', email.value)
}
</script>

<template>
    <div class="mb-3">
        <h1 class="text-center">Login to WanderBus</h1>

        <form @submit.prevent="handleLogin" class="mx-auto p-4" style="max-width: 420px;">

            <div class="mb-3">
                <label for="email">Email Address</label>
                <input id="email" type="email" placeholder="Enter your email" v-model="email" class="form-control" required>
            </div>
            
            <div class="mb-3">
                <label for="password">Password</label>
                <input id="password" type="password" placeholder="Enter your password" v-model="password" class="form-control" required>
            </div>
            
            <button type="submit" class="btn btn-primary w-100">Login</button>
        </form>
    </div>
</template>