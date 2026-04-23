"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const connectionManager_1 = require("./websocket/connectionManager");
const telemetryEngine_1 = require("./telemetry/telemetryEngine");
const metricsSnapshotService_1 = require("./telemetry/metricsSnapshotService");
const telemetryEngine_2 = require("./telemetry/telemetryEngine");
const eventBus_1 = require("./event-bus/eventBus");
const eventService_1 = require("./services/eventService");
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const sessionRoutes_1 = __importDefault(require("./routes/sessionRoutes"));
const cors_1 = __importDefault(require("cors"));
const prisma_1 = require("./lib/prisma");
const env_1 = require("./lib/env");
const auth_1 = require("./middleware/auth");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
function isAllowedOrigin(origin) {
    return !origin || env_1.env.corsOrigins.includes(origin);
}
const wss = new ws_1.WebSocketServer({
    server,
    verifyClient: ({ origin }, done) => {
        done(isAllowedOrigin(origin), 403, "Forbidden");
    },
});
(0, connectionManager_1.setupWebSocket)(wss);
(0, telemetryEngine_1.initTelemetry)();
(0, eventBus_1.subscribe)(eventService_1.persistEvent);
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use("/api", auth_1.requireAuth, analyticsRoutes_1.default);
app.use("/api/sessions", auth_1.requireAuth, sessionRoutes_1.default);
const snapshotInterval = setInterval(async () => {
    const sessionIds = (0, telemetryEngine_2.getAllSessionIds)();
    for (const id of sessionIds) {
        await (0, metricsSnapshotService_1.createSnapshot)(id);
    }
}, 60000);
app.get("/health", async (_, res) => {
    try {
        await prisma_1.prisma.$queryRawUnsafe("SELECT 1");
        res.json({ status: "ok", database: "up" });
    }
    catch {
        res.status(503).json({ status: "degraded", database: "down" });
    }
});
async function start() {
    await prisma_1.prisma.$connect();
    server.listen(env_1.env.port, () => {
        console.log(`Server running on port ${env_1.env.port}`);
    });
}
void start().catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
});
function shutdown(signal) {
    console.log(`${signal} received. Shutting down backend...`);
    clearInterval(snapshotInterval);
    wss.close(() => {
        server.close(() => {
            prisma_1.prisma.$disconnect()
                .then(() => process.exit(0))
                .catch((error) => {
                console.error("Failed to disconnect Prisma", error);
                process.exit(1);
            });
        });
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
