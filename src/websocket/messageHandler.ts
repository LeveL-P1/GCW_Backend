import { joinSession, broadcast } from "./connectionManager"
import { publishEvent } from "../event-bus/eventBus"
import {
  getMode,
  getPersistedRole,
  hydrateSessionState,
  validateAction,
} from "../governance/governanceEngine"
import { verifyAccessToken } from "../lib/supabaseAuth"
import type { SessionSocket } from "./socketState"

export async function handleMessage(ws: SessionSocket, data: any) {
  if (!data || !data.type) {
    ws.send(JSON.stringify({ type: "ERROR", message: "Missing 'type' field" }))
    return
  }

  switch (data.type) {

    case "JOIN_SESSION":
      if (!data.token || !data.sessionId) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Missing token or sessionId" }))
        return
      }

      const authenticatedUser = await verifyAccessToken(data.token)

      if (!authenticatedUser) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Invalid or expired token" }))
        return
      }

      ws.auth = {
        userId: authenticatedUser.sub,
        email: authenticatedUser.email,
        name: authenticatedUser.name,
      }

      await hydrateSessionState(data.sessionId)
      const persistedRole = await getPersistedRole(
        data.sessionId,
        authenticatedUser.sub,
      )

      if (!persistedRole) {
        ws.send(
          JSON.stringify({
            type: "ERROR",
            message: "User is not a participant in this session",
          }),
        )
        return
      }

      joinSession(authenticatedUser.sub, data.sessionId, ws)

      ws.send(
        JSON.stringify({
          type: "SESSION_STATE",
          sessionId: data.sessionId,
          userId: authenticatedUser.sub,
          role: persistedRole,
          mode: await getMode(data.sessionId),
        }),
      )

      break

    case "CANVAS_EVENT":
      if (!ws.auth?.userId || !data.sessionId || !data.payload) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Missing required fields" }))
        return
      }

      if (ws.auth.sessionId !== data.sessionId) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Session mismatch" }))
        return
      }

      const allowed = await validateAction(data.sessionId, ws.auth.userId)

      if (!allowed) {
        return
      }

      void publishEvent({
        type: "CANVAS_EVENT",
        sessionId: data.sessionId,
        userId: ws.auth.userId,
        payload: data.payload,
        timestamp: Date.now(),
      })

      broadcast(data.sessionId, {
        ...data,
        userId: ws.auth.userId,
      })
      break
  }
}
