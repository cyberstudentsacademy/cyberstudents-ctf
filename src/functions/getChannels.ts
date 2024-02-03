import { Client } from "discord.js";

import { config, env } from "../index.js";

export function getChallengeChannel(client: Client) {
  const channel = client.channels.cache.get(config.challengeChannelId);
  if (!channel?.isTextBased()) throw new Error("Challenge channel cannot be found or is not text-based");

  return channel;
}

export function getLogsChannel(client: Client) {
  const channel = client.channels.cache.get(env.LOGS_CHANNEL_ID);
  if (!channel?.isTextBased()) throw new Error("Logs channel cannot be found or is not text-based");

  return channel;
}
