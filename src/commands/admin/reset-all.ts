import { Buffer } from "node:buffer";

import { ChatInputCommand, Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";

import { filterUser } from "../../functions/filterUser.js";
import { logToChannel } from "../../functions/logToChannel.js";
import { prisma } from "../../index.js";

export class RestartCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "reset-all",
      description: "Reset appropriate data to prepare for a new round",
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions("0"),
      {
        idHints: [],
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("confirm").setLabel("Confirm").setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.reply({
      content: [
        "**Are you sure you want perform the following actions?** This command should be used to conclude a round.",
        "- Archive all challenges (disables new submissions, hints will become free)",
        "- Reset the leaderboard and all players' points (lifetime points will not be affected)",
        "- First Blood roles __will not__ be cleared automatically",
        "An archive of the current leaderboard will be sent in this message.",
      ].join("\n"),
      components: [row],
    });

    const buttonInteraction = await msg
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => filterUser(i, interaction.user),
        time: 8.64e7,
      })
      .catch(() => undefined);

    if (!buttonInteraction) {
      return await msg.edit({ content: "Reset cancelled by timeout.", components: [] });
    }

    if (buttonInteraction.customId === "cancel") {
      return await buttonInteraction.update({ content: "Reset cancelled.", components: [] });
    }

    await buttonInteraction.deferUpdate();

    const usersArchive = await prisma.user.findMany({
      where: { blacklisted: false, points: { gt: 0 } },
      orderBy: { points: "desc" },
    });

    // Archive all challenges
    await prisma.challenge.updateMany({ data: { archived: true } });

    // Reset points and set lifetime points
    await prisma.$transaction(
      usersArchive.map((u) =>
        prisma.user.update({ where: { id: u.id }, data: { points: 0, lifetimePoints: u.points } }),
      ),
    );

    await interaction.editReply({
      content: `Reset complete. ${usersArchive.length} users' points have been reset. An archive of the leaderboard has been attached. First Blood roles may need to be cleared manually.`,
      components: [],
      files: [
        {
          attachment: Buffer.from(JSON.stringify(usersArchive, null, 2), "utf-8"),
          name: `leaderboard_archive_${new Date().toJSON().slice(0, 10)}.json`,
        },
      ],
    });

    return await logToChannel(
      "Reset-all command used",
      `${interaction.user} (\`${interaction.user.tag}\`) has archived all challenges and reset all users' points.`,
    );
  }
}
