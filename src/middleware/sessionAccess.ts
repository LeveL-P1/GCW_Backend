import { prisma } from "../lib/prisma"

export async function isSessionParticipant(sessionId: string, userId: string) {
  const participant = await prisma.sessionParticipant.findUnique({
    where: {
      sessionId_userId: {
        sessionId,
        userId,
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(participant)
}
