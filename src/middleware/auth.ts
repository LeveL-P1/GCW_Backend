import type { RequestHandler } from "express"
import { verifyAccessToken } from "../lib/supabaseAuth"

function getBearerToken(headerValue: string | undefined) {
  if (!headerValue) {
    return null
  }

  const [scheme, token] = headerValue.split(" ")
  if (scheme !== "Bearer" || !token) {
    return null
  }

  return token.trim()
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = getBearerToken(req.header("Authorization"))

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token" })
  }

  const user = await verifyAccessToken(token)

  if (!user) {
    return res.status(401).json({ message: "Invalid or expired token" })
  }

  req.user = user
  next()
}
