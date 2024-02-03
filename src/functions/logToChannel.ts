import { EmbedBuilder } from "discord.js";

import { client, logger } from "../index.js";
import { getLogsChannel } from "./getChannels.js";

export async function logToChannel(title: string, description: string) {
  const channel = getLogsChannel(client);

  if (!channel?.isTextBased()) {
    logger.warn("Logs channel is not a text channel or doesn't exist. Skipping log.");
    return;
  }

  const embed = new EmbedBuilder().setAuthor({ name: title }).setDescription(description);

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error("Error while logging to channel:", error);
  }
}
