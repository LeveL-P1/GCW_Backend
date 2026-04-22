import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import { setupWebSocket } from "./websocket/connectionManager"
import { initTelemetry } from "./telemetry/telemetryEngine"
import { createSnapshot } from "./telemetry/metricsSnapshotService"
import { getAllSessionIds } from "./telemetry/telemetryEngine"
import { subscribe } from "./event-bus/eventBus"
import { persistEvent } from "./services/eventService"
import analyticsRoutes from "./routes/analyticsRoutes"
import sessionRoutes from "./routes/sessionRoutes"
import cors from "cors"
import { prisma } from "./lib/prisma"
import { env } from "./lib/env"
import { requireAuth } from "./middleware/auth"


const app = express()
const server = http.createServer(app)

function isAllowedOrigin(origin: string | undefined) {
  return !origin || env.corsOrigins.includes(origin)
}

const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }, done) => {
    done(isAllowedOrigin(origin), 403, "Forbidden")
  },
})

setupWebSocket(wss)
initTelemetry()
subscribe(persistEvent)


app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error("Not allowed by CORS"))
  },
  credentials: true,
}))

app.use(express.json())

app.use("/api", requireAuth, analyticsRoutes)
app.use("/api/sessions", requireAuth, sessionRoutes)

const snapshotInterval = setInterval(async () => {
  const sessionIds = getAllSessionIds()
  for (const id of sessionIds) {
    await createSnapshot(id)
  }
}, 60000)

app.get("/health", async (_, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1")
    res.json({ status: "ok", database: "up" })
  } catch {
    res.status(503).json({ status: "degraded", database: "down" })
  }
})

async function start() {
  await prisma.$connect()
  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`)
  })
}

void start().catch((error) => {
  console.error("Failed to start backend", error)
  process.exit(1)
})

function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received. Shutting down backend...`)
  clearInterval(snapshotInterval)

  wss.close(() => {
    server.close(() => {
      prisma.$disconnect()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error("Failed to disconnect Prisma", error)
          process.exit(1)
        })
    })
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

