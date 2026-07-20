import { PrismaClient } from "@prisma/client";

let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (prismaClient === null) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn("DATABASE_URL environment variable is occupied or missing. LocalDB fallback will automatically preserve data.");
      return null;
    }
    try {
      prismaClient = new PrismaClient({
        datasources: {
          db: {
            url: dbUrl,
          },
        },
      });
    } catch (err) {
      console.error("PrismaClient failed to initialize:", err);
      prismaClient = null;
    }
  }
  return prismaClient;
}
