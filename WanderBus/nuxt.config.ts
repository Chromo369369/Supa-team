// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr:false,
  css: ['bootstrap/dist/css/bootstrap.min.css', '~/assets/css/main.css'],
  runtimeConfig: {
    ltaAccountKey: '',
    onemapToken:'',
    public:{
      supabaseUrl:'https://yqtrlcaggawzcdjidxyb.supabase.co',
      supabaseKey:'sb_publishable_as8YZ4tW4W1d8j2oFAfeBQ_NsOmnkAn'
    }
  },
})
