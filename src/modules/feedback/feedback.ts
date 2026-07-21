import { prisma } from "@/database/client";

export async function saveFeedback(answerId: string, rating: "UP" | "DOWN", comment?: string) {
  return prisma.feedback.create({ data: { answerId, rating, comment } });
}

export async function listFavorites(type?: string) {
  return prisma.favorite.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function addFavorite(type: string, refId: string, title: string, note?: string) {
  return prisma.favorite.upsert({
    where: { id: `${type}:${refId}` },
    update: { title, note },
    create: { id: `${type}:${refId}`, type, refId, title, note },
  });
}

export async function removeFavorite(id: string) {
  return prisma.favorite.delete({ where: { id } });
}
