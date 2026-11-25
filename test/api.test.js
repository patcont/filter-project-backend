import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, createRepository, DEFAULT_FILTERS } from '../src/db.js'
import { createApp, withStatus } from '../src/app.js'

let server, base

before(async () => {
  const app = createApp(createRepository(openDatabase(':memory:')))
  server = app.listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

const json = async (path, init) => {
  const res = await fetch(base + path, init)
  return { status: res.status, body: await res.json() }
}
const patch = (id, body) =>
  json(`/filters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

test('lists the seeded filters with status', async () => {
  const { status, body } = await json('/filters')
  assert.equal(status, 200)
  assert.equal(body.filters.length, DEFAULT_FILTERS.length)
  assert.equal(body.filters[0].expired, false)
  assert.equal(body.filters[0].days_left, DEFAULT_FILTERS[0].lifespan_days)
})

test('returns 404 / 400 for unknown or invalid ids', async () => {
  assert.equal((await json('/filters/999')).status, 404)
  assert.equal((await json('/filters/abc')).status, 400)
})

test('restarts a cycle and updates lifespan', async () => {
  const old = new Date(Date.now() - 400 * 86_400_000).toISOString()
  let r = await patch(1, { date: old })
  assert.equal(r.body.filter.expired, true)

  r = await patch(1, { restart: true, lifespan_days: 90 })
  assert.equal(r.status, 200)
  assert.equal(r.body.filter.lifespan_days, 90)
  assert.equal(r.body.filter.days_left, 90)
})

test('validates the body', async () => {
  assert.equal((await patch(1, {})).status, 400)
  assert.equal((await patch(1, { date: 'not a date' })).status, 400)
  assert.equal((await patch(1, { lifespan_days: -3 })).status, 400)
})

test('withStatus computes days left', () => {
  const now = new Date('2026-01-11T00:00:00Z')
  const s = withStatus({ cycle_start_date: '2026-01-01T00:00:00Z', lifespan_days: 30 }, now)
  assert.equal(s.days_left, 20)
  assert.equal(s.expired, false)
})
