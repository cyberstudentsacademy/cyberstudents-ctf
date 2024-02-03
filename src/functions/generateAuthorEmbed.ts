import { EmbedBuilder, User } from "discord.js";

import colors from "../constants/colors.js";

export function generateAuthorEmbed(description: string, user: User) {
  return new EmbedBuilder()
    .setColor(colors.primary)
    .setAuthor({
      name: `${user.tag} (${user.id})`,
      iconURL: user.displayAvatarURL({ forceStatic: true }),
    })
    .setDescription(description);
}
