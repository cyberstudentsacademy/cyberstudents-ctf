import { User } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, Message } from "discord.js";

import colors from "../constants/colors.js";
import { prisma } from "../index.js";

export function formatRank(rank: number) {
  const emojiMap: Record<string, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return emojiMap[rank.toString()] ?? `${rank}.`;
}

export function generateMessageOptions(
  users: User[],
  totalUsers: number,
  page: number,
  user?: User | null,
  userIndex?: number | null,
) {
  function generateLine(user: User, index: number) {
    return [
      formatRank(index + 1),
      user.anonymousMode ? "Anonymous Hacker" : escapeMarkdown(user.username),
      ...(user.anonymousMode ? [] : [`<@${user.id}>`]),
      "-",
      `${new Intl.NumberFormat("en-US").format(user.points)} pts`,
    ].join(" ");
  }

  const embed = new EmbedBuilder()
    .setColor(colors.green)
    .setTitle(`CyberStudents CTF Leaderboard - Current Round`)
    .setDescription(
      users.map((user, index) => generateLine(user, index + (page - 1) * 10)).join("\n") ||
        "It's lonely up here… - Godder",
    )
    .setFooter({
      text: [
        ...(user ? [] : ["The leaderboard updates every minute."]),
        `Page ${page}/${Math.ceil(totalUsers / 10) || 1} • ${totalUsers} total players`,
      ].join("\n"),
    });

  if (user && userIndex) {
    embed.addFields({ name: "Your rank", value: generateLine(user, userIndex) });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${user ? "edit-" : ""}leaderboard-previous:${page}`)
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`${user ? "edit-" : ""}leaderboard-next:${page}`)
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= Math.ceil(totalUsers / 10)),
  );

  return { embeds: [embed], components: [row] };
}

export async function updateLeaderboard(message: Message) {
  const users = await prisma.user.findMany({
    where: { blacklisted: false, points: { gt: 0 } },
    orderBy: { points: "desc" },
    take: 10,
  });

  const totalUsers = await prisma.user.count({ where: { blacklisted: false, points: { gt: 0 } } });

  await message.edit(generateMessageOptions(users, totalUsers, 1));
}
