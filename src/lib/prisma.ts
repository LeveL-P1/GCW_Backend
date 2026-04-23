import { PrismaClient } from "@prisma/client"
import { env } from "./env"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

void env.databaseUrl

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"]
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
