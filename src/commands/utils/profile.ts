import { User } from "@prisma/client";
import { ChatInputCommand, Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, time } from "discord.js";

import colors from "../../constants/colors.js";
import { filterUser } from "../../functions/filterUser.js";
import { prisma } from "../../index.js";

export class InviteCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "profile",
      description: "View your or another player's CyberStudents CTF profile",
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .addUserOption((option) =>
            option.setName("user").setDescription("The user to view the profile of (defaults to yourself)"),
          )
          .addBooleanOption((option) =>
            option.setName("hide").setDescription("Whether to hide the response (default: true)"),
          ),
      {
        idHints: [],
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const hide = interaction.options.getBoolean("hide") ?? true;
    const target = interaction.options.getUser("user") ?? interaction.user;

    const user = await prisma.user.findUnique({
      where: { id: target.id },
      include: { attemptedChallenges: { include: { challenge: true } } },
    });

    if (!user) {
      return await interaction.reply({
        content: "This user has not registered for the CyberStudents CTF yet.",
        ephemeral: true,
      });
    }

    if (user.blacklisted) {
      const blacklistedEmbed = new EmbedBuilder()
        .setColor(colors.error)
        .setAuthor({ name: "Account Closed" })
        .setDescription("This account was closed due to a violation of the CyberStudents CTF and/or server rules.");

      return await interaction.reply({ embeds: [blacklistedEmbed], ephemeral: true });
    }

    if (user.anonymousMode && user.id !== interaction.user.id) {
      const anonymousEmbed = new EmbedBuilder()
        .setColor(colors.secondary)
        .setAuthor({ name: "Anonymous Hacker" })
        .setDescription(
          [
            `- **Discord**: ${target} (\`${target.tag}\`)`,
            `- **Registered**: ${time(user.createdAt, "d")}`,
            "\nThis player has enabled anonymous mode.",
          ].join("\n"),
        );

      return await interaction.reply({ embeds: [anonymousEmbed], ephemeral: hide });
    }

    const solvedChallenges = user.attemptedChallenges.filter((a) => a.solved);

    const users = await prisma.user.findMany({
      where: { points: { gt: 0 } },
      orderBy: { points: "desc" },
      select: { id: true, points: true },
    });
    const rank = users.findIndex((u) => u.id === target.id) + 1;
    const lifetimePoints = user.lifetimePoints > user.points ? user.lifetimePoints : user.points;

    const embed = new EmbedBuilder()
      .setColor(colors.secondary)
      .setAuthor({
        name: user.username,
        iconURL: target.displayAvatarURL({ forceStatic: true }),
      })
      .setDescription(
        [
          `- **Discord**: ${target} (\`${target.tag}\`)`,
          `- **Registered**: ${time(user.createdAt, "d")}`,
          `- **Points**: ${user.points} (${lifetimePoints} across all rounds)`,
          `- **Leaderboard**: #${rank} out of ${users.length} players`,
        ].join("\n"),
      )
      .addFields({
        name: "Challenges",
        value: [
          `- **Attempted**: ${user.attemptedChallenges.length}`,
          `- **Solved**: ${solvedChallenges.length} (${
            Math.floor((solvedChallenges.length / user.attemptedChallenges.length) * 100) || 0
          }% solve rate)`,
          solvedChallenges
            .map(
              (a) =>
                `[${a.challenge.title}](${a.challenge.publishedMessageURL} 'Attempts: ${a.totalAttempts}\nHint used: ${a.usedHint}')`,
            )
            .join(", "),
        ].join("\n"),
        inline: true,
      });

    function generateRows(user: User, anonymousModeEnabled: boolean) {
      if (interaction.user.id !== user.id) return [];

      return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`profile-anonymous-mode:${anonymousModeEnabled}`)
            .setLabel(`Anonymous mode: ${anonymousModeEnabled ? "On" : "Off"}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("profile-sync-username")
            .setLabel(`Sync Username`)
            .setStyle(ButtonStyle.Secondary),
        ),
      ];
    }

    const msg = await interaction.reply({
      embeds: [embed],
      components: generateRows(user, user.anonymousMode),
      ephemeral: hide,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => filterUser(i, interaction.user),
      time: hide ? 890_000 : 8.64e7,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.customId.startsWith("profile-anonymous-mode")) {
        const enabled = buttonInteraction.customId.split(":")[1] === "true";

        await prisma.user.update({ where: { id: user.id }, data: { anonymousMode: !enabled } });

        await buttonInteraction.update({ components: generateRows(user, !enabled) });
        return;
      } else if (buttonInteraction.customId === "profile-sync-username") {
        await prisma.user.update({ where: { id: user.id }, data: { username: target.username } });

        await buttonInteraction.reply({
          content:
            "Synchronized your CyberStudents CTF username with your Discord username. Run the command again to see updated changes.",
          ephemeral: true,
        });
        return;
      }
    });

    collector.on("end", async () => {
      if (collector.endReason !== "time") return;
      await msg.edit({ components: [] }).catch(() => undefined);
    });

    return;
  }
}
