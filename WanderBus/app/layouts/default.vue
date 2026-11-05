<!-- design navbar, footer to navigate multiple pages -->
<!-- login, register, home -->

<script setup>
import WbToast from '~/components/ui/WbToast.vue'
import WbConfirm from '~/components/ui/WbConfirm.vue'
import AdventureBar from '~/components/ui/AdventureBar.vue'
import AdventureEndDialog from '~/components/ui/AdventureEndDialog.vue'

const { active: adventureActive } = useAdventure()
</script>

<template>
    <div class="app-layout" :class="{ 'has-adventure': adventureActive }">
        <a href="#main" class="skip-link">Skip to content</a>
        <SiteHeader />

        <main id="main" tabindex="-1">
            <slot />
        </main>

        <AdventureBar />

        <SiteFooter />

        <WbToast />
        <WbConfirm />
        <AdventureEndDialog />
    </div>

</template>

<style>
/* While an adventure runs, the AdventureBar pill (64px) floats 16px above the bottom edge of every page.
   It floats over the content, so the page itself is not padded. Lift what else lives at the bottom edge
   clear of it: the landing "Bus cursor" pill, the phone spin dock on /home and the desktop toast stack. */
.app-layout.has-adventure {
  --adventure-pill-h: 64px;
  --adventure-clear: calc(var(--adventure-pill-h) + var(--sp-4) + env(safe-area-inset-bottom, 0px));
}

.app-layout.has-adventure .lcursor-dock {
  bottom: var(--adventure-clear);
  padding-bottom: var(--sp-3);
}

.app-layout.has-adventure .dock {
  bottom: var(--adventure-clear);
  padding-bottom: var(--sp-3);
}

@media (min-width: 768px) {
  .app-layout.has-adventure .wb-toasts {
    bottom: calc(var(--adventure-clear) + var(--sp-3));
  }
}
</style>
