import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import {
  ActionRowBuilder,
  type ButtonInteraction,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import colors from "../../constants/colors.js";
import { getSolvedUsers } from "../../functions/create/publishMessage.js";
import { findOrCreateUser } from "../../functions/findOrCreateUser.js";
import { logToChannel } from "../../functions/logToChannel.js";
import { sortLeaderboard } from "../../functions/updateLeaderboard.js";
import { blacklistCache, config, logger, prisma } from "../../index.js";
import { BLACKLIST_MESSAGE } from "../../preconditions/blacklist.js";

export class SubmitFlagHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override async parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("challenge-submit:")) return this.none();
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
      include: { attemptedChallenges: true },
    });

    const user = await findOrCreateUser(interaction.user);

    if (!challenge) {
      return await interaction.reply({
        content: "This challenge is not currently accepting submissions.",
        ephemeral: true,
      });
    }

    if (challenge.archived) {
      return await interaction.reply({
        content:
          "This challenge is part of a previous round and is no longer accepting submissions. Refer to the [write-up](https://github.com/cyberstudentsacademy/csd-ctf) to learn more.",
        ephemeral: true,
      });
    }

    const attemptedChallenge = challenge.attemptedChallenges.find((attempt) => attempt.userId === user.id);

    if (attemptedChallenge?.solved) {
      return await interaction.reply({ content: "You have already solved this challenge.", ephemeral: true });
    }

    const cooldownExpiry = user.flagSubmitCooldown?.getTime() ?? 0;
    if (cooldownExpiry >= Date.now()) {
      return await interaction.reply({
        content: `You're on cooldown; you can submit another flag <t:${Math.floor(cooldownExpiry / 1000)}:R>.`,
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`challenge-submit-modal:${interaction.id}`)
      .setTitle("Submit Flag")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("flag")
            .setLabel("Flag")
            .setPlaceholder("Flags are case-sensitive and are in csd{flag} format.")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
    const modalInteraction = await interaction
      .awaitModalSubmit({ filter: (i) => i.customId.endsWith(interaction.id), time: 8.64e7 })
      .catch(() => undefined);
    if (!modalInteraction) return;

    const flag = modalInteraction.fields.getTextInputValue("flag");

    if (!challenge.flags.includes(flag.trim())) {
      await prisma.attemptedChallenge.upsert({
        where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
        update: { totalAttempts: { increment: 1 } },
        create: { userId: user.id, challengeId: challenge.id, solved: false, usedHint: false, totalAttempts: 1 },
      });

      const newCooldown = new Date(Date.now() + 30_000);

      await prisma.user.update({ where: { id: user.id }, data: { flagSubmitCooldown: newCooldown } });

      const incorrectEmbed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle("Sorry, that's not the right flag.")
        .setDescription(
          [
            "Common mistakes when submitting flags:",
            "- Not in `csd{flag}` format",
            "- Capitalization/typos",
            "- Not all steps are completed",
            "- Submitted a fake flag",
            `- Submitted a flag for the wrong challenge (you are solving for **${challenge.title}**)`,
            `\nYou can submit a flag again <t:${Math.floor(newCooldown.getTime() / 1000)}:R>.`,
            "\nIf you're still stuck, try using a hint.",
            "If you believe that this was in error, please contact us through Modmail.",
          ].join("\n"),
        );

      return await modalInteraction.reply({ embeds: [incorrectEmbed], ephemeral: true });
    }

    const isFirstBlood = !(await prisma.attemptedChallenge.count({
      where: { challengeId: challenge.id, solved: true },
    }));

    const newAttempt = await prisma.attemptedChallenge.upsert({
      where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
      update: { solved: true, solvedAt: new Date(), totalAttempts: { increment: 1 } },
      create: {
        userId: user.id,
        challengeId: challenge.id,
        solved: true,
        usedHint: false,
        solvedAt: new Date(),
        totalAttempts: 1,
      },
    });

    const oldUsers = await prisma.user.findMany({
      where: { blacklisted: false, points: { not: 0 } },
      orderBy: { points: "desc" },
    });

    await prisma.user.update({ where: { id: user.id }, data: { points: { increment: challenge.points } } });

    const newUsers = sortLeaderboard(
      await prisma.user.findMany({
        where: { blacklisted: false, points: { not: 0 } },
        include: { attemptedChallenges: true },
        orderBy: { points: "desc" },
      }),
    );

    if (config.firstBloodRoleId?.length && isFirstBlood) {
      try {
        if (!interaction.inCachedGuild()) throw new Error("Not in a cached guild.");

        await interaction.member.roles.add(
          config.firstBloodRoleId,
          `${user.username} was First Blood in ${challenge.title} (#${challenge.id}).`,
        );
      } catch (error) {
        logger.error(`Failed to add First Blood role to user ${interaction.user.id}`, error);
      }
    }

    const newRank = newUsers.findIndex((u) => u.id === user.id) + 1;
    let oldRank: number | null = oldUsers.findIndex((u) => u.id === user.id) + 1;
    if (oldRank === -1) oldRank = null;

    const solvedEmbed = new EmbedBuilder()
      .setColor(colors.success)
      .setTitle(`Congratulations! You have solved ${challenge.title}.`)
      .setDescription(`You have been awarded **${challenge.points}** points for solving this challenge.`)
      .addFields(
        {
          name: "Points & Leaderboard",
          value: [
            `${user.points} ➔ **${user.points + challenge.points}** pts`,
            `${oldRank ? `#${oldRank}` : "N/A"} ➔ #**${newRank}** on the leaderboard`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Attempts & Hints",
          value: [
            `**Attempts**: ${newAttempt.totalAttempts}`,
            `**Hint used**: ${attemptedChallenge?.usedHint ? "Yes" : "No"}`,
          ].join("\n"),
          inline: true,
        },
      );

    const firstBloodEmbed = new EmbedBuilder()
      .setColor(colors.firstBlood)
      .setTitle("🩸 First Blood")
      .setDescription(
        `You were the first to solve **${challenge.title}**! You have been awarded the <@&${config.firstBloodRoleId}> role for this round.`,
      );

    await modalInteraction.reply({
      embeds: config.firstBloodRoleId?.length && isFirstBlood ? [solvedEmbed, firstBloodEmbed] : [solvedEmbed],
      ephemeral: true,
    });

    const solvedAttempts = await prisma.attemptedChallenge.findMany({
      where: { challengeId: challenge.id, solved: true },
      orderBy: [{ solvedAt: "asc" }, { usedHint: "desc" }],
    });

    const challengeEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    challengeEmbed.spliceFields(3, 1, {
      name: `Solved (${solvedAttempts.length})`,
      value: `${getSolvedUsers(solvedAttempts)}`,
      inline: true,
    });

    await interaction.message.edit({ embeds: [challengeEmbed] });

    return await logToChannel(
      "Challenge solved",
      `${interaction.user} (\`${interaction.user.tag}\`) has solved ${challenge.title}.`,
    );
  }
}
