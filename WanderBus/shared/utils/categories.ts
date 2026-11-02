export const categories = {
        cafe:   ['amenity=cafe'],
        food:   ['amenity=restaurant', 'amenity=fast_food', 'amenity=food_court'],
        park:   ['leisure=park', 'leisure=garden'],
        museum: ['tourism=museum', 'tourism=gallery'],
        sights: ['tourism=attraction', 'tourism=viewpoint'],
        mall:   ['shop=mall'],
    }

export const placeCategories = {
        food:     ['amenity=restaurant', 'amenity=fast_food', 'amenity=food_court', 'amenity=cafe'],
        nature:   ['leisure=park', 'leisure=garden', 'leisure=nature_reserve', 'tourism=viewpoint'],
        heritage: ['historic=*', 'tourism=museum', 'amenity=place_of_worship'],
        art:      ['tourism=gallery', 'tourism=artwork', 'amenity=arts_centre', 'amenity=theatre', 'amenity=library'],
    }