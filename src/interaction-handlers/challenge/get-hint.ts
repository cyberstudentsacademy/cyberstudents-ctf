import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from "discord.js";

import colors from "../../constants/colors.js";
import { findOrCreateUser } from "../../functions/findOrCreateUser.js";
import { logToChannel } from "../../functions/logToChannel.js";
import { blacklistCache, prisma } from "../../index.js";
import { BLACKLIST_MESSAGE } from "../../preconditions/blacklist.js";

export class SubmitFlagHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override async parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("challenge-get-hint:")) return this.none();
    if (blacklistCache.has(interaction.user.id)) {
      await interaction.reply({ content: BLACKLIST_MESSAGE, ephemeral: true });
      return this.none();
    }

    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const challengeId = interaction.customId.split(":")[1];

    const challenge = await prisma.challenge.findUnique({
      where: { id: parseInt(challengeId), published: true },
      include: { attemptedChallenges: { include: { challenge: true } } },
    });

    const user = await findOrCreateUser(interaction.user);

    if (!challenge?.hint || !challenge.hintCost) {
      return await interaction.reply({
        content: "This challenge is not currently accepting hint requests.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(colors.violet)
      .setTitle(`Hint for ${challenge.title}`)
      .setDescription(challenge.hint)
      .addFields({ name: "Hint cost", value: `${challenge.hintCost} pts` });

    const attemptedChallenge = challenge.attemptedChallenges.find((attempt) => attempt.userId === user.id);

    if (attemptedChallenge?.solved) {
      embed.setFooter({ text: "This hint was free as you have already solved this challenge." });
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (attemptedChallenge?.challenge.archived) {
      embed.setFooter({ text: "This hint was free as this challenge was part of a previous round." });
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (attemptedChallenge?.usedHint) {
      embed.setFooter({ text: "You have already used a hint for this challenge." });
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (user.points < challenge.hintCost) {
      return await interaction.reply({
        content: `You cannot use a hint as you have insufficient points. You need **${
          challenge.hintCost - user.points
        }** more point(s).`,
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`hint-cancel:${interaction.id}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`hint-confirm:${interaction.id}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
    );

    const msg = await interaction.reply({
      content: `Are you sure you want to use a hint? This will cost **${challenge.hintCost}** points.`,
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const buttonInteraction = await msg
      .awaitMessageComponent({ componentType: ComponentType.Button, time: 390_000 })
      .catch(() => undefined);
    if (!buttonInteraction) return;

    if (buttonInteraction.customId === `hint-cancel:${interaction.id}`) {
      return await buttonInteraction.update({ content: "Hint request cancelled.", components: [] });
    }

    await prisma.user.update({ where: { id: user.id }, data: { points: { decrement: challenge.hintCost } } });
    await prisma.attemptedChallenge.upsert({
      where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
      update: { usedHint: true },
      create: { userId: user.id, challengeId: challenge.id, usedHint: true, solved: false },
    });

    await buttonInteraction.update({ content: "", components: [], embeds: [embed] });

    return await logToChannel(
      "Hint used",
      `${interaction.user} (\`${interaction.user.tag}\`) used a hint on ${challenge.title}.`,
    );
  }
}
