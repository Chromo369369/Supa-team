/**
 * crewCheer: a tiny shared signal for "the ticket was just torn".
 * SpinResults bumps it on tear; SeatMap watches it and has the crew's mascots cheer.
 * Decorative only, so it is a plain module-level counter (it only ever changes in the browser).
 */
import { ref } from 'vue'

export const crewCheer = ref(0)

export function cheerCrew() {
  crewCheer.value++
}
