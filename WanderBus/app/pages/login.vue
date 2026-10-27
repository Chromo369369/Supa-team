<script setup lang="ts">
    import { ref } from 'vue'
    const email = ref('')
    const password = ref('')
    const {$supabase} = useNuxtApp()
    

    async function handleLogin() {
        const {data,error} = await $supabase.auth.signInWithPassword({
            email:email.value,
            password:password.value
        })
        if (error){
            alert(error.message)
            password.value = ''
            return
        }
        if(data.session){
            await navigateTo('/home',{replace:true})
        }
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