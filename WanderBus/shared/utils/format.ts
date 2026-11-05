export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

// "5 Nov 2026" in the Singapore format; empty string when there is no date
export function formatSgDate(value?: string | Date | null) {
    if (!value) return ''
    return new Date(value).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })
}
