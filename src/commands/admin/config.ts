import { ChatInputCommand, Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

import { config, env } from "../../index.js";

export class RestartCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "config",
      description: "See JSON values from config.json",
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions("0")
          .addBooleanOption((option) =>
            option.setName("hide").setDescription("Whether to hide the reply (default: true)"),
          ),
      {
        idHints: [],
      },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const hide = interaction.options.getBoolean("hide") ?? true;

    if (interaction.user.id !== env.BOT_OWNER_ID) {
      return interaction.reply({
        content: `Only the bot owner <@${env.BOT_OWNER_ID}> can use this command.`,
        ephemeral: true,
      });
    }

    function generateEmbed(newConfig: typeof config) {
      return new EmbedBuilder()
        .setTitle("Current configuration values")
        .setDescription(`\`\`\`json\n${JSON.stringify(newConfig, null, 2)}\`\`\``);
    }

    // const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    //   new ButtonBuilder().setCustomId("edit").setLabel("Edit").setStyle(ButtonStyle.Secondary),
    // );

    return await interaction.reply({ embeds: [generateEmbed(config)], ephemeral: hide });

    // const collector = msg.createMessageComponentCollector({
    //   componentType: ComponentType.Button,
    //   filter: (i) => filterUser(i, interaction.user),
    //   time: hide ? 390_000 : 8.64e7,
    // });

    // collector.on("collect", async (buttonInteraction) => {
    //   const modal = new ModalBuilder()
    //     .setCustomId("new-config")
    //     .setTitle("Edit configuration values")
    //     .addComponents(
    //       new ActionRowBuilder<TextInputBuilder>().addComponents(
    //         new TextInputBuilder()
    //           .setCustomId("new-config")
    //           .setLabel("New configuration values")
    //           .setValue(JSON.stringify(config, null, 2))
    //           .setStyle(TextInputStyle.Paragraph),
    //       ),
    //     );

    //   await buttonInteraction.showModal(modal);

    //   const modalInteraction = await buttonInteraction
    //     .awaitModalSubmit({ time: hide ? 390_000 : 8.64e7 })
    //     .catch(() => undefined);
    //   if (!modalInteraction) return;

    //   const parsed = configSchema.safeParse(JSON.parse(modalInteraction.fields.getTextInputValue("new-config")));

    //   if (!parsed.success) {
    //     await modalInteraction.reply({
    //       content: `Invalid configuration values: \`\`\`js\n${parsed.error}\`\`\``,
    //       ephemeral: true,
    //     });
    //     return;
    //   }

    //   const formatted = JSON.stringify(parsed.data, null, 2);

    //   await writeFile(join(dirname(import.meta.url), "../../../config.json"), formatted); // config.json in dist/
    //   await writeFile(join(dirname(import.meta.url), "../../../../config.json"), formatted); // config.json in project root

    //   await interaction.editReply({ embeds: [generateEmbed(parsed.data)], components: [row] });
    //   await modalInteraction.reply({ content: "Configuration values have been updated.", ephemeral: true });
    // });

    // collector.on("end", async () => {
    //   if (collector.endReason !== "time") return;
    //   await msg.edit({ components: [] }).catch(() => undefined);
    // });
  }
}
