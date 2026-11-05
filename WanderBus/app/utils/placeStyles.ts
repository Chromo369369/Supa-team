// how places look on the "around this stop" page.
// sections (food, nature...) give the colours and the main chips, sub-filters (cafe, park...) give the
// second row of chips and the card badge. Which section a sub-filter is in lives in shared/utils/categories.ts
// colours are the design tokens in main.css (design.md §2.1), icons are Bootstrap Icons class names.
//   colour = pin fill / chip icon, tint = chip background, text = text on the tint, glyph = icon on a filled pin

type CategoryStyle = { label: string, icon: string, colour: string, tint: string, text: string, glyph: string }

export const placeSections: Record<string, CategoryStyle> = {
    food:     { label: 'Food',           icon: 'bi-egg-fried', colour: 'var(--cat-food)',     tint: 'var(--cat-food-tint)',     text: 'var(--cat-food)',     glyph: 'var(--wb-on-ink)' },
    nature:   { label: 'Nature',         icon: 'bi-tree',      colour: 'var(--cat-nature)',   tint: 'var(--cat-nature-tint)',   text: 'var(--cat-nature)',   glyph: 'var(--wb-on-ink)' },
    heritage: { label: 'Heritage',       icon: 'bi-bank',      colour: 'var(--cat-heritage)', tint: 'var(--cat-heritage-tint)', text: 'var(--cat-heritage)', glyph: 'var(--wb-on-ink)' },
    art:      { label: 'Arts & culture', icon: 'bi-palette',   colour: 'var(--cat-art)',      tint: 'var(--cat-art-tint)',      text: 'var(--cat-art)',      glyph: 'var(--wb-on-ink)' },
    shopping: { label: 'Shopping',       icon: 'bi-bag',       colour: 'var(--cat-shopping)', tint: 'var(--cat-shopping-tint)', text: 'var(--cat-shopping)', glyph: 'var(--wb-on-ink)' },
}

export const placeSubcategoryInfo: Record<string, { label: string, icon: string }> = {
    cafe:     { label: 'Cafes',                    icon: 'bi-cup-hot' },
    food:     { label: 'Restaurants & food courts', icon: 'bi-egg-fried' },
    park:     { label: 'Parks & gardens',          icon: 'bi-tree' },
    sights:   { label: 'Sights',                   icon: 'bi-binoculars' },
    museum:   { label: 'Museums',                  icon: 'bi-bank' },
    historic: { label: 'Historic sites',           icon: 'bi-hourglass-split' },
    worship:  { label: 'Places of worship',        icon: 'bi-bell' },
    gallery:  { label: 'Galleries',                icon: 'bi-image' },
    artwork:  { label: 'Public art',               icon: 'bi-palette' },
    theatre:  { label: 'Theatres & arts centres',  icon: 'bi-mask' },
    library:  { label: 'Libraries',                icon: 'bi-book' },
    mall:     { label: 'Malls',                    icon: 'bi-bag' },
}

// sub-filter label + icon, with the colours of its section
export function placeStyle(subcategory: string) {
    const info = placeSubcategoryInfo[subcategory]!
    const section = placeSections[placeSubcategories[subcategory]!.section]!
    return { ...section, label: info.label, icon: info.icon }
}

// feature 3 pins. Square pins on the map so they don't get mixed up with the round place pins.
// amber is a fill only, so the signpost glyph is ink and its text on the tint is amber-ink
export const activityStyles: Record<string, CategoryStyle> = {
    signpost:  { label: 'Signpost',  icon: 'bi-signpost-2', colour: 'var(--wb-amber)',     tint: 'var(--wb-amber-tint)',      text: 'var(--wb-amber-ink)',  glyph: 'var(--wb-ink)' },
    challenge: { label: 'Challenge', icon: 'bi-flag',       colour: 'var(--cat-challenge)', tint: 'var(--cat-challenge-tint)', text: 'var(--cat-challenge)', glyph: 'var(--wb-on-ink)' },
}
