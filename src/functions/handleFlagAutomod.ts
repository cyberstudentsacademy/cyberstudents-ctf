import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";

import colors from "../constants/colors.js";
import { challengeCache, config } from "../index.js";
import { getLogsChannel } from "./getChannels.js";

export async function handleFlagAutomod(message: Message) {
  if (!config.flagAutomod) return;
  if (message.author.bot || !message.inGuild()) return;

  if (
    message.member?.permissions.has(PermissionFlagsBits.Administrator) ||
    message.member?.roles.cache.has(config.staffRoleId ?? "")
  )
    return;

  for (const challenge of challengeCache.values()) {
    for (const flag of challenge.flags) {
      if (!message.content.toLowerCase().includes(flag.toLowerCase())) continue;

      await message.delete();

      const text =
        "**Do not publish flags from CyberStudents CTF challenges publicly.** Repeat offences or attempts to bypass this restriction may result in moderation actions. If you are trying to help someone, please guide them instead of giving them the answer.";

      try {
        await message.author.send(text);
      } catch {
        await message.channel.send(`${message.author}: ${text}`);
      }

      const embed = new EmbedBuilder()
        .setColor(colors.orange)
        .setAuthor({ name: "Flag automod triggered!" })
        .setDescription(
          `${message.author} (\`${message.author.tag}\`) sent a flag from **${challenge.title}** (#${challenge.id}) in ${message.channel}. The message has been deleted.`,
        )
        .setTimestamp();

      await getLogsChannel(message.client).send({ embeds: [embed] });
      break;
    }
  }
}
