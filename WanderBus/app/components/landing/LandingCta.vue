<script setup>
import LedBoard from '~/components/ui/LedBoard.vue';
</script>

<template>
    <section class="container landing-section">
        <div class="cta-box row align-items-center gx-0 gy-4 gx-lg-5">
            <div class="col-lg-6">
                <LedBoard :messages="[['YOUR NEXT STOP', 'IS WAITING'], ['ONE SPIN', 'ONE NEW STOP']]" label="Your next stop is waiting" />
            </div>
            <div class="col-lg-6">
                <h2 class="section-title cta-title mb-0">Free for a couple of hours?</h2>
                <p class="cta-text">One spin gets you a bus, a stop and things to do when you get off.</p>
                <NuxtLink to="/register" class="btn btn-wb-signal btn-lg">Create a free account</NuxtLink>
            </div>
        </div>
    </section>
</template>

<style scoped>
.landing-section {
  padding-block: var(--sp-8);
  padding-inline: var(--gutter);
}

@media (min-width: 992px) {
  .landing-section {
    padding-block: var(--sp-9);
  }
}

.cta-box {
  margin: 0;
  padding: var(--sp-5);
  background: var(--wb-ink);
  border-radius: var(--r-card);
}

.cta-title {
  color: var(--wb-on-ink);
}

.cta-text {
  margin: var(--sp-3) 0 var(--sp-5);
  color: var(--wb-on-ink-2);
}

@media (min-width: 768px) {
  .cta-box {
    padding: var(--sp-7);
  }
}
</style>
