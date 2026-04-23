"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const env_1 = require("./env");
const globalForPrisma = global;
void env_1.env.databaseUrl;
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: ["error"]
    });
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = exports.prisma;
}
