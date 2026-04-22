import type { WebSocket } from "ws"

export interface SessionSocket extends WebSocket {
  auth?: {
    userId: string
    email: string
    name: string
    sessionId?: string
  }
}
