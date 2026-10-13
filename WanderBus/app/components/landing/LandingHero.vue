<script setup>
import LedBoard from '~/components/ui/LedBoard.vue';
import SpinTicket from '~/components/ui/SpinTicket.vue';
</script>

<template>
    <section class="container py-4">
        <LedBoard line1="SOMEWHERE NEW" line2="ANY BUS, ANY STOP" class="mb-5" />

        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <h1 class="hero-title">Take a random bus. Get off somewhere worth it.</h1>
                <p class="hero-text mt-3">
                    WanderBus selects a bus and a destination that fit your schedule and finds an activity or place of interest you might be interested.
                </p>
                <div class="d-flex flex-wrap gap-3 mt-4">
                    <NuxtLink to="/register" class="btn btn-wb-green">Start a side quest →</NuxtLink>
                    <NuxtLink to="/login" class="btn btn-wb-outline">I have an account</NuxtLink>
                </div>
                <p class="small-note mt-4">🚌 Uses the real routes of all 5,103 bus stops in Singapore.</p>
            </div>

            <div class="col-lg-6 text-center">
                <SpinTicket />
                <p class="small-note mt-3">Click on the stub to reveal your destination</p>
            </div>
        </div>
    </section>
</template>

<style scoped>
.hero-title {
  font-size: 3.6rem;
  font-weight: 800;
  line-height: 1.05;
  color: #141a33;
}

.btn-wb-green {
  background: #0b7a4b;
  color: #fff;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.btn-wb-green:hover {
  background: #096640;
  color: #fff;
}

.btn-wb-outline {
  background: #fff;
  border: 1px solid #c9ccd6;
  color: #141a33;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.btn-wb-outline:hover {
  background: #f1f2f6;
}
</style>
