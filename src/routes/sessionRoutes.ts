import { Router } from "express"
import { prisma } from "../lib/prisma"
import { isSessionParticipant } from "../middleware/sessionAccess"

const router = Router()

router.post("/", async (req, res) => {
  const { name } = req.body ?? {}

  try {
    const session = await prisma.session.create({
      data: {
        name: typeof name === "string" && name.trim().length > 0 ? name.trim() : null,
        currentMode: "FREE",
      },
    })

    return res.status(201).json({
      id: session.id,
      name: session.name,
      currentMode: session.currentMode,
      startTime: session.startTime,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create session" })
  }
})

router.get("/:sessionId", async (req, res) => {
  const { sessionId } = req.params
  const userId = req.user?.sub

  if (!userId || !(await isSessionParticipant(sessionId, userId))) {
    return res.status(403).json({ message: "You do not have access to this session" })
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          orderBy: { joinedAt: "asc" },
          select: {
            id: true,
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!session) {
      return res.status(404).json({ message: "Session not found" })
    }

    return res.json({
      id: session.id,
      name: session.name,
      currentMode: session.currentMode,
      startTime: session.startTime,
      endTime: session.endTime,
      participantCount: session.participants.length,
      participants: session.participants.map((participant) => ({
        id: participant.userId,
        participantId: participant.id,
        name: participant.user.name,
        role: participant.role,
        joinedAt: participant.joinedAt,
      })),
    })
  } catch {
    return res.status(500).json({ message: "Failed to load session" })
  }
})

router.post("/:sessionId/join", async (req, res) => {
  const { sessionId } = req.params
  const { name } = req.body ?? {}
  const effectiveUserId = req.user?.sub
  const effectiveEmail = req.user?.email

  try {
    if (!effectiveUserId) {
      return res.status(401).json({ message: "Authenticated user is required" })
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: {
            userId: effectiveUserId,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
    })

    if (!session) {
      return res.status(404).json({ message: "Session not found" })
    }

    if (!name || !effectiveEmail) {
      return res.status(400).json({
        message: "Authenticated email and display name are required",
      })
    }

    const existingRole = session.participants[0]?.role
    const effectiveRole =
      existingRole ??
      (session._count.participants === 0 ? "FACILITATOR" : "CONTRIBUTOR")

    await prisma.user.upsert({
      where: { id: effectiveUserId },
      update: {
        email: effectiveEmail,
        name,
      },
      create: {
        id: effectiveUserId,
        email: effectiveEmail,
        name,
        role: "CONTRIBUTOR",
      },
    })

    const participant = await prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: {
          sessionId,
          userId: effectiveUserId,
        },
      },
      update: {
        role: effectiveRole,
      },
      create: {
        sessionId,
        userId: effectiveUserId,
        role: effectiveRole,
      },
    })

    return res.status(201).json({
      id: participant.id,
      sessionId: participant.sessionId,
      userId: participant.userId,
      sessionName: session.name,
      currentMode: session.currentMode,
      startTime: session.startTime,
      role: effectiveRole,
      joinedAt: participant.joinedAt,
    })
  } catch {
    return res.status(500).json({ message: "Failed to join session" })
  }
})

export default router

