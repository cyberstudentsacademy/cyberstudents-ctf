import { randomBytes } from "node:crypto";

import { CommandInteraction, EmbedBuilder } from "discord.js";

import colors from "../constants/colors.js";
import { logger } from "../index.js";
import { getLogsChannel } from "./getChannels.js";

export async function handleCommandError(error: Error, interaction: CommandInteraction) {
  try {
    logger.error(`An error occurred in command ${interaction}`, error);

    const reply = interaction.replied && (await interaction.fetchReply().catch(() => undefined));

    const errorCode = randomBytes(3).toString("hex");

    const logEmbed = new EmbedBuilder()
      .setColor(colors.error)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL({ forceStatic: true }),
      })
      .setTitle("New uncaught error")
      .setDescription(
        error.toString().length > 4075 // 4096-21=4075, 21 is the length of text without error.toString()
          ? `\`\`\`js\n${error.toString().slice(0, 4075)}\`\`\`and more...`
          : `\`\`\`js\n${error.toString()}\`\`\``,
      )
      .addFields(
        { name: "Command", value: `\`${interaction}\``, inline: true },
        { name: "User", value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        {
          name: "Context",
          value: reply
            ? `[Message](${reply.url}) in ${interaction.channel}`
            : `${interaction.channel} (${interaction.replied ? "ephemeral/deleted reply" : "no reply"})`,
          inline: true,
        },
        { name: "Error code", value: `\`${errorCode}\`` },
      )
      .setTimestamp();

    await getLogsChannel(interaction.client).send({ embeds: [logEmbed] });

    const replyEmbed = new EmbedBuilder()
      .setColor(colors.error)
      .setDescription(
        `An unexpected error occurred, please try again later. If this problem persists, please contact a staff member.`,
      )
      .setFooter({
        text: `Error code: ${errorCode}`,
      });

    if (!interaction.replied) {
      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    } else if (interaction.deferred) {
      await interaction.editReply({ embeds: [replyEmbed] });
    } else {
      await interaction.followUp({ embeds: [replyEmbed], ephemeral: true });
    }
  } catch (error) {
    logger.error(error);
  }
}
