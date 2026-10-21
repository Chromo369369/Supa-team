<script setup>
    import { ref, resolveDirective } from 'vue'
    const email = ref('')
    const password = ref('')
    const confirmPassword = ref('')

    function handleRegister() {
        if (password.value !== confirmPassword.value) {
            alert('Passwords do not match!')
            return
        }

        console.log('Registration form validated!')
}
</script>

<template>
    <div class="mb-3">
        <h1 class="text-center">Create your WanderBus Account</h1>

        <form @submit.prevent="handleRegister" class="mx-auto p-4" style="max-width: 420px;">

            <div class="mb-3">
                <label for="email">Email Address</label>
                <input id="email" type="email" placeholder="Enter your email" v-model="email" 
                class="form-control" required>
            </div>
            
            <div class="mb-3">
                <label for="password">Password</label>
                <input id="password" type="password" placeholder="Enter your password" v-model="password" 
                minlength=8 class="form-control" required>
            </div>

            <div class="mb-3">
                <label for="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" placeholder="Re-enter your password" v-model="confirmPassword" 
                class="form-control" required>
            </div>
            
            <button type="submit" class="btn btn-primary w-100">Register</button>
        </form>
    </div>
</template>