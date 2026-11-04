<script setup lang="ts">
    import { ref } from 'vue'
    import AuthCard from '~/components/ui/AuthCard.vue'
    const email = ref('')
    const password = ref('')
    const submitting = ref(false)
    const {$supabase} = useNuxtApp()


    async function handleLogin() {
        submitting.value = true
        const {data,error} = await $supabase.auth.signInWithPassword({
            email:email.value,
            password:password.value
        })
        submitting.value = false
        if (error){
            alert(error.message)
            password.value = ''
            return
        }
        if(data.session){
            await navigateTo('/home',{replace:true})
        }
}
</script>

<template>
    <AuthCard
        title="Log in"
        intro="Pick up where you left off, or start a new side quest."
        :sign="[['WELCOME BACK', 'EXPLORER']]"
        sign-label="Welcome back, explorer"
    >
        <form @submit.prevent="handleLogin" class="auth-form">
            <div>
                <label for="email" class="form-label">Email address</label>
                <input id="email" type="email" placeholder="Enter your email" v-model="email" class="form-control" autocomplete="email" required>
            </div>

            <div>
                <label for="password" class="form-label">Password</label>
                <input id="password" type="password" placeholder="Enter your password" v-model="password" class="form-control" autocomplete="current-password" required>
            </div>

            <button type="submit" class="btn btn-wb-green btn-lg w-100" :disabled="submitting">
                {{ submitting ? 'Logging in…' : 'Log in' }}
            </button>
        </form>

        <template #footer>
            New to WanderBus? <NuxtLink to="/register">Create an account</NuxtLink>
        </template>
    </AuthCard>
</template>
