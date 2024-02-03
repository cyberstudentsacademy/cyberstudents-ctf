import { AttemptedChallenge, Challenge } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, User } from "discord.js";
import { ButtonStyle } from "discord.js";

import colors from "../../constants/colors.js";
import { config } from "../../index.js";

export function getSolvedUsers(solvedAttempts: AttemptedChallenge[]) {
  const str = solvedAttempts
    .slice(0, 3)
    .map((attempt) => `<@${attempt.userId}>`)
    .join(", ");

  if (solvedAttempts.length <= 3) return str;
  return `${str}, and ${solvedAttempts.length - 3} more`;
}

export function generateMessageOptions(
  challenge: Challenge & { attemptedChallenges: AttemptedChallenge[] },
  author: User,
) {
  const embed = new EmbedBuilder()
    .setColor(colors.warning)
    .setTitle(challenge.title)
    .setDescription(challenge.description);

  if (!config.publishAnonymously)
    embed.setFooter({ text: `${config.publishAnonymously ? "" : `Challenge by ${author.tag} • `}#${challenge.id}` });
  if (challenge.files.length) embed.addFields({ name: "Attachments", value: `- ${challenge.files.join("\n- ")}` });

  const solvedAttempts = challenge.attemptedChallenges.filter((attempt) => attempt.solved);

  embed.addFields(
    { name: "Category", value: challenge.category, inline: true },
    { name: "Points", value: challenge.points.toString(), inline: true },
    {
      name: `Solved (${solvedAttempts.length})`,
      value: getSolvedUsers(solvedAttempts) || "*Be the first to solve this challenge!*",
      inline: true,
    },
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`challenge-submit:${challenge.id}`)
      .setLabel("Submit Flag")
      .setStyle(ButtonStyle.Primary),
  );

  if (challenge.hint) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`challenge-get-hint:${challenge.id}`)
        .setLabel(`Get Hint (${challenge.hintCost} pts)`)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // If enabled, make sure interaction-handlers/challenge/see-leaderboard.ts is enabled
  // buttonRow.addComponents(
  //   new ButtonBuilder()
  //     .setCustomId(`challenge-see-leaderboard:${challenge.id}`)
  //     .setLabel(`See Leaderboard`)
  //     .setStyle(ButtonStyle.Secondary),
  // );

  return {
    content: config.challengePingRoleId ? `<@&${config.challengePingRoleId}>` : "",
    embeds: [embed],
    components: [buttonRow],
  };
}
