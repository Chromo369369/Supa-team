<script setup>
const limits = [
    { icon: '🚶', label: 'Walk to the stop', value: 'up to 400 m' },
    { icon: '⏱', label: 'Time on the bus', value: 'up to 40 min' },
    { icon: '📍', label: 'Things to do within 1 km', value: 'at least 3' },
    { icon: '🏠', label: 'Home by', value: '11:00 pm' }
]

const checks = [
    { text: 'The SMU stop is 143 m from you', tag: 'Walk' },
    { text: '19 min on bus 16, 12 stops', tag: 'Ride time' },
    { text: '11 food spots within 1 km, including Tiong Bahru Market', tag: 'Worth it' },
    { text: 'Leave by 10:29 pm to be home by 11:00 pm', tag: 'Return-by' }
]
</script>

<template>
    <!-- filters that user may select when choosing adventure -->
    <section class="container py-5">
        <div class="row align-items-center g-5">
            <div class="col-lg-5">
                <h2 class="section-title">Random, never reckless.</h2>
                <p class="hero-text mt-3">
                    Choosing a bus blindly can leave you in an industrial estate at dusk. Every WanderBus ticket passes 4 safety checks, and you can set your own preferences.
                </p>

                <div v-for="limit in limits" :key="limit.label" class="limit-row">
                    <span>{{ limit.icon }} {{ limit.label }}</span>
                    <span class="limit-dots"></span>
                    <strong>{{ limit.value }}</strong>
                </div>
            </div>

            <div class="col-lg-7">
                <div class="check-card">
                    <div class="check-header">
                        <span class="bus-badge">16</span>
                        <div>
                            <h5 class="mb-1">Bus 16 to Blk 55, Tiong Bahru</h5>
                            <p class="check-sub mb-0">From SMU on a Wednesday afternoon</p>
                        </div>
                    </div>

                    <div v-for="check in checks" :key="check.tag" class="check-row">
                        <span class="check-tick">✓</span>
                        <span class="check-text">{{ check.text }}</span>
                        <span class="check-tag">{{ check.tag }}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.limit-row {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  color: #141a33;
}

.limit-dots {
  flex: 1;
  border-bottom: 2px dotted #c9ccd6;
}

.check-card {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
}

.check-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: #141a33;
  color: #fff;
}

.bus-badge {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid #2a3150;
  color: #f5a623;
  font-size: 1.8rem;
  font-weight: 700;
}

.check-sub {
  font-size: 0.85rem;
  color: #a0a0a5;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 24px;
  padding: 16px 0;
  border-bottom: 1px dashed #e3e5ec;
}

.check-row:last-child {
  border-bottom: none;
}

.check-tick {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e2f3ea;
  color: #0b7a4b;
  font-size: 0.8rem;
}

.check-text {
  flex: 1;
  font-weight: 600;
  color: #141a33;
}

.check-tag {
  padding: 4px 10px;
  border: 1px solid #e3e5ec;
  border-radius: 50px;
  background: #f4f5f8;
  font-size: 0.8rem;
  color: #4a5068;
}
</style>
