import { WebSocketServer, WebSocket } from "ws"
import { handleMessage } from "./messageHandler"
import type { SessionSocket } from "./socketState"

interface Client {
  userId: string
  sessionId: string
  socket: WebSocket
}

const sessions = new Map<string, Set<Client>>()

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    const sessionSocket = ws as SessionSocket

    sessionSocket.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString())
        await handleMessage(sessionSocket, data)
      } catch (err) {
        console.error("Invalid WebSocket message:", err)
        sessionSocket.send(JSON.stringify({ type: "ERROR", message: "Invalid message format" }))
      }
    })


    sessionSocket.on("close", () => {
      for (const [sessionId, clients] of sessions.entries()) {
        for (const client of clients) {
          if (client.socket === sessionSocket) {
            clients.delete(client)
          }
        }
        if (clients.size === 0) {
          sessions.delete(sessionId)
        }
      }
    })
  })
}

export function joinSession(userId: string, sessionId: string, socket: WebSocket) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Set())
  }

  const sessionSocket = socket as SessionSocket
  if (sessionSocket.auth) {
    sessionSocket.auth.sessionId = sessionId
  }

  sessions.get(sessionId)!.add({ userId, sessionId, socket })
}

export function broadcast(sessionId: string, message: any) {
  const clients = sessions.get(sessionId)
  if (!clients) return

  for (const client of clients) {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message))
    }
  }
}
