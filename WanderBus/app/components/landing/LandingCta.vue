<script setup>
import LedBoard from '~/components/ui/LedBoard.vue';
</script>

<template>
    <section class="container py-5">
        <div class="cta-box row align-items-center g-4">
            <div class="col-lg-6">
                <LedBoard line1="YOUR NEXT STOP" line2="IS WAITING" />
            </div>
            <div class="col-lg-6">
                <h2 class="section-title text-white">Free for a couple of hours?</h2>
                <p class="cta-text mt-2">All it takes is one tap to find something fun to do in your neighbourhood.</p>
                <NuxtLink to="/register" class="btn btn-wb-yellow mt-2">Create a free account</NuxtLink>
            </div>
        </div>
    </section>
</template>

<style scoped>
.cta-box {
  margin: 0;
  padding: 32px;
  background: #141a33;
  border-radius: 24px;
}

.cta-text {
  color: #c9ccd6;
}

.btn-wb-yellow {
  background: #f5a623;
  color: #141a33;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.btn-wb-yellow:hover {
  background: #e0951a;
  color: #141a33;
}
</style>
