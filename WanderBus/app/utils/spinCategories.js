// Labels and Bootstrap Icons (design.md §2.6) for the spin categories in shared/utils/categories.ts
// (filter chips, nearby places). Render as <i :class="['bi', categoryInfo(c).icon]" aria-hidden="true"></i>.
export const CATEGORY_INFO = {
    cafe:   { label: 'Cafés',   icon: 'bi-cup-hot' },
    food:   { label: 'Food',    icon: 'bi-egg-fried' },
    park:   { label: 'Parks',   icon: 'bi-tree' },
    museum: { label: 'Museums', icon: 'bi-bank' },
    sights: { label: 'Sights',  icon: 'bi-camera' },
    mall:   { label: 'Malls',   icon: 'bi-bag' }
}

export function categoryInfo(category) {
    return CATEGORY_INFO[category] ?? { label: category, icon: 'bi-geo-alt-fill' }
}
