<script setup>
import { provide } from 'vue';
import LandingHero from '~/components/landing/LandingHero.vue';
import LandingSteps from '~/components/landing/LandingSteps.vue';
import BusTurntable from '~/components/landing/BusTurntable.vue';
import LandingCta from '~/components/landing/LandingCta.vue';
import LandingCursor, { BUS_CURSOR_KEY, createBusCursorState } from '~/components/landing/LandingCursor.vue';

// One shared state for the page-wide cursor bus (LandingCursor) and the hero's lane bus (HeroChase).
provide(BUS_CURSOR_KEY, createBusCursorState());

</script>

<template>
    <!-- The landing root: LandingCursor toggles `landing--bus-cursor` here (cursor: none on this page only). -->
    <div class="landing">
        <LandingHero />
        <LandingSteps />
        <BusTurntable />
        <LandingCta />
        <LandingCursor />
    </div>
</template>

<style>
/* The landing sections set their own --gutter, so main's 20px side padding would double it
   (content at 36px vs the header's 16px on phones). Landing page only. */
main:has(> .landing) {
    padding-inline: 0;
}
</style>
