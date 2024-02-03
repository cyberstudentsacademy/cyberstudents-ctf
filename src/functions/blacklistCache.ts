import { prisma } from "../index.js";

export async function fetchBlacklist(cache: Set<string>) {
  cache.clear();

  for (const entry of await prisma.user.findMany({ where: { blacklisted: true } })) {
    cache.add(entry.id);
  }
}
