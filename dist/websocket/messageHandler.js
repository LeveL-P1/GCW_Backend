"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
const connectionManager_1 = require("./connectionManager");
const eventBus_1 = require("../event-bus/eventBus");
const governanceEngine_1 = require("../governance/governanceEngine");
const supabaseAuth_1 = require("../lib/supabaseAuth");
async function handleMessage(ws, data) {
    if (!data || !data.type) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Missing 'type' field" }));
        return;
    }
    switch (data.type) {
        case "JOIN_SESSION":
            if (!data.token || !data.sessionId) {
                ws.send(JSON.stringify({ type: "ERROR", message: "Missing token or sessionId" }));
                return;
            }
            const authenticatedUser = await (0, supabaseAuth_1.verifyAccessToken)(data.token);
            if (!authenticatedUser) {
                ws.send(JSON.stringify({ type: "ERROR", message: "Invalid or expired token" }));
                return;
            }
            ws.auth = {
                userId: authenticatedUser.sub,
                email: authenticatedUser.email,
                name: authenticatedUser.name,
            };
            await (0, governanceEngine_1.hydrateSessionState)(data.sessionId);
            const persistedRole = await (0, governanceEngine_1.getPersistedRole)(data.sessionId, authenticatedUser.sub);
            if (!persistedRole) {
                ws.send(JSON.stringify({
                    type: "ERROR",
                    message: "User is not a participant in this session",
                }));
                return;
            }
            (0, connectionManager_1.joinSession)(authenticatedUser.sub, data.sessionId, ws);
            ws.send(JSON.stringify({
                type: "SESSION_STATE",
                sessionId: data.sessionId,
                userId: authenticatedUser.sub,
                role: persistedRole,
                mode: await (0, governanceEngine_1.getMode)(data.sessionId),
            }));
            break;
        case "CANVAS_EVENT":
            if (!ws.auth?.userId || !data.sessionId || !data.payload) {
                ws.send(JSON.stringify({ type: "ERROR", message: "Missing required fields" }));
                return;
            }
            if (ws.auth.sessionId !== data.sessionId) {
                ws.send(JSON.stringify({ type: "ERROR", message: "Session mismatch" }));
                return;
            }
            const allowed = await (0, governanceEngine_1.validateAction)(data.sessionId, ws.auth.userId);
            if (!allowed) {
                return;
            }
            void (0, eventBus_1.publishEvent)({
                type: "CANVAS_EVENT",
                sessionId: data.sessionId,
                userId: ws.auth.userId,
                payload: data.payload,
                timestamp: Date.now(),
            });
            (0, connectionManager_1.broadcast)(data.sessionId, {
                ...data,
                userId: ws.auth.userId,
            });
            break;
    }
}
