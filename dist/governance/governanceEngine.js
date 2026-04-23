"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hydrateSessionState = hydrateSessionState;
exports.assignRole = assignRole;
exports.getRole = getRole;
exports.getPersistedRole = getPersistedRole;
exports.hasFacilitator = hasFacilitator;
exports.setMode = setMode;
exports.getMode = getMode;
exports.validateAction = validateAction;
const prisma_1 = require("../lib/prisma");
const sessions = new Map();
function ensureSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            mode: "FREE",
            roles: new Map(),
        });
    }
    return sessions.get(sessionId);
}
function isMode(value) {
    return value === "FREE" || value === "LOCKED" || value === "DECISION";
}
function isRole(value) {
    return (value === "FACILITATOR" ||
        value === "CONTRIBUTOR" ||
        value === "OBSERVER");
}
async function hydrateSessionState(sessionId) {
    const session = await prisma_1.prisma.session.findUnique({
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
    });
    if (!session) {
        return null;
    }
    const state = ensureSession(sessionId);
    state.mode = isMode(session.currentMode) ? session.currentMode : "FREE";
    const persistedRoles = [];
    for (const participant of session.participants) {
        if (isRole(participant.role)) {
            persistedRoles.push([participant.userId, participant.role]);
        }
    }
    state.roles = new Map(persistedRoles);
    return state;
}
function assignRole(sessionId, userId, role) {
    const state = ensureSession(sessionId);
    state.roles.set(userId, role);
}
function getRole(sessionId, userId) {
    const state = ensureSession(sessionId);
    return state.roles.get(userId) || "CONTRIBUTOR";
}
async function getPersistedRole(sessionId, userId) {
    const participant = await prisma_1.prisma.sessionParticipant.findUnique({
        where: {
            sessionId_userId: {
                sessionId,
                userId,
            },
        },
        select: {
            role: true,
        },
    });
    if (!participant || !isRole(participant.role)) {
        return null;
    }
    assignRole(sessionId, userId, participant.role);
    return participant.role;
}
function hasFacilitator(sessionId) {
    const state = ensureSession(sessionId);
    return Array.from(state.roles.values()).includes("FACILITATOR");
}
async function setMode(sessionId, mode) {
    const state = ensureSession(sessionId);
    state.mode = mode;
    await prisma_1.prisma.session
        .update({
        where: { id: sessionId },
        data: { currentMode: mode },
    })
        .catch(() => { });
}
async function getMode(sessionId) {
    const state = ensureSession(sessionId);
    if (state.roles.size === 0 && state.mode === "FREE") {
        await hydrateSessionState(sessionId);
    }
    return ensureSession(sessionId).mode;
}
async function validateAction(sessionId, userId) {
    const state = sessions.has(sessionId) && ensureSession(sessionId).roles.size > 0
        ? ensureSession(sessionId)
        : await hydrateSessionState(sessionId);
    if (!state) {
        return false;
    }
    const role = state.roles.get(userId) ?? (await getPersistedRole(sessionId, userId));
    if (!role) {
        return false;
    }
    if (role === "OBSERVER") {
        return false;
    }
    if (state.mode === "LOCKED" && role !== "FACILITATOR") {
        return false;
    }
    if (state.mode === "DECISION") {
        return false;
    }
    return true;
}
