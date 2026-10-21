<script setup>
</script>

<template>

    <header class="wb-header">
        <nav class="navbar navbar-expand-md">
            <div class="container-fluid px-4">
                <NuxtLink to="/" class="navbar-brand header-brand">🚌 WanderBus</NuxtLink>

                <button class="navbar-toggler" type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#main-nav"
                        aria-controls="main-nav"
                        aria-expanded="false"
                        aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div id="main-nav" class="collapse navbar-collapse justify-content-end">
                    <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3 gap-md-4 py-3 py-md-0">
                        <NuxtLink to="/home" class="header-link" active-class="active">Home</NuxtLink>
                        <a href="/group" class="header-link">Group_Test</a>
                        <NuxtLink to="/login" class="header-login">Login</NuxtLink>
                        <NuxtLink to="/register" class="btn btn-wb-dark">Register</NuxtLink>
                    </div>
                </div>
            </div>
        </nav>
    </header>

</template>

<style scoped>
.wb-header {
  position: sticky;
  top: 0;
  z-index: 1030;
  background: #fff;
  border-bottom: 1px solid #e3e5ec;
}

.header-brand {
  font-size: 1.3rem;
  font-weight: 800;
  color: #141a33;
}

.header-link {
  color: #4a5068;
  font-weight: 500;
  text-decoration: none;
}

.header-link:hover,
.header-link.active {
  color: #141a33;
}

.header-login {
  color: #0b7a4b;
  font-weight: 600;
  text-decoration: none;
}

.header-login:hover {
  color: #096640;
}

.btn-wb-dark {
  background: #141a33;
  color: #fff;
  border-radius: 50px;
  padding: 8px 22px;
  font-weight: 600;
}

.btn-wb-dark:hover {
  background: #2a3150;
  color: #fff;
}
</style>
