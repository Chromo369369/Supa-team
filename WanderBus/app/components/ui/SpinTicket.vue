<script setup>
import { ref } from 'vue'

const isRevealed = ref(false)

function toggleStub() {
    isRevealed.value = !isRevealed.value
}
</script>

<template>
    <section class="ticket mx-auto">
    <div class="ticket-main">
        <img src="/img/blk55.jpg" class="ticket-img">
        <div class="ticket-info">
            <h4 class="ticket-title">Makan Run</h4>
            <span class="ticket-date">⏱ 19 min travel time</span>
        </div>
    </div>

    <div class="ticket-stub my-auto" @click="toggleStub">
        <div v-if="!isRevealed">
            <h4 class="stub-title text-center fs-5">?</h4>
            <p class="stub-text text-center">Tear here</p>
        </div>

        <div v-else>
            <h4 class="stub-title">Bus 16</h4>
            <p class="stub-text">
                Board at SMU (140m walk) <br><br>
                Get off at Blk 55 (Bukit Merah) <br><br>
                Ride 12 stops, about 19 min <br><br>
            </p>
        </div>
    </div>
    </section>
</template>


<style scoped>
.ticket {
  display: flex;
  max-width: 580px;
  background: #2e4052;
  color: #fff;
  border-radius: 20px;
}

.ticket-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.ticket-img {
  width: 100%;
  aspect-ratio: 16 / 9 ;
  object-fit: cover;
  border-radius: 14px;
}

.ticket-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 16px 10px 6px;
}

.ticket-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.ticket-date {
  font-size: 0.85rem;
  color: #a0a0a5;
}

.ticket-stub {
  position: relative;
  width: 160px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px 20px 18px;
  border-left: 4px dotted #111;
  cursor: pointer;
  user-select: none;
}

.stub-title {
  margin: 0 0 12px;
  font-size: 1.15rem;
  font-weight: 600;
}

.stub-text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
  color: #a0a0a5;
}

.stub-number {
  font-size: 0.85rem;
  color: #a0a0a5;
}
</style>
