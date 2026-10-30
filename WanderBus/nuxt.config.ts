export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  css: ['bootstrap/dist/css/bootstrap.min.css', '~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseKey: '',
      ltaAccountKey: '',
      onemapToken: ''
    }
  },
})