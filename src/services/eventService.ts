import { SystemEvent } from "../event-bus/eventBus"
import { prisma } from "../lib/prisma"

let eventWriteQueue = Promise.resolve()

export async function persistEvent(event: SystemEvent) {
  const write = async () => {
    await prisma.eventLog.create({
      data: {
        sessionId: event.sessionId,
        userId: event.userId,
        eventType: event.type,
        payload: event.payload,
        timestamp: new Date(event.timestamp),
      },
    })
  }

  const queuedWrite = eventWriteQueue.then(write)
  eventWriteQueue = queuedWrite.catch((error) => {
    console.error("Failed to persist event", error)
  })

  return queuedWrite
}
