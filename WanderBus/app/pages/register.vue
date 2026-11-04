<script setup>
    import { ref } from 'vue'
    import AuthCard from '~/components/ui/AuthCard.vue'
    const { $supabase } = useNuxtApp()
    const email = ref('')
    const name = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const check = ref(false)
    const submitting = ref(false)

    async function handleRegister() {
        if (password.value !== confirmPassword.value) {
            alert('Passwords do not match!')
            return
        }
        submitting.value = true
        const {data,error} = await $supabase.auth.signUp({
            email: email.value,
            password: password.value,
            options:{
                data:{ display_name: name.value}
            }
        })
        submitting.value = false
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
}
</script>

<template>
    <AuthCard
        v-if="!check"
        title="Create your account"
        intro="Your trips and passport stay private to you."
        :sign="[['NEW EXPLORER', 'NOW BOARDING']]"
        sign-label="New explorer, now boarding"
    >
        <form @submit.prevent="handleRegister" class="auth-form">
            <div>
                <label for="name" class="form-label">Name</label>
                <input id="name" type="text" placeholder="Enter your name" v-model="name"
                class="form-control" autocomplete="name" required>
            </div>

            <div>
                <label for="email" class="form-label">Email address</label>
                <input id="email" type="email" placeholder="Enter your email" v-model="email"
                class="form-control" autocomplete="email" required>
            </div>

            <div>
                <label for="password" class="form-label">Password</label>
                <input id="password" type="password" placeholder="At least 8 characters" v-model="password"
                minlength=8 class="form-control" autocomplete="new-password" required>
            </div>

            <div>
                <label for="confirmPassword" class="form-label">Confirm password</label>
                <input id="confirmPassword" type="password" placeholder="Re-enter your password" v-model="confirmPassword"
                class="form-control" autocomplete="new-password" required>
            </div>

            <button type="submit" class="btn btn-wb-green btn-lg w-100" :disabled="submitting">
                {{ submitting ? 'Creating your account…' : 'Create account' }}
            </button>
        </form>

        <template #footer>
            Already have an account? <NuxtLink to="/login">Log in</NuxtLink>
        </template>
    </AuthCard>

    <AuthCard
        v-else
        title="Check your inbox"
        intro="Your account has been created. Confirm your email, then log in to start your first side quest."
        :sign="[['CHECK YOUR', 'INBOX']]"
        sign-label="Check your inbox"
    >
        <NuxtLink to="/login" class="btn btn-wb-green btn-lg w-100 mt-3">Go to log in</NuxtLink>
    </AuthCard>
</template>
