import { ChatInputCommand } from "@sapphire/framework";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from "discord.js";

import colors from "../../constants/colors.js";
import { logToChannel } from "../../functions/logToChannel.js";
import { blacklistCache, env, prisma } from "../../index.js";

export class BlacklistChatInputCommand extends Subcommand {
  public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
    super(context, {
      ...options,
      name: "blacklist",
      description: "Manage the blacklist.",
      subcommands: [
        { name: "add", chatInputRun: "chatInputAdd" },
        { name: "remove", chatInputRun: "chatInputRemove" },
        { name: "list", chatInputRun: "chatInputList" },
      ],
    });
  }

  public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions("0")
          .addSubcommand((command) =>
            command
              .setName("add")
              .setDescription("Add a blacklisted user")
              .addUserOption((option) =>
                option
                  .setName("user")
                  .setDescription("The user to add to the blacklist (IDs are accepted)")
                  .setRequired(true),
              )
              .addBooleanOption((option) =>
                option.setName("hide").setDescription("Whether to hide the reply (default: true)"),
              ),
          )
          .addSubcommand((command) =>
            command
              .setName("remove")
              .setDescription("Remove a blacklisted user")
              .addUserOption((option) =>
                option
                  .setName("user")
                  .setDescription("The user to remove from the blacklist (IDs are accepted)")
                  .setRequired(true),
              )
              .addBooleanOption((option) =>
                option.setName("hide").setDescription("Whether to hide the reply (default: true)"),
              ),
          )
          .addSubcommand((command) =>
            command
              .setName("list")
              .setDescription("List all blacklisted users")
              .addStringOption((option) =>
                option.setName("user").setDescription("The user to see from the blacklist (IDs are accepted)"),
              )
              .addBooleanOption((option) =>
                option.setName("hide").setDescription("Whether to hide the reply (default: true)"),
              ),
          ),
      {
        idHints: [],
      },
    );
  }

  public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction<"cached">) {
    const user = interaction.options.getUser("user", true);
    const hide = interaction.options.getBoolean("hide") ?? true;

    await interaction.deferReply({ ephemeral: hide });

    if (user.id === env.BOT_OWNER_ID) {
      return await interaction.editReply("You cannot blacklist the bot owner.");
    }

    if (user.id === interaction.client.id) {
      return await interaction.editReply("You cannot blacklist the bot.");
    }

    const existingBlacklist = await prisma.user.findUnique({ where: { id: user.id } });
    if (existingBlacklist?.blacklisted) {
      return await interaction.editReply("This user is already blacklisted.");
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: { blacklisted: true },
      create: { id: user.id, username: user.username, blacklisted: true },
    });
    blacklistCache.add(user.id);

    await interaction.editReply(`${user} has been blacklisted.`);

    return await logToChannel(
      "Blacklist entry added",
      `${interaction.user} (\`${interaction.user.tag}\`) has added ${user} to the blacklist.`,
    );
  }

  public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction<"cached">) {
    const user = interaction.options.getUser("user", true);
    const hide = interaction.options.getBoolean("hide") ?? true;

    await interaction.deferReply({ ephemeral: hide });

    const existingBlacklist = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existingBlacklist?.blacklisted) {
      return await interaction.editReply("This user is not blacklisted.");
    }

    await prisma.user.update({ where: { id: user.id }, data: { blacklisted: false } });
    blacklistCache.delete(user.id);

    await interaction.editReply(`${user} has been removed from the blacklist.`);

    return await logToChannel(
      "Blacklist entry removed",
      `${interaction.user} (\`${interaction.user.tag}\`) has removed ${user} from the blacklist.`,
    );
  }

  public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction<"cached">) {
    const user = interaction.options.getUser("user");
    const hide = interaction.options.getBoolean("hide") ?? true;

    let currentPage = 1;
    const totalCount = await prisma.user.count({ where: { id: user?.id, blacklisted: true } });
    const initialEntries = await prisma.user.findMany({
      where: { id: user?.id, blacklisted: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    function generateEmbed(entries: typeof initialEntries) {
      return new EmbedBuilder()
        .setColor(colors.primary)
        .setTitle(`${totalCount} blacklisted users found`)
        .setDescription(
          entries.map((entry) => `- <@${entry.id}> (\`${entry.id}\`)`).join("\n") || "*No blacklisted users found.*",
        )
        .setFooter({
          text: `Page ${currentPage}/${Math.ceil(totalCount / 10)} | ${entries.length}/${totalCount} entries shown`,
        });
    }

    function generateRow(disableAll = false) {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bot_blacklist:back`)
          .setEmoji("⬅️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disableAll || currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`bot_blacklist:forward`)
          .setEmoji("➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disableAll || currentPage === Math.ceil(totalCount / 10)),
      );
    }

    const msg = await interaction.reply({
      embeds: [generateEmbed(initialEntries)],
      components: [generateRow()],
      ephemeral: hide,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      time: 890_000,
      componentType: ComponentType.Button,
    });

    collector.on("collect", async (btnInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        await btnInteraction.reply({ content: "You cannot use this button.", ephemeral: true });
        return;
      }

      btnInteraction.customId.endsWith("forward") ? currentPage++ : currentPage--;

      const entries = await prisma.user.findMany({
        where: { id: user?.id, blacklisted: true },
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * 10,
        take: 10,
      });

      await btnInteraction.update({
        embeds: [generateEmbed(entries)],
        components: [generateRow()],
      });
    });

    collector.on("end", async () => {
      if (collector.endReason !== "time") return;
      await msg.edit({ components: [generateRow(true)] }).catch(() => undefined);
    });

    return;
  }
}
