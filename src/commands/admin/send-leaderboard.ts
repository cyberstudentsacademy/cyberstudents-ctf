import { ChatInputCommand, Command } from "@sapphire/framework";
import { ChannelType } from "discord.js";

import { generateMessageOptions } from "../../functions/updateLeaderboard.js";
import { logger, prisma } from "../../index.js";

export class RestartCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "send-leaderboard",
      description: "Send an automatically updating leaderboard to a channel",
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions("0")
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("The channel to send the leaderboard to (defaults to the current channel)")
              .addChannelTypes(ChannelType.GuildText),
          ),
      {
        idHints: [],
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel("channel", false, [ChannelType.GuildText]) ?? interaction.channel;

    if (!channel?.isTextBased()) {
      return await interaction.reply({ content: "The channel must be a text channel.", ephemeral: true });
    }

    const users = await prisma.user.findMany({
      where: { blacklisted: false, points: { gt: 0 } },
      orderBy: { points: "desc" },
    });

    const totalUsers = await prisma.user.count({ where: { blacklisted: false, points: { gt: 0 } } });

    try {
      const msg = await channel.send(generateMessageOptions(users, totalUsers, 1));

      return await interaction.reply({
        content: `Leaderboard sent: <${msg.url}>. Contact the bot owner to ensure the leaderboard gets updated.`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error(error);

      return await interaction.reply({
        content: "The bot was unable to send the message, check if it has permission to send messages in that channel.",
        ephemeral: true,
      });
    }
  }
}
