import { test, expect } from '@playwright/test'
import { filterStartingBusStops, filterBusStops } from '../../app/composables/filterStops'
import { BUS_ROUTES, BUS_STOPS, START_PLACE, FAR_PLACE } from '../helpers/data'

test.describe('filterStartingBusStops', () => {
  test('only includes stops within walking range', () => {
    const r = filterStartingBusStops(60, BUS_STOPS, START_PLACE)
    expect(Object.keys(r)).toEqual(['10001'])
  })

  test('walking time is a small positive number of minutes', () => {
    const r = filterStartingBusStops(60, BUS_STOPS, START_PLACE)
    expect(r['10001']).toBeGreaterThanOrEqual(0)
    expect(r['10001']).toBeLessThan(10)
  })

  test('returns nothing when the start is far from every stop', () => {
    const stops = BUS_STOPS.filter((s) => s.BusStopCode !== '99999')
    expect(filterStartingBusStops(60, stops, FAR_PLACE)).toEqual({})
  })

  test('walking range is capped by a 10 minute walk even with long travel time', () => {
    const a = filterStartingBusStops(10, BUS_STOPS, START_PLACE)
    const b = filterStartingBusStops(120, BUS_STOPS, START_PLACE)
    expect(Object.keys(a)).toEqual(Object.keys(b))
  })

  test('a very short travel time shrinks the walking range', () => {
    const near = { ...START_PLACE, LATITUDE: String(1.30743 + 0.005), LONGITUDE: START_PLACE.LONGITUDE }
    expect(Object.keys(filterStartingBusStops(10, BUS_STOPS, near))).toContain('10001')
    expect(Object.keys(filterStartingBusStops(1, BUS_STOPS, near))).not.toContain('10001')
  })

  test('empty bus stop list gives an empty result', () => {
    expect(filterStartingBusStops(30, [], START_PLACE)).toEqual({})
  })
})

test.describe('filterBusStops', () => {
  const starts = { '10001': 1 }
  const arrivals = { '10001': { '65': 5 } }

  test('seeds each starting stop with no bus', () => {
    const r = filterBusStops({}, 60, BUS_ROUTES, starts)
    expect(r['10001']).toMatchObject({ boardAt: '10001', bus: null, stops: 0, totalTime: 1 })
  })

  test('adds stops reachable along the route within the time limit', () => {
    const r = filterBusStops(arrivals, 60, BUS_ROUTES, starts)
    expect(Object.keys(r).sort()).toEqual(['10001', '10002', '10003', '10004'])
  })

  test('excludes a stop whose total time goes over the limit', () => {
    const r = filterBusStops(arrivals, 60, BUS_ROUTES, starts)
    expect(r['10005']).toBeUndefined()
  })

  test('records bus, boarding stop, stop count and time', () => {
    const r = filterBusStops(arrivals, 60, BUS_ROUTES, starts)
    expect(r['10003']).toMatchObject({ boardAt: '10001', bus: '65', stops: 2 })
    expect(r['10003'].totalTime).toBeCloseTo(5 + (4.0 / 15) * 60, 5)
  })

  test('a shorter travel time reaches fewer stops', () => {
    const r = filterBusStops(arrivals, 15, BUS_ROUTES, starts)
    expect(Object.keys(r).sort()).toEqual(['10001', '10002'])
  })

  test('no arrivals means nothing beyond the starting stop', () => {
    const r = filterBusStops({ '10001': {} }, 60, BUS_ROUTES, starts)
    expect(Object.keys(r)).toEqual(['10001'])
  })

  test('stops are never counted from a different bus direction', () => {
    const routes = [
      ...BUS_ROUTES,
      { ServiceNo: '65', Operator: 'SBST', Direction: 2, StopSequence: 1, BusStopCode: '10005', Distance: 0 },
    ]
    const r = filterBusStops(arrivals, 60, routes, starts)
    expect(r['10005']).toBeUndefined()
  })
})
