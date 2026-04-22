import { env } from "./env"

export interface AuthenticatedUser {
  sub: string
  email: string
  name: string
}

type SupabaseUserResponse = {
  id?: string
  email?: string
  user_metadata?: {
    name?: string
  }
}

export async function verifyAccessToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabasePublishableKey,
    },
  }).catch(() => null)

  if (!response || !response.ok) {
    return null
  }

  const payload = (await response.json()) as SupabaseUserResponse

  if (!payload.id || !payload.email) {
    return null
  }

  return {
    sub: payload.id,
    email: payload.email,
    name: payload.user_metadata?.name?.trim() || payload.email.split("@")[0],
  }
}
