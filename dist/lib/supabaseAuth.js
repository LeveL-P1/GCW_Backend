"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = verifyAccessToken;
const env_1 = require("./env");
async function verifyAccessToken(token) {
    const response = await fetch(`${env_1.env.supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: env_1.env.supabasePublishableKey,
        },
    }).catch(() => null);
    if (!response || !response.ok) {
        return null;
    }
    const payload = (await response.json());
    if (!payload.id || !payload.email) {
        return null;
    }
    return {
        sub: payload.id,
        email: payload.email,
        name: payload.user_metadata?.name?.trim() || payload.email.split("@")[0],
    };
}
