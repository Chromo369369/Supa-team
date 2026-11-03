export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  css: ['bootstrap/dist/css/bootstrap.min.css', '~/assets/css/main.css'],
  runtimeConfig: {
    ltaAccountKey:'',
    onemapToken:'',
    public: {
      supabaseUrl: '',
      supabaseKey: '',
      ltaKey: '',        // Maps to NUXT_PUBLIC_LTA_KEY in your .env
      onemapToken: ''    // Maps to NUXT_PUBLIC_ONEMAP_TOKEN in your .env
    }
  },
})