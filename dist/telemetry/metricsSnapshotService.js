"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSnapshot = createSnapshot;
const governanceEngine_1 = require("../governance/governanceEngine");
const prisma_1 = require("../lib/prisma");
const telemetryEngine_1 = require("./telemetryEngine");
async function createSnapshot(sessionId) {
    const metrics = (0, telemetryEngine_1.getSessionMetrics)(sessionId);
    if (!metrics)
        return;
    const mode = await (0, governanceEngine_1.getMode)(sessionId);
    const total = metrics.totalEdits;
    const userCounts = Array.from(metrics.userEdits.values());
    const max = userCounts.length > 0 ? Math.max(...userCounts) : 0;
    const dominanceRatio = total > 0 ? max / total : 0;
    await prisma_1.prisma.metricsSnapshot.create({
        data: {
            sessionId,
            totalEdits: total,
            activeUsers: metrics.userEdits.size,
            dominanceRatio,
            mode,
            timestamp: new Date(),
        },
    });
}
