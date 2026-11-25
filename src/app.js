import express from 'express'
import cors from 'cors'

/** Adds computed status fields so every client gets the same numbers. */
export function withStatus(filter, now = new Date()) {
  const start = new Date(filter.cycle_start_date)
  const due = new Date(start.getTime() + filter.lifespan_days * 86_400_000)
  const daysLeft = Math.ceil((due - now) / 86_400_000)
  return {
    ...filter,
    due_date: due.toISOString(),
    days_left: daysLeft,
    expired: daysLeft <= 0,
  }
}

function parseId(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid filter id' })
    return null
  }
  return id
}

export function createApp(repo, { corsOrigin = '*' } = {}) {
  const app = express()
  const origins = corsOrigin === '*' ? '*' : corsOrigin.split(',').map((s) => s.trim())
  app.use(cors({ origin: origins }))
  app.use(express.json())

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.get('/filters', (_req, res) => {
    res.json({ filters: repo.list().map((f) => withStatus(f)) })
  })

  app.get('/filters/:id', (req, res) => {
    const id = parseId(req, res)
    if (id === null) return
    const filter = repo.get(id)
    if (!filter) return res.status(404).json({ error: 'Filter not found' })
    res.json({ filter: withStatus(filter) })
  })

  // Start a new cycle (body.date optional, defaults to now) and/or change lifespan_days
  app.patch('/filters/:id', (req, res) => {
    const id = parseId(req, res)
    if (id === null) return
    if (!repo.get(id)) return res.status(404).json({ error: 'Filter not found' })

    const { date, lifespan_days: lifespan, restart } = req.body ?? {}

    if (lifespan !== undefined) {
      if (!Number.isInteger(lifespan) || lifespan < 1) {
        return res.status(400).json({ error: 'lifespan_days must be a positive integer' })
      }
      repo.setLifespan(id, lifespan)
    }

    if (date !== undefined || restart === true) {
      const when = date === undefined ? new Date() : new Date(date)
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: 'date must be a valid ISO date' })
      }
      repo.restart(id, when.toISOString())
    }

    if (lifespan === undefined && date === undefined && restart !== true) {
      return res.status(400).json({ error: 'Provide restart: true, date or lifespan_days' })
    }

    res.json({ filter: withStatus(repo.get(id)) })
  })

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(err.status ?? 500).json({ error: err.expose ? err.message : 'Internal server error' })
  })

  return app
}
