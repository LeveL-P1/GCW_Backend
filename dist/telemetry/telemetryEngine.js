"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTelemetry = initTelemetry;
exports.getSessionMetrics = getSessionMetrics;
exports.getAllSessionIds = getAllSessionIds;
const eventBus_1 = require("../event-bus/eventBus");
const sessionMetrics = new Map();
function initTelemetry() {
    (0, eventBus_1.subscribe)((event) => {
        if (event.type !== "CANVAS_EVENT")
            return;
        if (!sessionMetrics.has(event.sessionId)) {
            sessionMetrics.set(event.sessionId, {
                totalEdits: 0,
                userEdits: new Map()
            });
        }
        const metrics = sessionMetrics.get(event.sessionId);
        metrics.totalEdits++;
        const current = metrics.userEdits.get(event.userId) || 0;
        metrics.userEdits.set(event.userId, current + 1);
    });
}
function getSessionMetrics(sessionId) {
    return sessionMetrics.get(sessionId);
}
function getAllSessionIds() {
    return Array.from(sessionMetrics.keys());
}
