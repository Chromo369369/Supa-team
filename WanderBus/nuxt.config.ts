// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  css: ['bootstrap/dist/css/bootstrap.min.css', '~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseKey: '',
      onemapToken: '', // Matches NUXT_PUBLIC_ONEMAP_TOKEN
      ltaKey: ''       // Matches NUXT_PUBLIC_LTA_KEY
    }
  },
})
