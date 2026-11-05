import { test, expect } from '@playwright/test'
import { distanceInMetres, walkMinutes } from '../../shared/utils/geo'
import { categories, placeSubcategories, spinToSubcategories } from '../../shared/utils/categories'
import { CATEGORY_INFO, categoryInfo } from '../../app/utils/spinCategories.js'
import { userColor } from '../../app/utils/userColor'
import { ledDots, ledTextWidth, LED_GLYPH_HEIGHT, LED_GLYPH_WIDTH } from '../../app/utils/ledFont.js'
import { placeSections, placeSubcategoryInfo } from '../../app/utils/placeStyles'

test.describe('geo', () => {
  test('distance between the same point is 0', () => {
    expect(distanceInMetres(1.3, 103.8, 1.3, 103.8)).toBe(0)
  })
  test('is symmetric', () => {
    const a = distanceInMetres(1.3, 103.8, 1.35, 103.9)
    const b = distanceInMetres(1.35, 103.9, 1.3, 103.8)
    expect(a).toBeCloseTo(b, 6)
  })
  test('0.01 degrees of latitude is roughly 1.1 km', () => {
    expect(distanceInMetres(1.3, 103.8, 1.31, 103.8)).toBeGreaterThan(1100)
    expect(distanceInMetres(1.3, 103.8, 1.31, 103.8)).toBeLessThan(1120)
  })
  test('Bugis to Orchard is a few kilometres', () => {
    const d = distanceInMetres(1.2990, 103.8559, 1.3040, 103.8319)
    expect(d).toBeGreaterThan(2000)
    expect(d).toBeLessThan(3500)
  })
  test('walkMinutes is at least 1', () => {
    expect(walkMinutes(0)).toBe(1)
    expect(walkMinutes(10)).toBe(1)
  })
  test('walkMinutes grows with distance (1.3 detour at 80 m/min)', () => {
    expect(walkMinutes(800)).toBe(13)
    expect(walkMinutes(1600)).toBe(26)
    expect(walkMinutes(1000)).toBeGreaterThan(walkMinutes(500))
  })
})

test.describe('category tables', () => {
  const spinKeys = Object.keys(categories)
  test('the six spin categories exist', () => {
    expect(spinKeys.sort()).toEqual(['cafe', 'food', 'mall', 'museum', 'park', 'sights'])
  })
  test('every spin category has a label and icon', () => {
    for (const k of spinKeys) {
      expect(CATEGORY_INFO[k as keyof typeof CATEGORY_INFO].label).toBeTruthy()
      expect(CATEGORY_INFO[k as keyof typeof CATEGORY_INFO].icon).toMatch(/^bi-/)
    }
  })
  test('categoryInfo falls back for unknown categories', () => {
    expect(categoryInfo('zoo')).toEqual({ label: 'zoo', icon: 'bi-geo-alt-fill' })
  })
  test('every spin category maps to existing place sub-filters', () => {
    for (const [cat, subs] of Object.entries(spinToSubcategories)) {
      expect(spinKeys).toContain(cat)
      for (const s of subs) expect(placeSubcategories[s]).toBeDefined()
    }
  })
  test('every place sub-filter belongs to a known section with tags', () => {
    for (const [name, sub] of Object.entries(placeSubcategories)) {
      expect(placeSections[sub.section], name).toBeDefined()
      expect(sub.tags.length, name).toBeGreaterThan(0)
      expect(placeSubcategoryInfo[name], name).toBeDefined()
    }
  })
  test('every tag looks like key=value', () => {
    for (const tags of [...Object.values(categories), ...Object.values(placeSubcategories).map((s) => s.tags)])
      for (const t of tags) expect(t).toMatch(/^[a-z_]+=[a-z_*]+$/)
  })
})

test.describe('userColor', () => {
  test('is stable for the same name', () => {
    expect(userColor('Alice')).toBe(userColor('Alice'))
  })
  test('always returns a hex colour, even for empty input', () => {
    for (const n of ['', 'A', 'Zoë', '😀', 'x'.repeat(500)]) expect(userColor(n)).toMatch(/^#[0-9a-f]{6}$/)
  })
  test('different names can get different colours', () => {
    const set = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(userColor))
    expect(set.size).toBeGreaterThan(1)
  })
})

test.describe('LED font', () => {
  test('empty text has zero width', () => expect(ledTextWidth('')).toBe(0))
  test('width is 6 columns per letter minus the last gap', () => {
    expect(ledTextWidth('A')).toBe(LED_GLYPH_WIDTH)
    expect(ledTextWidth('AB')).toBe(2 * (LED_GLYPH_WIDTH + 1) - 1)
  })
  test('dots stay inside the text bounds', () => {
    const w = ledTextWidth('BUS 65')
    for (const [c, r] of ledDots('BUS 65')) {
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThan(w)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(LED_GLYPH_HEIGHT)
    }
  })
  test('a space lights no dots, a letter lights some', () => {
    expect(ledDots(' ')).toHaveLength(0)
    expect(ledDots('A').length).toBeGreaterThan(0)
  })
  test('is case-insensitive', () => {
    expect(ledDots('abc')).toEqual(ledDots('ABC'))
  })
  test('scale multiplies dot count by scale squared', () => {
    expect(ledDots('A', 2)).toHaveLength(ledDots('A', 1).length * 4)
  })
  test('unknown characters are treated as spaces', () => {
    expect(ledDots('§')).toHaveLength(0)
  })
})
