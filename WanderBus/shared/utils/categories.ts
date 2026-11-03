// spin filter categories (feature 1, /api/allAmenities)
export const categories = {
        cafe:   ['amenity=cafe'],
        food:   ['amenity=restaurant', 'amenity=fast_food', 'amenity=food_court'],
        park:   ['leisure=park', 'leisure=garden'],
        museum: ['tourism=museum', 'tourism=gallery'],
        sights: ['tourism=attraction', 'tourism=viewpoint'],
        mall:   ['shop=mall'],
    }

// around this stop (feature 2, /api/allPlaces): sub-filters grouped into sections (food, nature, heritage, art, shopping)
// the last matching tag wins like in allAmenities, so the extras go first and the spin ones after in the same order
// as `categories`. That way a place gets the same category here as it does in the spin
export const placeSubcategories: Record<string, { section: string, tags: string[] }> = {
        historic: { section: 'heritage', tags: ['historic=*'] },
        worship:  { section: 'heritage', tags: ['amenity=place_of_worship'] },
        artwork:  { section: 'art',      tags: ['tourism=artwork'] },
        theatre:  { section: 'art',      tags: ['amenity=theatre', 'amenity=arts_centre'] },
        library:  { section: 'art',      tags: ['amenity=library'] },
        cafe:     { section: 'food',     tags: ['amenity=cafe'] },
        food:     { section: 'food',     tags: ['amenity=restaurant', 'amenity=fast_food', 'amenity=food_court'] },
        park:     { section: 'nature',   tags: ['leisure=park', 'leisure=garden'] },
        gallery:  { section: 'art',      tags: ['tourism=gallery'] },
        museum:   { section: 'heritage', tags: ['tourism=museum'] },
        sights:   { section: 'nature',   tags: ['tourism=attraction', 'tourism=viewpoint'] },
        mall:     { section: 'shopping', tags: ['shop=mall'] },
    }

// which sub-filters each spin category covers, so ?prefer=museum ranks museums and galleries first
export const spinToSubcategories: Record<string, string[]> = {
        cafe:   ['cafe'],
        food:   ['food'],
        park:   ['park'],
        museum: ['museum', 'gallery'],
        sights: ['sights'],
        mall:   ['mall'],
    }
