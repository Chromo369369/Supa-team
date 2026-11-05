import { test, expect } from '@playwright/test'
import { chooseStop } from '../../app/composables/chooseStop'
import { filterByAmens } from '../../app/composables/filterAmens'
import { AMENITIES } from '../helpers/data'

test.describe('chooseStop', () => {
  test('throws when there are no stops', () => {
    expect(() => chooseStop({})).toThrow('No stops found, try a longer travel time')
  })

  test('returns the only stop when there is one', () => {
    const stop = { boardAt: '10001', bus: '65', stops: 1, totalTime: 9 }
    expect(chooseStop({ '10002': stop })).toEqual({ destination: '10002', chosen: stop })
  })

  test('always picks one of the candidates', () => {
    const stops = { a: { boardAt: 'x' }, b: { boardAt: 'x' }, c: { boardAt: 'x' } }
    for (let i = 0; i < 50; i++) expect(Object.keys(stops)).toContain(chooseStop(stops).destination)
  })

  test('can pick different stops over many tries', () => {
    const stops = { a: {}, b: {}, c: {}, d: {} }
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(chooseStop(stops).destination)
    expect(seen.size).toBeGreaterThan(1)
  })
})

test.describe('filterByAmens', () => {
  const stops = { '10002': { x: 1 }, '10003': { x: 2 }, '10004': { x: 3 }, '10001': { x: 0 } }

  test('no preferences returns every stop unchanged', () => {
    expect(filterByAmens([], stops, AMENITIES)).toBe(stops)
  })

  test('keeps only stops that have a preferred category', () => {
    expect(Object.keys(filterByAmens(['museum'], stops, AMENITIES))).toEqual(['10003'])
  })

  test('several preferences match any of them', () => {
    expect(Object.keys(filterByAmens(['museum', 'park'], stops, AMENITIES)).sort()).toEqual(['10003', '10004'])
  })

  test('stops without amenity data are dropped', () => {
    expect(filterByAmens(['cafe'], stops, AMENITIES)['10001']).toBeUndefined()
  })

  test('keeps the original stop details', () => {
    expect(filterByAmens(['museum'], stops, AMENITIES)['10003']).toEqual({ x: 2 })
  })

  test('throws a helpful error when nothing matches', () => {
    expect(() => filterByAmens(['mall'], stops, AMENITIES)).toThrow(/No stops with preferred activities/)
  })
})
