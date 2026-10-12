<script setup>
</script>

<template>
    <footer class="wb-header">
        <nav class="navbar navbar-expand-md bg-light border-bottom">
            <div class="container-fluid">
                <NuxtLink to="/" class="navbar-brand fw-bold">WanderBus</NuxtLink>

                <button class="navbar-toggler" type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#main-nav"
                        aria-controls="main-nav"
                        aria-expanded="false"
                        aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div id="main-nav" class="collapse navbar-collapse">
                    <ul class="navbar-nav ms-auto gap-md-2">
                        <li class="nav-item"><NuxtLink to="/home" class="nav-link" active-class="active">Home</NuxtLink></li>
                        <li class="nav-item"><NuxtLink to="/login" class="nav-link" active-class="active">Login</NuxtLink></li>
                        <li class="nav-item"><NuxtLink to="/register" class="nav-link" active-class="active">Register</NuxtLink></li>
                    </ul>
                </div>
            </div>
        </nav>
    </footer>
    
</template>