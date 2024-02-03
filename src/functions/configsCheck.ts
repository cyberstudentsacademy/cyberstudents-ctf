import process from "node:process";

import { z } from "zod";

import config from "../../config.json" assert { type: "json" };
import { logger } from "../index.js";

const envSchema = z.object({
  DISCORD_TOKEN: z.string(),
  DB_CONNECTION_URL: z.string(),
  BOT_OWNER_ID: z.string(),
  LOGS_CHANNEL_ID: z.string(),
  NODE_ENV: z.enum(["development", "production"]),
});

export function envVarCheck(env: NodeJS.ProcessEnv = process.env) {
  const parsedEnv = envSchema.parse(env);

  logger.info("Environment variables are valid.");

  return parsedEnv;
}

export const configSchema = z.object({
  challengeChannelId: z.string(),
  challengePingRoleId: z.string(),
  staffRoleId: z.string().optional(),
  publishAnonymously: z.boolean(),
  flagAutomod: z.boolean(),
  leaderboardMessages: z
    .array(z.object({ channelId: z.string().optional(), messageId: z.string().optional() }))
    .optional(),
  milestoneRoles: z.record(z.string()),
});

export function configCheck() {
  const parsedConfig = configSchema.parse(config);

  logger.info("Config is valid.");

  return parsedConfig;
}
