"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const supabaseAuth_1 = require("../lib/supabaseAuth");
function getBearerToken(headerValue) {
    if (!headerValue) {
        return null;
    }
    const [scheme, token] = headerValue.split(" ");
    if (scheme !== "Bearer" || !token) {
        return null;
    }
    return token.trim();
}
const requireAuth = async (req, res, next) => {
    const token = getBearerToken(req.header("Authorization"));
    if (!token) {
        return res.status(401).json({ message: "Missing bearer token" });
    }
    const user = await (0, supabaseAuth_1.verifyAccessToken)(token);
    if (!user) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
};
exports.requireAuth = requireAuth;
