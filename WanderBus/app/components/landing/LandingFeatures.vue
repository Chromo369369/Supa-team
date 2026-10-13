<script setup>
const features = [
    { icon: '📍', title: 'Around this stop', text: 'A map of places within 1 km, with photos from other explorers. Be first to photograph an undiscovered spot and earn Pioneer badge.' },
    { icon: '🚩', title: 'Signposts and challenges', text: 'Tips, ratings and mini-challenges pinned shared by previous explorers in the area.' },
    { icon: '🎫', title: 'A card for every stop', text: 'Arrive and claim a collectible card with your avatar at that stop.' },
    { icon: '📔', title: 'Passport', text: 'Every trip saved as a memory log in your passport with your route, photos and thoughts.' },
    { icon: '👥', title: 'Group spin', text: 'Up to 5 friends join one lobby and vote for a destination out of 3 mystery tickets.' }
]
</script>

<template>
    <section class="section-white">
        <div class="container py-5">
            <div class="row g-5">
                <div class="col-lg-4">
                    <h2 class="section-title">Every stop has something behind.</h2>
                    <p class="hero-text mt-3">
                        The spin gets you there. What explorers leave at each stop makes the next trip better, and gives you a reason to come back.
                    </p>
                </div>

                <div class="col-lg-8">
                    <div v-for="feature in features" :key="feature.title" class="feature-row">
                        <span class="feature-icon">{{ feature.icon }}</span>
                        <div>
                            <h5 class="feature-title">{{ feature.title }}</h5>
                            <p class="feature-text mb-0">{{ feature.text }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.feature-row {
  display: flex;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid #e3e5ec;
}

.feature-row:last-child {
  border-bottom: none;
}

.feature-icon {
  min-width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #f4f5f8;
  font-size: 1.3rem;
}

.feature-title {
  font-weight: 700;
  color: #141a33;
}

.feature-text {
  font-size: 0.95rem;
  color: #4a5068;
}
</style>
