// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  css: ['bootstrap/dist/css/bootstrap.min.css', '~/assets/css/main.css'],
  runtimeConfig: {
    // private: server-only (LTA DataMall + OneMap)
    ltaAccountKey: '',
    onemapToken: '',
    // public: exposed to the browser
    public: {
      supabaseUrl: '',
      supabaseKey: ''
    }
  },
})