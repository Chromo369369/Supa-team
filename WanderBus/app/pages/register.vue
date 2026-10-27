<script setup>
    import { ref } from 'vue'
    const { $supabase } = useNuxtApp()
    const email = ref('')
    const name = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const check = ref(false)

    async function handleRegister() {
        if (password.value !== confirmPassword.value) {
            alert('Passwords do not match!')
            return
        }
        const {data,error} = await $supabase.auth.signUp({
            email: email.value,
            password: password.value,
            options:{
                data:{ display_name: name.value}
            }
        })
        if (error){
            alert(error.message)
            return
        }
        if (data.session){
            navigateTo('/home')
        }
        else{
            check.value = true
        }
        console.log('Registration form validated!')
}
</script>

<template>
    <div class="mb-3" v-if="!check">
        <h1 class="text-center">Create your WanderBus Account</h1>

        <form @submit.prevent="handleRegister" class="mx-auto p-4" style="max-width: 420px;">
            <div class="mb-3">
                <label for="name">Name</label>
                <input id="name" type="text" placeholder="Enter your name" v-model="name" 
                class="form-control" required>
            </div>

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
    <div v-if="check">
        <h1 class="text-center">Account creation successful, please confirm your email and log in.</h1>
    </div>
</template>