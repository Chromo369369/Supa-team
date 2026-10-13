<script setup>
const steps = [
    { num: 1, title: 'Set your limits', text: "Pick a mood and a budget. How far you'll walk, how long you'll ride and when you need to be home are already filled in." },
    { num: 2, title: 'Tear a ticket', text: 'Select 3 mystery tickets show only the vibe and the ride time. Tear one to see your bus, where to board and how many stops.' },
    { num: 3, title: 'Ride and check in', text: 'Your stops count down as the bus moves. Get off, and WanderBus checks you are really there before it counts the trip.' },
    { num: 4, title: 'Explore, then head home', text: 'Explore neighbourhood areas like parks, cafes and hawker centers nearby and have fun!' }
]
</script>

<template>
    <section class="section-white">
        <div class="container py-5">
            <h2 class="section-title mb-5">How does a side quest works?</h2>

            <div class="row g-4">
                <div v-for="step in steps" :key="step.num" class="col-md-6 col-lg-3">
                    <div class="step-line">
                        <span class="step-num" :class="{ 'step-last': step.num === 4 }">{{ step.num }}</span>
                    </div>
                    <h5 class="step-title mt-4">{{ step.title }}</h5>
                    <p class="step-text">{{ step.text }}</p>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.step-line {
  display: flex;
  align-items: center;
  border-bottom: 3px solid #0b7a4b;
  height: 24px;
}

.step-num {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #0b7a4b;
  color: #0b7a4b;
  font-weight: 700;
  margin-bottom: -24px;
}

.step-last {
  background: #f5a623;
  border-color: #141a33;
  color: #141a33;
}

.step-title {
  font-weight: 600;
  color: #141a33;
}

.step-text {
  font-size: 0.95rem;
  color: #4a5068;
}
</style>
