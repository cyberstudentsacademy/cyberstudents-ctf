import { AttemptedChallenge, Challenge, User } from "@prisma/client";
import { ChatInputCommand, Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
} from "discord.js";

import colors from "../../constants/colors.js";
import { filterUser } from "../../functions/filterUser.js";
import { generateAuthorEmbed } from "../../functions/generateAuthorEmbed.js";
import { logToChannel } from "../../functions/logToChannel.js";
import { blacklistCache, env, prisma } from "../../index.js";

export class RestartCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "manage-user",
      description: "Manage a CyberStudents CTF user",
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions("0")
          .addUserOption((option) => option.setName("user").setDescription("The user to manage").setRequired(true))
          .addBooleanOption((option) =>
            option.setName("create").setDescription("Whether to create the user if they don't exist (default: false)"),
          ),
      {
        idHints: [],
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const hide = interaction.options.getBoolean("hide") ?? true;
    const target = interaction.options.getUser("user", true);
    const create = interaction.options.getBoolean("create") ?? false;

    const user = create
      ? await prisma.user.upsert({
          where: { id: target.id },
          create: { id: target.id, username: target.username },
          update: {},
          include: { attemptedChallenges: { include: { challenge: true } } },
        })
      : await prisma.user.findUnique({
          where: { id: target.id },
          include: { attemptedChallenges: { include: { challenge: true } } },
        });

    if (!user) {
      return await interaction.reply({
        content:
          "This user has not registered for the CyberStudents CTF yet. Run the command again with the `create` option enabled if you wish to create the user.",
        ephemeral: true,
      });
    }

    async function generateMessageOptions(
      user: User & { attemptedChallenges: Array<AttemptedChallenge & { challenge: Challenge }> },
    ) {
      const solvedChallenges = user.attemptedChallenges.filter((a) => a.solved);

      const users = await prisma.user.findMany({
        where: { points: { gt: 0 } },
        orderBy: { points: "desc" },
        select: { id: true, points: true },
      });
      const rank = users.findIndex((u) => u.id === target.id) + 1;
      const lifetimePoints = user.lifetimePoints > user.points ? user.lifetimePoints : user.points;

      const embed = new EmbedBuilder()
        .setColor(colors.blue)
        .setAuthor({
          name: user.username,
          iconURL: target.displayAvatarURL({ forceStatic: true }),
        })
        .addFields(
          {
            name: "General",
            value: [
              `- **Discord**: ${target} (\`${target.tag}\`)`,
              `- **Registered**: ${time(user.createdAt, "d")}`,
              `- **Points**: ${user.points} (${lifetimePoints} across all rounds)`,
              `- **Leaderboard**: #${rank} out of ${users.length} players`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "Admin",
            value: [
              `- **Anonymous mode**: ${user.anonymousMode ? "On" : "Off"}`,
              `- **Blacklisted**: ${user.blacklisted ? "Yes ⚠️" : "No"}`,
              `- **Flag submit cooldown**: ${
                user.flagSubmitCooldown ? `Expires ${time(user.flagSubmitCooldown, "R")}` : "N/A"
              }`,
            ].join("\n"),
            inline: true,
          },
          {
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
          },
        );

      const row = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`manage-user-adjust-points:${user.points}`)
            .setLabel(`Adjust points`)
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`manage-user-set-username:${user.username}`)
            .setLabel(`Set username`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`manage-user-anonymous-mode:${user.anonymousMode}`)
            .setLabel(`Anonymous mode: ${user.anonymousMode ? "On" : "Off"}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`manage-user-blacklisted:${user.blacklisted}`)
            .setLabel(`Blacklisted: ${user.blacklisted ? "Yes" : "No"}`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`manage-user-delete`).setLabel(`Delete user`).setStyle(ButtonStyle.Danger),
        ),
      ];

      return { embeds: [embed], components: row };
    }

    const msg = await interaction.reply({ ...(await generateMessageOptions(user)), ephemeral: hide, fetchReply: true });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => filterUser(i, interaction.user),
      time: hide ? 890_000 : 8.64e7,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.customId.startsWith("manage-user-adjust-points")) {
        const oldPoints = buttonInteraction.customId.split(":")[1];

        const modal = new ModalBuilder()
          .setCustomId("new-points")
          .setTitle("Manage user")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("new-points")
                .setLabel("New points")
                .setPlaceholder(oldPoints)
                .setValue(oldPoints)
                .setStyle(TextInputStyle.Short),
            ),
          );

        await buttonInteraction.showModal(modal);

        const modalInteraction = await buttonInteraction
          .awaitModalSubmit({ time: hide ? 390_000 : 8.64e7 })
          .catch(() => undefined);
        if (!modalInteraction) return;

        const newPoints = parseInt(modalInteraction.fields.getTextInputValue("new-points"));

        if (isNaN(newPoints)) {
          await modalInteraction.reply({ content: "Invalid points value.", ephemeral: true });
          return;
        }

        const newUser = await prisma.user.update({
          where: { id: user.id },
          data: { points: newPoints },
          include: { attemptedChallenges: { include: { challenge: true } } },
        });
        await interaction.editReply(await generateMessageOptions(newUser));
        await modalInteraction.reply({ content: `Points have been updated to ${newPoints}.`, ephemeral: true });

        return await logToChannel(
          `Points updated by admin`,
          `${interaction.user} (\`${interaction.user.tag}\`) has updated ${target}'s (\`${target.tag}\`) points to ${newPoints} from ${oldPoints}.`,
        );
      } else if (buttonInteraction.customId.startsWith("manage-user-set-username")) {
        const oldUsername = buttonInteraction.customId.split(":")[1];

        const modal = new ModalBuilder()
          .setCustomId("new-username")
          .setTitle("Manage user")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("new-username")
                .setLabel("New username")
                .setPlaceholder(oldUsername)
                .setValue(oldUsername)
                .setStyle(TextInputStyle.Short),
            ),
          );

        await buttonInteraction.showModal(modal);

        const modalInteraction = await buttonInteraction
          .awaitModalSubmit({ time: hide ? 390_000 : 8.64e7 })
          .catch(() => undefined);
        if (!modalInteraction) return;

        const newUsername = modalInteraction.fields.getTextInputValue("new-username");

        const newUser = await prisma.user.update({
          where: { id: user.id },
          data: { username: newUsername },
          include: { attemptedChallenges: { include: { challenge: true } } },
        });
        await interaction.editReply(await generateMessageOptions(newUser));
        await modalInteraction.reply({ content: `Username has been updated to \`${newUsername}\`.`, ephemeral: true });

        return await logToChannel(
          `Username updated by admin`,
          `${interaction.user} (\`${interaction.user.tag}\`) has updated ${target}'s (\`${target.tag}\`) username to \`${newUsername}\`.`,
        );
      } else if (buttonInteraction.customId.startsWith("manage-user-anonymous-mode")) {
        const enabled = buttonInteraction.customId.split(":")[1] === "true";

        const newUser = await prisma.user.update({
          where: { id: user.id },
          data: { anonymousMode: !enabled },
          include: { attemptedChallenges: { include: { challenge: true } } },
        });

        await buttonInteraction.update(await generateMessageOptions(newUser));

        return await logToChannel(
          `Anonymous mode ${newUser.anonymousMode ? "enabled" : "disabled"} by admin`,
          `${interaction.user} (\`${interaction.user.tag}\`) has ${
            newUser.anonymousMode ? "enabled" : "disabled"
          } anonymous mode for ${target} (\`${target.tag}\`).`,
        );
      } else if (buttonInteraction.customId.startsWith("manage-user-blacklisted")) {
        if (user.id === interaction.user.id) {
          await buttonInteraction.reply({ content: "You cannot blacklist yourself.", ephemeral: true });
          return;
        }

        if (user.id === env.BOT_OWNER_ID) {
          await buttonInteraction.reply({ content: "You cannot blacklist the bot owner.", ephemeral: true });
          return;
        }

        const blacklisted = buttonInteraction.customId.split(":")[1] === "true";

        const newUser = await prisma.user.update({
          where: { id: user.id },
          data: { blacklisted: !blacklisted },
          include: { attemptedChallenges: { include: { challenge: true } } },
        });

        await buttonInteraction.update(await generateMessageOptions(newUser));

        if (newUser.blacklisted) blacklistCache.add(user.id);
        else blacklistCache.delete(user.id);

        return await logToChannel(
          `Blacklist entry ${newUser.blacklisted ? "added" : "removed"}`,
          `${interaction.user} (\`${interaction.user.tag}\`) has ${
            newUser.blacklisted
              ? `added ${target} (\`${target.tag}\`) to`
              : `removed ${target} (\`${target.tag}\`) from`
          } the blacklist.`,
        );
      } else if (buttonInteraction.customId === "manage-user-delete") {
        await prisma.user.delete({ where: { id: user.id } });
        await interaction.editReply({
          embeds: [generateAuthorEmbed(`Deleted user ${target} (\`${target.tag}\`) from CyberStudents CTF.`, target)],
          components: [],
        });

        return await logToChannel(
          "Deleted user",
          `${interaction.user} (\`${interaction.user.tag}\`) has deleted ${target} (\`${target.tag}\`).`,
        );
      }
    });

    collector.on("end", async () => {
      if (collector.endReason !== "time") return;
      await msg.edit({ components: [] }).catch(() => undefined);
    });

    return;
  }
}
