<script setup>
const steps = [
    { num: 1, title: 'Set your limits', text: 'Choose where you’re starting, how long you have and what you feel like: food, cafés, parks, museums, sights or malls.' },
    { num: 2, title: 'Tear a ticket', text: 'Spin, then tear the stub to see your bus, where to board and where to get off.' },
    { num: 3, title: 'Ride and get off', text: 'Take the bus to your stop. The ride fits in the time you set.' },
    { num: 4, title: 'Explore, then head home', text: 'See what’s within 1 km of the stop, from hawker centres to parks, and save the trip to your passport.' }
]
</script>

<template>
    <section id="how-it-works" class="section-white">
        <div class="container landing-section">
            <h2 class="section-title steps-heading">How a side quest works</h2>

            <!-- Numbers removed per taste rules; to revert, restore the .step-num circle.
                 The order stays semantic: a real <ol> (role="list" keeps it a list once the markers are hidden). -->
            <ol class="row gx-4 gy-5 list-unstyled mb-0" role="list">
                <li v-for="step in steps" :key="step.num" class="col-md-6 col-lg-3">
                    <div class="step-line" aria-hidden="true">
                        <svg class="step-stop" :class="{ 'step-last': step.num === steps.length }" viewBox="0 0 24 40" width="24" height="40" focusable="false" aria-hidden="true">
                            <rect class="step-pole" x="10.5" y="12" width="3" height="28" />
                            <rect class="step-sign" x="2" y="0" width="20" height="15" rx="4" />
                            <rect class="step-glyph" x="6" y="4" width="12" height="6" rx="1.5" />
                            <circle class="step-glyph" cx="8.5" cy="11.5" r="1.5" />
                            <circle class="step-glyph" cx="15.5" cy="11.5" r="1.5" />
                        </svg>
                    </div>
                    <h3 class="step-title">{{ step.title }}</h3>
                    <p class="step-text mb-0">{{ step.text }}</p>
                </li>
            </ol>
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

.steps-heading {
  margin: 0 0 var(--sp-7);
}

/* The route: a road line with a stop for each step */
.step-line {
  display: flex;
  align-items: center;
  height: 44px;
  border-bottom: 3px solid var(--wb-ink);
}

/* A bus-stop sign on a pole, standing on the route line (the last stop is amber) */
.step-stop {
  display: block;
  flex: none;
  align-self: flex-end;
  margin-bottom: -3px; /* the pole meets the road line */
}

.step-pole { fill: var(--wb-ink); }
.step-sign { fill: var(--wb-green); }
.step-glyph { fill: var(--wb-on-ink); }
.step-last .step-sign { fill: var(--wb-amber); }
.step-last .step-glyph { fill: var(--wb-ink); }

.step-title {
  margin: var(--sp-5) 0 var(--sp-2);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.step-text {
  color: var(--wb-text-2);
}
</style>
