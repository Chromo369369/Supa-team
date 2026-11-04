<script setup>
import LedBoard from '~/components/ui/LedBoard.vue';
import SpinTicket from '~/components/ui/SpinTicket.vue';

const signMessages = [
    ['SOMEWHERE NEW', 'ANY BUS, ANY STOP'],
    ['HAWKER? PARK?', 'TEAR A TICKET'],
    ['FREE FOR A BIT?', 'TAKE A SIDE QUEST'],
    ['5103 STOPS', 'ALL FAIR GAME']
]
</script>

<template>
    <section class="container hero-section">
        <LedBoard :messages="signMessages" label="Destination: somewhere new" class="hero-sign" />

        <h1 class="hero-title">Take a random bus. Get off somewhere worth it.</h1>

        <div class="row align-items-center gx-4 gx-lg-5 gy-5">
            <div class="col-lg-6">
                <p class="hero-text mb-0">
                    WanderBus picks a stop you can reach in the time you have, with places to explore when you get off.
                </p>
                <div class="d-flex flex-wrap gap-3 hero-actions">
                    <NuxtLink to="/register" class="btn btn-wb-primary btn-lg">Start a side quest →</NuxtLink>
                    <NuxtLink to="/login" class="btn btn-wb-secondary btn-lg">Log in</NuxtLink>
                </div>
                <p class="small-note hero-note mb-0">
                    <i class="bi bi-bus-front" aria-hidden="true"></i>
                    Built on real bus routes, covering all <span class="num">5,103</span> stops in Singapore.
                </p>
                <a href="#how-it-works" class="hero-how">How it works ↓</a>
            </div>

            <div class="col-lg-6 text-center">
                <SpinTicket />
                <p class="small-note mt-3 mb-0">Drag, tap or press Enter to tear the stub</p>
            </div>
        </div>
    </section>
</template>

<style scoped>
.hero-section {
  padding-block: var(--sp-5) var(--sp-8);
  padding-inline: var(--gutter);
}

.hero-sign {
  margin-bottom: var(--sp-7);
}

/* Full width so the headline holds to two lines on desktop */
.hero-title {
  margin: 0 0 var(--sp-5);
  font-size: var(--fs-hero);
  line-height: 1;
  letter-spacing: -0.02em;
}

.hero-actions {
  margin-top: var(--sp-5);
}

.hero-note {
  margin-top: var(--sp-5);
}

.hero-how {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: var(--sp-2);
  color: var(--wb-ink);
  font-weight: 500;
  text-underline-offset: 4px;
}

.hero-how:hover {
  color: var(--wb-green);
}

@media (min-width: 992px) {
  .hero-section {
    padding-bottom: var(--sp-9);
  }
}
</style>
