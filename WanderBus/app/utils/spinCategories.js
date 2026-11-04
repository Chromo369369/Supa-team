// Labels and emoji for the spin categories in shared/utils/categories.ts (filter chips, nearby places)
export const CATEGORY_INFO = {
    cafe:   { label: 'Cafés',   emoji: '☕' },
    food:   { label: 'Food',    emoji: '🍜' },
    park:   { label: 'Parks',   emoji: '🌳' },
    museum: { label: 'Museums', emoji: '🏛️' },
    sights: { label: 'Sights',  emoji: '📸' },
    mall:   { label: 'Malls',   emoji: '🛍️' }
}

export function categoryInfo(category) {
    return CATEGORY_INFO[category] ?? { label: category, emoji: '📍' }
}
