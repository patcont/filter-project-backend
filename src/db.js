import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Default catalogue for a typical 4-stage home water system.
// lifespan_days are starting points: adjust them to your filter brand's recommendation.
export const DEFAULT_FILTERS = [
  { name: 'Filtro polipropileno 5 micras 10"x2.75"', stage: 'Sedimentos', lifespan_days: 180 },
  { name: 'Filtro carbón block 10"x2.75"', stage: 'Carbón', lifespan_days: 180 },
  { name: 'Post filtro en línea carbón granular', stage: 'Post filtro', lifespan_days: 365 },
  { name: 'Membrana de osmosis inversa 80 GPD', stage: 'Membrana', lifespan_days: 730 },
]

export function openDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)

  db.exec(`
    CREATE TABLE IF NOT EXISTS filters (
      filter_id        INTEGER PRIMARY KEY,
      filter_name      TEXT NOT NULL UNIQUE,
      stage            TEXT NOT NULL DEFAULT '',
      lifespan_days    INTEGER NOT NULL DEFAULT 180 CHECK (lifespan_days > 0),
      cycle_start_date TEXT NOT NULL
    )
  `)

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM filters').get()
  if (n === 0) {
    const insert = db.prepare(
      'INSERT INTO filters (filter_name, stage, lifespan_days, cycle_start_date) VALUES (?, ?, ?, ?)',
    )
    const now = new Date().toISOString()
    for (const f of DEFAULT_FILTERS) insert.run(f.name, f.stage, f.lifespan_days, now)
  }

  return db
}

export function createRepository(db) {
  const all = db.prepare('SELECT * FROM filters ORDER BY filter_id')
  const byId = db.prepare('SELECT * FROM filters WHERE filter_id = ?')
  const restart = db.prepare('UPDATE filters SET cycle_start_date = ? WHERE filter_id = ?')
  const setLifespan = db.prepare('UPDATE filters SET lifespan_days = ? WHERE filter_id = ?')

  return {
    list: () => all.all(),
    get: (id) => byId.get(id),
    restart: (id, date) => restart.run(date, id).changes,
    setLifespan: (id, days) => setLifespan.run(days, id).changes,
  }
}
