import { MessageLinkRegex } from "@sapphire/discord-utilities";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageComponentInteraction,
  SnowflakeUtil,
} from "discord.js";

import colors from "../../constants/colors.js";
import { challengeCache } from "../../index.js";

export async function runPublishProtection(
  interaction: MessageComponentInteraction,
  challengeTitle: string,
  published: boolean,
  challengeId?: number,
) {
  const reasons = [];

  const duplicateTitleChallenge = challengeCache.find(
    (c) => c.id !== challengeId && c.title.toLowerCase() === challengeTitle.toLowerCase(),
  );

  if (duplicateTitleChallenge) {
    reasons.push(`A challenge with the same title already exists, #${duplicateTitleChallenge.id}.`);
  }

  const recentChallenge = challengeCache.find((c) => {
    if (c.id === challengeId) return false;
    if (!c.publishedMessageURL) return false;

    const messageId = MessageLinkRegex.exec(c.publishedMessageURL)?.[3];
    if (!messageId) return false;

    // Check if the message was published within the last 24 hours
    return SnowflakeUtil.timestampFrom(messageId) > Date.now() - 8.64e7;
  });

  if (recentChallenge) {
    reasons.push(
      `A challenge was published within the last 24 hours, **${recentChallenge.title}** (#${recentChallenge.id}).`,
    );
  }

  if (published) {
    reasons.push(
      'This challenge has already been published. Publishing a challenge will send another message, potentially causing a double ping. Consider using the "Edit published message" button instead.',
    );
  }

  if (!reasons.length) return interaction;

  const embed = new EmbedBuilder()
    .setColor(colors.orange)
    .setTitle("Accidental publishing protection")
    .setDescription(`- ${reasons.join("\n- ")}\nAre you sure you want to publish this challenge?`);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("publish-protection-cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("publish-protection-confirm").setLabel("Confirm").setStyle(ButtonStyle.Danger),
  );

  const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

  const button = await msg
    .awaitMessageComponent({ componentType: ComponentType.Button, time: 390_000 })
    .catch(() => undefined);

  if (button?.customId === "publish-protection-cancel") {
    await button.update({ content: "Publish cancelled.", embeds: [], components: [] });
    return;
  }

  // Return the new interaction if the user confirmed
  return button;
}
