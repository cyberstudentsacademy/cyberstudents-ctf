import { User } from "discord.js";

import { prisma } from "../index.js";

export async function findOrCreateUser(user: User) {
  return await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, username: user.username },
    update: {},
  });
}
