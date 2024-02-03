import "dotenv/config";

import process from "node:process";
import { setInterval } from "node:timers";

import { Challenge, PrismaClient } from "@prisma/client";
import { SapphireClient } from "@sapphire/framework";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import { Collection, version } from "discord.js";
import { Partials } from "discord.js";
import { ActivityType } from "discord.js";

import { intents } from "./constants/intents.js";
import { makeCache } from "./constants/makeCache.js";
import { fetchBlacklist } from "./functions/blacklistCache.js";
import { fetchChallenges } from "./functions/challengeCache.js";
import { configCheck, envVarCheck } from "./functions/configsCheck.js";
import Logger from "./logger.js";

// Logger
export const logger = new Logger();
logger.info("Logger initialised.");
logger.info(`Using Node.js version ${process.versions.node}`);
logger.info(`Using discord.js version ${version}`);

// Environment variables and configs
export const env = envVarCheck(process.env);
export const config = configCheck();
logger.info(`Node environment: ${env.NODE_ENV}`);

// Dayjs plugins
dayjs.extend(duration);
dayjs.extend(relativeTime);

// Prisma client
export const prisma = new PrismaClient();

try {
  logger.info("Connecting to database...");
  await prisma.$connect();
  logger.info("Connected to database.");
} catch (error) {
  logger.error("Could not connect to database.\n", error);
}

// Sapphire client
export const client = new SapphireClient({
  intents,
  partials: [Partials.Message],
  makeCache,
  presence: {
    activities: [{ type: ActivityType.Custom, name: "custom", state: "OSINT everyday…" }],
  },
});

client.login(env.DISCORD_TOKEN);

// Challenge cache
export const challengeCache = new Collection<number, Challenge>();
fetchChallenges(challengeCache);
setInterval(async () => fetchChallenges(challengeCache), 30_000); // Fallback in case of a change outside of the process

// Blacklist cache
export const blacklistCache = new Set<string>();
fetchBlacklist(blacklistCache);
setInterval(() => fetchBlacklist(blacklistCache), 30_000); // Fallback in case of a change outside of the process

// Catch uncaught errors
process.on("unhandledRejection", (err) => logger.error("Encountered an unhandled promise rejection:", err));
process.on("uncaughtException", (err) => logger.error("Encountered an uncaught exception:", err));
