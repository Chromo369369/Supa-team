<script setup>
import SpinTicket from '~/components/ui/SpinTicket.vue';
import HeroChase from '~/components/landing/HeroChase.vue';
</script>

<template>
    <section class="container hero-section">
        <!-- Full width so the headline holds to two lines at every width -->
        <h1 class="hero-title">Take a random bus. Get off somewhere worth it.</h1>

        <div class="row align-items-center gx-4 gx-lg-5 gy-5">
            <div class="col-lg-5">
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
                <!-- Below the CTAs: "How it works", then the lane the idle bus loops in
                     (the on/off control is LandingCursor's corner pill) -->
                <div class="hero-foot">
                    <a href="#how-it-works" class="hero-how">How it works ↓</a>
                    <span class="hero-lane" data-chase-lane aria-hidden="true"></span>
                </div>
            </div>

            <div class="col-lg-7 hero-ticket">
                <SpinTicket />
                <p class="small-note mt-3 mb-0">Drag, tap or press Enter to tear the stub</p>
            </div>
        </div>

        <HeroChase />
    </section>
</template>

<style scoped>
.hero-section {
  position: relative;
  padding-block: var(--sp-7) var(--sp-8);
  padding-inline: var(--gutter);
}

/* Content sits above the chase layer. */
.hero-title,
.hero-section > .row {
  position: relative;
  z-index: 1;
}

/* 7vw keeps it to two lines on phones; full width keeps it to two on desktop */
.hero-title {
  margin: 0 0 var(--sp-6);
  font-size: min(var(--fs-hero), 7vw);
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

/* Focus lands here after the intro; it is not a control, so no ring. */
.hero-title:focus {
  outline: none;
}

.hero-actions {
  margin-top: var(--sp-5);
}

.hero-note {
  margin-top: var(--sp-5);
}

.hero-foot {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}

/* Free space the idle bus and mascot loop in (HeroChase finds it by data-chase-lane). */
.hero-lane {
  flex: 1 1 auto;
  min-width: 0;
  height: 56px;
}

.hero-how {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--wb-ink);
  font-weight: 500;
  text-underline-offset: 4px;
}

.hero-how:hover {
  color: var(--wb-green);
}

.hero-how:focus-visible {
  outline: 3px solid var(--wb-green);
  outline-offset: 3px;
  border-radius: var(--r-control);
}

.hero-ticket {
  text-align: center;
}

@media (min-width: 992px) {
  .hero-section {
    padding-block: var(--sp-8) var(--sp-9);
  }

  /* the ticket is the dominant thing on the right, set against the far margin */
  .hero-ticket {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
  }
}
</style>
