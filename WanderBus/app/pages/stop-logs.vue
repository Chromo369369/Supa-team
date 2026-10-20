<script setup>
import { ref } from 'vue'
import StopLogsSection from '~/components/stop-logs/StopLogsSection.vue'
import ChallengesSection from '~/components/stop-logs/ChallengesSection.vue'

const activeTab = ref('logs')
const currentStopId = ref('99999')
</script>

<template>
    <div class="container py-5">
        <h1 class="text-center mb-4">Stop Logs & Challenges</h1>

        <!--temporary stop selector-->
        <div class="mb-4">
            <label for="stopSelect" class="form-label">
                Testing Bus Stop
            </label>

            <select
                id="stopSelect"
                v-model="currentStopId"
                class="form-select"
            >
                <option value="64009">Stop 64009</option>
                <option value="99999">Stop 99999</option>
            </select>
        </div>

        <ul class="nav nav-pills justify-content-center mb-4">
            <li class="nav-item">
                <button
                    class="nav-link"
                    :class="{ active: activeTab === 'logs' }"
                    @click="activeTab = 'logs'"
                >
                    📝 Stop Logs
                </button>
            </li>

            <li class="nav-item">
                <button
                    class="nav-link"
                    :class="{ active: activeTab === 'challenges' }"
                    @click="activeTab = 'challenges'"
                >
                    🎯 Challenges
                </button>
            </li>
        </ul>

        <!--keeps both components in memory when switching tabs, so newly created logs and challenges won't disappear-->
        <KeepAlive>
            <StopLogsSection
                v-if="activeTab === 'logs'"
                :stop-id="currentStopId"
            />

            <ChallengesSection
                v-else
                :stop-id="currentStopId"
            />
        </KeepAlive>
    </div>
</template>