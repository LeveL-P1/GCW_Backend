import { subscribe, SystemEvent } from "../event-bus/eventBus"

type SessionMetrics = {
  totalEdits: number
  userEdits: Map<string, number>
}

const sessionMetrics = new Map<string, SessionMetrics>()

export function initTelemetry() {
  subscribe((event: SystemEvent) => {
    if (event.type !== "CANVAS_EVENT") return

    if (!sessionMetrics.has(event.sessionId)) {
      sessionMetrics.set(event.sessionId, {
        totalEdits: 0,
        userEdits: new Map()
      })
    }

    const metrics = sessionMetrics.get(event.sessionId)!
    metrics.totalEdits++

    const current = metrics.userEdits.get(event.userId) || 0
    metrics.userEdits.set(event.userId, current + 1)
  })
}

export function getSessionMetrics(sessionId: string) {
  return sessionMetrics.get(sessionId)
}

export function getAllSessionIds(): string[] {
  return Array.from(sessionMetrics.keys())
}
