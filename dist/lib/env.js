"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}
function requireOneOfEnv(...names) {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) {
            return value;
        }
    }
    throw new Error(`${names.join(" or ")} is required`);
}
function requirePostgresUrl(name) {
    const value = requireEnv(name);
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new Error(`${name} must be a valid PostgreSQL connection string. Percent-encode special password characters before pasting the URL.`);
    }
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
        throw new Error(`${name} must use the postgres:// or postgresql:// protocol`);
    }
    return value;
}
function parsePort(value) {
    if (!value) {
        return 4000;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("PORT must be a positive integer");
    }
    return parsed;
}
function parseCorsOrigins(value) {
    const origins = (value || "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    if (origins.length === 0) {
        throw new Error("CORS_ORIGIN must include at least one origin");
    }
    return origins;
}
exports.env = {
    databaseUrl: requirePostgresUrl("DATABASE_URL"),
    directUrl: process.env.DIRECT_URL?.trim()
        ? requirePostgresUrl("DIRECT_URL")
        : null,
    supabaseUrl: requireOneOfEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: requireOneOfEnv("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"),
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
};
