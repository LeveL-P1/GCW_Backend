import { prisma } from "../lib/prisma"

export type Role = "FACILITATOR" | "CONTRIBUTOR" | "OBSERVER"
export type Mode = "FREE" | "LOCKED" | "DECISION"

type SessionState = {
  mode: Mode
  roles: Map<string, Role>
}

const sessions = new Map<string, SessionState>()

function ensureSession(sessionId: string) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      mode: "FREE",
      roles: new Map(),
    })
  }

  return sessions.get(sessionId)!
}

function isMode(value: string | null | undefined): value is Mode {
  return value === "FREE" || value === "LOCKED" || value === "DECISION"
}

function isRole(value: string | null | undefined): value is Role {
  return (
    value === "FACILITATOR" ||
    value === "CONTRIBUTOR" ||
    value === "OBSERVER"
  )
}

export async function hydrateSessionState(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      currentMode: true,
      participants: {
        select: {
          userId: true,
          role: true,
        },
      },
    },
  })

  if (!session) {
    return null
  }

  const state = ensureSession(sessionId)
  state.mode = isMode(session.currentMode) ? session.currentMode : "FREE"
  const persistedRoles: Array<[string, Role]> = []

  for (const participant of session.participants) {
    if (isRole(participant.role)) {
      persistedRoles.push([participant.userId, participant.role])
    }
  }

  state.roles = new Map(persistedRoles)

  return state
}

export function assignRole(sessionId: string, userId: string, role: Role) {
  const state = ensureSession(sessionId)
  state.roles.set(userId, role)
}

export function getRole(sessionId: string, userId: string): Role {
  const state = ensureSession(sessionId)
  return state.roles.get(userId) || "CONTRIBUTOR"
}

export async function getPersistedRole(
  sessionId: string,
  userId: string,
): Promise<Role | null> {
  const participant = await prisma.sessionParticipant.findUnique({
    where: {
      sessionId_userId: {
        sessionId,
        userId,
      },
    },
    select: {
      role: true,
    },
  })

  if (!participant || !isRole(participant.role)) {
    return null
  }

  assignRole(sessionId, userId, participant.role)
  return participant.role
}

export function hasFacilitator(sessionId: string): boolean {
  const state = ensureSession(sessionId)
  return Array.from(state.roles.values()).includes("FACILITATOR")
}

export async function setMode(sessionId: string, mode: Mode) {
  const state = ensureSession(sessionId)
  state.mode = mode

  await prisma.session
    .update({
      where: { id: sessionId },
      data: { currentMode: mode },
    })
    .catch(() => {})
}

export async function getMode(sessionId: string): Promise<Mode> {
  const state = ensureSession(sessionId)

  if (state.roles.size === 0 && state.mode === "FREE") {
    await hydrateSessionState(sessionId)
  }

  return ensureSession(sessionId).mode
}

export async function validateAction(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const state =
    sessions.has(sessionId) && ensureSession(sessionId).roles.size > 0
      ? ensureSession(sessionId)
      : await hydrateSessionState(sessionId)

  if (!state) {
    return false
  }

  const role = state.roles.get(userId) ?? (await getPersistedRole(sessionId, userId))

  if (!role) {
    return false
  }

  if (role === "OBSERVER") {
    return false
  }

  if (state.mode === "LOCKED" && role !== "FACILITATOR") {
    return false
  }

  if (state.mode === "DECISION") {
    return false
  }

  return true
}
