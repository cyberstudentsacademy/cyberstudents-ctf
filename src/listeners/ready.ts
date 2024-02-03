import { setInterval } from "node:timers";

import { Events, Listener } from "@sapphire/framework";
import { Client } from "discord.js";

import { updateLeaderboard } from "../functions/updateLeaderboard.js";
import { config, logger } from "../index.js";

export class ReadyListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      once: true,
      event: Events.ClientReady,
    });
  }

  public async run(client: Client<true>) {
    logger.info("Bot is ready.");
    logger.info(`Logged in as ${client.user.tag} (${client.user.id}).`);

    setInterval(async () => {
      if (!config.leaderboardMessages?.length) return;

      for (const { channelId, messageId } of config.leaderboardMessages) {
        if (!channelId || !messageId) {
          logger.warn("Detected empty channel/message ID in leaderboardMessages config. Skipping leaderboard update.");
          continue;
        }

        const channel = client.channels.cache.get(channelId);
        if (!channel?.isTextBased()) {
          logger.warn(`Channel ${channelId} is not a text channel or doesn't exist. Skipping leaderboard update.`);
          continue;
        }

        const message = await channel.messages.fetch(messageId);
        if (!message) {
          logger.warn(`Message ${messageId} doesn't exist in channel ${channelId}. Skipping leaderboard update.`);
          continue;
        }

        await updateLeaderboard(message);
      }
    }, 60_000);
  }
}
