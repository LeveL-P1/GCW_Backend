export type SystemEvent = {
  type: "CANVAS_EVENT"
  sessionId: string
  userId: string
  payload: any
  timestamp: number
}

type Subscriber = (event: SystemEvent) => void | Promise<void>

const subscribers: Subscriber[] = []

export function subscribe(handler: Subscriber) {
  subscribers.push(handler)
}

export async function publishEvent(event: SystemEvent) {
  for (const handler of subscribers) {
    try {
      await handler(event)
    } catch (err) {
      console.error("Event handler error:", err)
    }
  }
}
