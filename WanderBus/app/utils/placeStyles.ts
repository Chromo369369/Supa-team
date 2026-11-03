// how places look on the "around this stop" page.
// sections (food, nature...) give the colours and the main chips, sub-filters (cafe, park...) give the
// second row of chips and the card badge. Which section a sub-filter is in lives in shared/utils/categories.ts

export const placeSections: Record<string, { label: string, icon: string, colour: string, tint: string }> = {
    food:     { label: 'Food',           icon: '🍜', colour: '#d1432f', tint: '#fdecea' },
    nature:   { label: 'Nature',         icon: '🌳', colour: '#1e8a4c', tint: '#e6f4ec' },
    heritage: { label: 'Heritage',       icon: '🏛️', colour: '#3b46b8', tint: '#eceefb' },
    art:      { label: 'Arts & culture', icon: '🎨', colour: '#b5307a', tint: '#fbeaf3' },
    shopping: { label: 'Shopping',       icon: '🛍️', colour: '#c27c0e', tint: '#fdf3d7' },
}

export const placeSubcategoryInfo: Record<string, { label: string, icon: string }> = {
    cafe:     { label: 'Cafes',                    icon: '☕' },
    food:     { label: 'Restaurants & food courts', icon: '🍜' },
    park:     { label: 'Parks & gardens',          icon: '🌳' },
    sights:   { label: 'Sights',                   icon: '📸' },
    museum:   { label: 'Museums',                  icon: '🏛️' },
    historic: { label: 'Historic sites',           icon: '🏯' },
    worship:  { label: 'Places of worship',        icon: '🛕' },
    gallery:  { label: 'Galleries',                icon: '🖼️' },
    artwork:  { label: 'Public art',               icon: '🎨' },
    theatre:  { label: 'Theatres & arts centres',  icon: '🎭' },
    library:  { label: 'Libraries',                icon: '📚' },
    mall:     { label: 'Malls',                    icon: '🛍️' },
}

// sub-filter label + icon, with the colours of its section
export function placeStyle(subcategory: string) {
    const info = placeSubcategoryInfo[subcategory]!
    const section = placeSections[placeSubcategories[subcategory]!.section]!
    return { label: info.label, icon: info.icon, colour: section.colour, tint: section.tint }
}

// feature 3 pins. Square pins on the map so they don't get mixed up with the round place pins
export const activityStyles: Record<string, { label: string, icon: string, colour: string, tint: string }> = {
    signpost:  { label: 'Signpost',  icon: '🪧', colour: '#f5a623', tint: '#fdf3d7' },
    challenge: { label: 'Challenge', icon: '🏆', colour: '#2d6fd3', tint: '#e8f0fc' },
}
