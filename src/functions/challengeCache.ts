import type { challengeCache } from "../index.js";
import { prisma } from "../index.js";

export async function fetchChallenges(cache: typeof challengeCache) {
  cache.clear();

  for (const challenge of await prisma.challenge.findMany({ orderBy: { editedAt: "desc" } })) {
    cache.set(challenge.id, challenge);
  }
}
