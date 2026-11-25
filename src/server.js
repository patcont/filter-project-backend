import { openDatabase, createRepository } from './db.js'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 5000)
const db = openDatabase(process.env.DB_PATH ?? './data/filters.db')
const app = createApp(createRepository(db), { corsOrigin: process.env.CORS_ORIGIN ?? '*' })

const server = app.listen(port, () => {
  console.log(`💧 Filter API running at http://localhost:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing...`)
    server.close(() => {
      db.close()
      process.exit(0)
    })
  })
}
