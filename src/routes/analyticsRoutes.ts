import { Router } from "express"
import { prisma } from "../lib/prisma"
import { getSessionMetrics } from "../telemetry/telemetryEngine"
import {
  getMode,
  getPersistedRole,
  hydrateSessionState,
  setMode,
} from "../governance/governanceEngine"
import { broadcast } from "../websocket/connectionManager"
import { isSessionParticipant } from "../middleware/sessionAccess"

const router = Router()

async function ensureParticipantAccess(
  sessionId: string,
  userId: string | undefined,
) {
  if (!userId) {
    return false
  }

  return isSessionParticipant(sessionId, userId)
}

router.get("/metrics/:sessionId", async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user?.sub

  if (!(await ensureParticipantAccess(sessionId, userId))) {
    return res.status(403).json({ message: "You do not have access to this session" })
  }

  // Try DB snapshot first
  const latestSnapshot = await prisma.metricsSnapshot.findFirst({
    where: { sessionId },
    orderBy: { timestamp: "desc" }
  })

  if (latestSnapshot) {
    const liveMetrics = getSessionMetrics(sessionId)

    const perUser = liveMetrics
      ? Array.from(liveMetrics.userEdits.entries()).map(
        ([userId, count]) => ({
          userId,
          edits: count
        })
      )
      : []

    return res.json({
      source: "snapshot",
      data: {
        ...latestSnapshot,
        perUser
      }
    })
  }


  // Fallback to live in-memory metrics
  const liveMetrics = getSessionMetrics(sessionId)

  if (!liveMetrics) {
    return res.status(404).json({ message: "No metrics found" })
  }

  const total = liveMetrics.totalEdits
  const userEntries = Array.from(liveMetrics.userEdits.entries())

  const max = userEntries.length
    ? Math.max(...userEntries.map(([_, count]) => count))
    : 0

  const dominanceRatio = total > 0 ? max / total : 0

  return res.json({
    source: "live",
    data: {
      totalEdits: total,
      activeUsers: liveMetrics.userEdits.size,
      dominanceRatio,
      perUser: userEntries.map(([userId, count]) => ({
        userId,
        edits: count
      }))
    }
  })
})

router.get("/metrics/:sessionId/timeline", async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user?.sub

  if (!(await ensureParticipantAccess(sessionId, userId))) {
    return res.status(403).json({ message: "You do not have access to this session" })
  }

  const events = await prisma.eventLog.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" }
  })

  if (!events.length) {
    return res.json({ data: [] })
  }

  const bucketSizeMs = 60_000
  const buckets = new Map<number, number>()

  for (const event of events) {
    const timeMs = event.timestamp.getTime()
    const bucketStart = Math.floor(timeMs / bucketSizeMs) * bucketSizeMs
    const current = buckets.get(bucketStart) ?? 0
    buckets.set(bucketStart, current + 1)
  }

  const timeline = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, edits]) => ({
      timestamp: new Date(bucketStart).toISOString(),
      edits
    }))

  return res.json({ data: timeline })
})

router.get("/metrics/:sessionId/mode-transitions", async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user?.sub

  if (!(await ensureParticipantAccess(sessionId, userId))) {
    return res.status(403).json({ message: "You do not have access to this session" })
  }

  const snapshots = await prisma.metricsSnapshot.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" }
  })

  if (!snapshots.length) {
    return res.json({ data: [] })
  }

  const transitions: { timestamp: string; mode: string }[] = []
  let lastMode: string | null = null

  for (const snap of snapshots) {
    if (snap.mode === lastMode) {
      continue
    }

    transitions.push({
      timestamp: snap.timestamp.toISOString(),
      mode: snap.mode
    })

    lastMode = snap.mode
  }

  return res.json({ data: transitions })
})

router.get("/mode/:sessionId", async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user?.sub

  if (!(await ensureParticipantAccess(sessionId, userId))) {
    return res.status(403).json({ message: "You do not have access to this session" })
  }

  try {
    const mode = await getMode(sessionId)
    res.json({ mode })
  } catch {
    res.status(500).json({ message: "Failed to load mode" })
  }
})


router.post("/mode/:sessionId", async (req, res) => {
  const { sessionId } = req.params
  const { mode } = req.body

  if (!["FREE", "LOCKED", "DECISION"].includes(mode)) {
    return res.status(400).json({ message: "Invalid mode" })
  }

  const effectiveUserId = req.user?.sub

  if (!effectiveUserId) {
    return res.status(401).json({ message: "Authenticated user is required" })
  }

  if (!(await ensureParticipantAccess(sessionId, effectiveUserId))) {
    return res.status(403).json({ message: "You do not have access to this session" })
  }

  await hydrateSessionState(sessionId)
  const role = await getPersistedRole(sessionId, effectiveUserId)

  if (role !== "FACILITATOR") {
    return res.status(403).json({ message: "Only facilitator can change mode" })
  }

  await setMode(sessionId, mode)

  broadcast(sessionId, {
    type: "MODE_CHANGED",
    sessionId,
    mode
  })

  res.json({ message: "Mode updated", mode })
})

export default router
