"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSessionParticipant = isSessionParticipant;
const prisma_1 = require("../lib/prisma");
async function isSessionParticipant(sessionId, userId) {
    const participant = await prisma_1.prisma.sessionParticipant.findUnique({
        where: {
            sessionId_userId: {
                sessionId,
                userId,
            },
        },
        select: {
            id: true,
        },
    });
    return Boolean(participant);
}
