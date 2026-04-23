"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.joinSession = joinSession;
exports.broadcast = broadcast;
const ws_1 = require("ws");
const messageHandler_1 = require("./messageHandler");
const sessions = new Map();
function setupWebSocket(wss) {
    wss.on("connection", (ws) => {
        const sessionSocket = ws;
        sessionSocket.on("message", async (raw) => {
            try {
                const data = JSON.parse(raw.toString());
                await (0, messageHandler_1.handleMessage)(sessionSocket, data);
            }
            catch (err) {
                console.error("Invalid WebSocket message:", err);
                sessionSocket.send(JSON.stringify({ type: "ERROR", message: "Invalid message format" }));
            }
        });
        sessionSocket.on("close", () => {
            for (const [sessionId, clients] of sessions.entries()) {
                for (const client of clients) {
                    if (client.socket === sessionSocket) {
                        clients.delete(client);
                    }
                }
                if (clients.size === 0) {
                    sessions.delete(sessionId);
                }
            }
        });
    });
}
function joinSession(userId, sessionId, socket) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
    }
    const sessionSocket = socket;
    if (sessionSocket.auth) {
        sessionSocket.auth.sessionId = sessionId;
    }
    sessions.get(sessionId).add({ userId, sessionId, socket });
}
function broadcast(sessionId, message) {
    const clients = sessions.get(sessionId);
    if (!clients)
        return;
    for (const client of clients) {
        if (client.socket.readyState === ws_1.WebSocket.OPEN) {
            client.socket.send(JSON.stringify(message));
        }
    }
}
