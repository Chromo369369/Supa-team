export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  css: [
    'bootstrap/dist/css/bootstrap.min.css',
    'bootstrap-icons/font/bootstrap-icons.min.css',
    '~/assets/css/main.css',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'en-SG' },
      title: 'WanderBus',
      meta: [
        { name: 'theme-color', content: '#141a33' },
        { name: 'color-scheme', content: 'light' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'preconnect', href: 'https://www.onemap.gov.sg' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Lexend+Deca:wght@400;500;600&family=Caveat:wght@500&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    ltaAccountKey:'',
    onemapToken:'',
    public: {
      supabaseUrl: '',
      supabaseKey: ''
    }
  },
})
