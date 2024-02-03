import { ChatInputCommand, Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

import colors from "../../constants/colors.js";

export class InviteCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "help",
      description: "Learn about the CyberStudents CTF and how to use the bot",
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
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

    const embed = new EmbedBuilder()
      .setColor(colors.primary)
      .setAuthor({
        name: "CyberStudents",
        iconURL: "https://cdn.discordapp.com/avatars/1126157327746211840/0cdcb588f96ec9cfc5d4f9685c8987f4.webp",
      })
      .setTitle("Welcome to the CyberStudents CTF")
      .setDescription(
        [
          "The CyberStudents CTF (capture-the-flag) is a competition open to everyone in the Discord server. We hope you to learn something new, refresh your skills, and have fun when competing. There will be daily challenges with varying categories and difficulties, with each round lasting 1-2 months.",
          `You can complete daily challenges in <#1195921115126698054>. Submit flags and get hints by using the button on each challenge message. Gain points by completing challenges and earn a spot on the leaderboard.`,
          `You can view your progress and the leaderboard in <#1196279939813605458>. Top players at the end of each round can receive prizes and a permanent role.`,
          "Good luck!",
        ].join("\n\n"),
      );

    return await interaction.reply({
      embeds: [embed],
      ephemeral: hide,
    });
  }
}
