import { AttemptedChallenge, User } from "@prisma/client";
import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle, EmbedBuilder, time } from "discord.js";

import colors from "../../constants/colors.js";
import { findOrCreateUser } from "../../functions/findOrCreateUser.js";
import { formatRank } from "../../functions/updateLeaderboard.js";
import { blacklistCache, prisma } from "../../index.js";
import { BLACKLIST_MESSAGE } from "../../preconditions/blacklist.js";

export class SubmitFlagHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
      enabled: false, // If enabled, make sure the button is added to functions/create/publishMessage.ts
    });
  }

  public override async parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("challenge-see-leaderboard:")) return this.none();
    if (blacklistCache.has(interaction.user.id)) {
      await interaction.reply({ content: BLACKLIST_MESSAGE, ephemeral: true });
      return this.none();
    }

    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const challengeId = interaction.customId.split(":")[1];

    const { title, attemptedChallenges } =
      (await prisma.challenge.findUnique({
        where: { id: parseInt(challengeId) },
        include: {
          attemptedChallenges: {
            include: { user: true },
            where: { solved: true },
            orderBy: { solvedAt: "asc" },
          },
        },
      })) ?? {};

    const user = await findOrCreateUser(interaction.user);

    if (!title || !attemptedChallenges) {
      return await interaction.reply({
        content: "This leaderboard is unavailable for this challenge.",
        ephemeral: true,
      });
    }

    const userAttempt = attemptedChallenges.find((attempt) => attempt.userId === user.id);
    const userIndex = userAttempt ? attemptedChallenges.findIndex((attempt) => attempt.userId === user.id) : -1;

    const generateMessageOptions = (page: number, disableButtons = false) => {
      function generateLine(attempt: AttemptedChallenge & { user: User }, index: number) {
        return [
          formatRank(index + 1),
          attempt.user.anonymousMode ? "Anonymous Hacker" : attempt.user.username,
          ...(attempt.user.anonymousMode ? [] : [`<@${attempt.userId}>`]),
          "-",
          time(attempt.solvedAt!, "f"),
          attempt.usedHint ? "*" : "",
        ].join(" ");
      }

      const embed = new EmbedBuilder()
        .setColor(colors.warning)
        .setTitle(`Leaderboard for ${title}`)
        .setDescription(attemptedChallenges.map(generateLine).join("\n"))
        .setFooter({
          text: [
            "Challenge-specific leaderboards are sorted from oldest to newest.",
            "Players marked with an * used a hint for this challenge.",
            `Page ${page}/${Math.ceil(attemptedChallenges.length / 10)} • ${
              attemptedChallenges.length
            } total solved players`,
          ].join("\n"),
        });

      if (userAttempt && userIndex) {
        embed.addFields({ name: "Your rank", value: generateLine(userAttempt, userIndex) });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`challenge-leaderboard-previous:${challengeId}`)
          .setEmoji("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disableButtons || page <= 1),
        new ButtonBuilder()
          .setCustomId(`challenge-leaderboard-next:${challengeId}`)
          .setEmoji("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disableButtons || page >= Math.ceil(attemptedChallenges.length / 10)),
      );

      return { embeds: [embed], components: [row] };
    };

    let page = 1;
    const msg = await interaction.reply({ ...generateMessageOptions(page), ephemeral: true, fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 890_000 });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.customId.startsWith("challenge-leaderboard-previous:")) page--;
      else if (buttonInteraction.customId.startsWith("challenge-leaderboard-next:")) page++;

      await buttonInteraction.update(generateMessageOptions(page)).catch(() => undefined);
    });

    collector.on("end", async () => {
      if (collector.endReason !== "time") return;
      await msg.edit(generateMessageOptions(page, true)).catch(() => undefined);
    });

    return;
  }
}
