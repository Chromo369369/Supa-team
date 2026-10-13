<script setup>
</script>

<template>
    <footer class="wb-footer">
        <div class="container py-5">
            <div class="row g-4">
                <div class="col-md-6">
                    <NuxtLink to="/" class="footer-brand">🚌 WanderBus</NuxtLink>
                    <p class="footer-text mt-2 mb-0">
                        Take a random bus. Get off somewhere worth it.
                    </p>
                </div>

                <div class="col-6 col-md-3">
                    <h6 class="footer-heading">Explore</h6>
                    <ul class="footer-links">
                        <li><NuxtLink to="/">Landing</NuxtLink></li>
                        <li><NuxtLink to="/home">Home</NuxtLink></li>
                    </ul>
                </div>

                <div class="col-6 col-md-3">
                    <h6 class="footer-heading">Account</h6>
                    <ul class="footer-links">
                        <li><NuxtLink to="/login">Login</NuxtLink></li>
                        <li><NuxtLink to="/register">Register</NuxtLink></li>
                    </ul>
                </div>
            </div>

            <div class="footer-bottom mt-4 pt-3">
                © 2026 WanderBus - WAD2 G6T3
            </div>
        </div>
    </footer>
</template>

<style scoped>
.wb-footer {
  background: #141a33;
  color: #c9ccd6;
}

.footer-brand {
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  text-decoration: none;
}

.footer-text {
  font-size: 0.9rem;
}

.footer-heading {
  color: #f5a623;
  font-weight: 700;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links li {
  margin-top: 8px;
}

.footer-links a {
  color: #c9ccd6;
  text-decoration: none;
}

.footer-links a:hover {
  color: #fff;
}

.footer-bottom {
  border-top: 1px solid #2a3150;
  font-size: 0.8rem;
  color: #6b7085;
}
</style>
