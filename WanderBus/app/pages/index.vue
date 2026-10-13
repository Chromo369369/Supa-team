<script setup>
import LandingHero from '~/components/landing/LandingHero.vue';
import LandingSteps from '~/components/landing/LandingSteps.vue';
import LandingSafety from '~/components/landing/LandingSafety.vue';
import LandingFeatures from '~/components/landing/LandingFeatures.vue';
import LandingCta from '~/components/landing/LandingCta.vue';
</script>

<template>
    <!-- hero -->
    <LandingHero />

    <!-- how our app works? -->
    <LandingSteps />

    <!-- filters that user may select when choosing adventure -->
    <LandingSafety />

    <!-- features -->
    <LandingFeatures />

    <!-- CTA -->
    <LandingCta />
</template>
