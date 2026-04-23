"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistEvent = persistEvent;
const prisma_1 = require("../lib/prisma");
let eventWriteQueue = Promise.resolve();
async function persistEvent(event) {
    const write = async () => {
        await prisma_1.prisma.eventLog.create({
            data: {
                sessionId: event.sessionId,
                userId: event.userId,
                eventType: event.type,
                payload: event.payload,
                timestamp: new Date(event.timestamp),
            },
        });
    };
    const queuedWrite = eventWriteQueue.then(write);
    eventWriteQueue = queuedWrite.catch((error) => {
        console.error("Failed to persist event", error);
    });
    return queuedWrite;
}
