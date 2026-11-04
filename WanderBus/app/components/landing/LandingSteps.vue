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

            <ol class="row gx-4 gy-5 list-unstyled mb-0">
                <li v-for="step in steps" :key="step.num" class="col-md-6 col-lg-3">
                    <div class="step-line" aria-hidden="true">
                        <span class="step-num num" :class="{ 'step-last': step.num === 4 }">{{ step.num }}</span>
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
  height: 24px;
  border-bottom: 3px solid var(--wb-ink);
}

.step-num {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: -24px;
  border-radius: 50%;
  background: var(--wb-surface);
  border: 3px solid var(--wb-ink);
  color: var(--wb-ink);
  font-family: var(--font-display);
  font-weight: 600;
}

.step-last {
  background: var(--wb-amber);
}

.step-title {
  margin: var(--sp-6) 0 var(--sp-2);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.step-text {
  color: var(--wb-text-2);
}
</style>
