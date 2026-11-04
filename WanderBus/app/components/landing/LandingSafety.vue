<script setup>
const limits = [
    { icon: 'bi-person-walking', label: 'Walk to the stop', value: 'up to 400 m' },
    { icon: 'bi-stopwatch', label: 'Time on the bus', value: 'up to 40 min' },
    { icon: 'bi-geo-alt-fill', label: 'Things to do within 1 km', value: 'at least 3' },
    { icon: 'bi-house', label: 'Home by', value: '11:00 pm' }
]

const checks = [
    { text: 'The SMU stop is 143 m from you', tag: 'Walk' },
    { text: '19 min on bus 16, 12 stops', tag: 'Ride time' },
    { text: '11 food spots within 1 km, including Tiong Bahru Market', tag: 'Worth it' },
    { text: 'Leave by 10:29 pm to be home by 11:00 pm', tag: 'Home by' }
]
</script>

<template>
    <!-- filters that user may select when choosing adventure -->
    <section class="container landing-section">
        <div class="row align-items-center gx-4 gx-lg-5 gy-5">
            <div class="col-lg-5">
                <h2 class="section-title mb-0">Random, but within your limits.</h2>
                <p class="hero-text safety-intro">
                    Hop on any bus and you could end up in an industrial estate at dusk. Every WanderBus ticket passes 4 safety checks first, and you set your own preferences.
                </p>

                <ul class="list-unstyled mb-0">
                    <li v-for="limit in limits" :key="limit.label" class="limit-row">
                        <span><i class="bi limit-icon" :class="limit.icon" aria-hidden="true"></i> {{ limit.label }}</span>
                        <span class="limit-dots" aria-hidden="true"></span>
                        <strong class="num">{{ limit.value }}</strong>
                    </li>
                </ul>
            </div>

            <div class="col-lg-7">
                <div class="check-card">
                    <div class="check-header">
                        <span class="bus-badge num" aria-hidden="true">16</span>
                        <div>
                            <h3 class="check-title">Bus 16 to Blk 55, Tiong Bahru</h3>
                            <p class="check-sub mb-0">From SMU on a Wednesday afternoon</p>
                        </div>
                    </div>

                    <ul class="list-unstyled mb-0">
                        <li v-for="check in checks" :key="check.tag" class="check-row">
                            <span class="check-tick"><i class="bi bi-check-lg" aria-hidden="true"></i></span>
                            <span class="check-text num">{{ check.text }}</span>
                            <span class="check-tag">{{ check.tag }}</span>
                        </li>
                    </ul>
                </div>
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

.safety-intro {
  margin: var(--sp-4) 0 var(--sp-5);
}

.limit-row {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
  color: var(--wb-ink);
}

.limit-icon {
  margin-right: var(--sp-1);
  color: var(--wb-text-2);
}

/* dotted leader, like a timetable */
.limit-dots {
  flex: 1;
  min-width: var(--sp-4);
  border-bottom: 2px dotted var(--wb-control);
}

.limit-row strong {
  font-weight: 600;
  white-space: nowrap;
}

/* Sits on a tone step, no outline */
.check-card {
  padding: var(--sp-5);
  background: var(--wb-surface-2);
  border-radius: var(--r-card);
}

.check-header {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-bottom: var(--sp-3);
}

/* the bus-stop marker: navy square, amber number */
.bus-badge {
  flex: none;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-control);
  background: var(--wb-ink);
  color: var(--wb-amber);
  font-family: var(--font-display);
  font-size: var(--fs-title);
  font-weight: 600;
}

.check-title {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.check-sub {
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

.check-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
}

.check-tick {
  flex: none;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--wb-green-tint);
  color: var(--wb-green);
  font-size: var(--fs-small);
}

.check-text {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  color: var(--wb-ink);
}

.check-tag {
  flex: none;
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-pill);
  background: var(--wb-surface);
  font-size: var(--fs-small);
  color: var(--wb-text-2);
}

@media (max-width: 575.98px) {
  .check-card {
    padding: var(--sp-4);
  }

  .check-row {
    flex-wrap: wrap;
  }

  .check-tag {
    margin-left: calc(28px + var(--sp-3));
  }
}
</style>
