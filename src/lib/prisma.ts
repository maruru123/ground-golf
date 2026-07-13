import { PrismaClient } from "@prisma/client";

// Next.js の開発時ホットリロードで PrismaClient が量産されるのを防ぐシングルトン。
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
