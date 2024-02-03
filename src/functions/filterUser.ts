import { MessageComponentInteraction, User } from "discord.js";

export async function filterUser(interaction: MessageComponentInteraction, user: User) {
  if (interaction.user.id !== user.id) {
    await interaction.reply({ content: `This is not your menu!`, ephemeral: true });
    return false;
  }

  return true;
}
