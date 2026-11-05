// avatar colour picked from a person's name, so the same person always gets the same colour.
// every colour carries white initials at 6.4:1 or better (WCAG AA), and none of them repeats a map category colour
const userColours = ['#a2401c', '#3f6212', '#0f5e8c', '#8a2f6b', '#5b4a9e', '#0b6b5c', '#6b4f12', '#9c2f45']

export function userColor(name: string) {
    let total = 0
    for (let letter of name || '') total += letter.charCodeAt(0)
    return userColours[total % userColours.length]!
}
