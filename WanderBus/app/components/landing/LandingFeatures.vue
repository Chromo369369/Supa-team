<script setup>
const features = [
    { icon: 'bi-ticket-perforated', title: 'Spin for a stop', text: 'Tell us where you’re starting, how long you have and what you’re in the mood for. You get a random stop you can reach in time.' },
    { icon: 'bi-geo-alt-fill', title: 'Around the stop', text: 'A map of places within 1 km, with photos from other explorers. Post the first photo of a spot to earn Pioneer credit.' },
    { icon: 'bi-signpost-2', title: 'Signposts and challenges', text: 'Leave a signpost with a tip and a rating, or set a challenge for the next explorer. Finish one by posting a photo.' },
    { icon: 'bi-journal-bookmark', title: 'Passport', text: 'Save each trip to your passport, with your photos and notes.' },
    { icon: 'bi-people', title: 'Explore together', text: 'Start a crew, share the join code and wait in one lobby until everyone’s aboard.' }
]
</script>

<template>
    <section class="section-white">
        <div class="container landing-section">
            <div class="row gx-4 gx-lg-5 gy-5">
                <div class="col-lg-4">
                    <h2 class="section-title mb-0">Every stop has something to find.</h2>
                    <p class="hero-text features-intro mb-0">
                        The spin picks the stop. Tips and photos from other explorers show you what’s worth doing once you’re there.
                    </p>
                </div>

                <div class="col-lg-8">
                    <ul class="list-unstyled mb-0 feature-list">
                        <li v-for="feature in features" :key="feature.title" class="feature-row">
                            <span class="feature-icon"><i class="bi" :class="feature.icon" aria-hidden="true"></i></span>
                            <div>
                                <h3 class="feature-title">{{ feature.title }}</h3>
                                <p class="feature-text mb-0">{{ feature.text }}</p>
                            </div>
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

.features-intro {
  margin-top: var(--sp-4);
}

/* Rows are separated by space, not lines */
.feature-list {
  display: grid;
  gap: var(--sp-6);
}

.feature-row {
  display: flex;
  gap: var(--sp-4);
}

.feature-icon {
  flex: none;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--wb-surface-2);
  color: var(--wb-ink);
  font-size: var(--fs-lead);
}

.feature-title {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-lead);
  font-weight: 600;
  color: var(--wb-ink);
}

.feature-text {
  color: var(--wb-text-2);
}
</style>
