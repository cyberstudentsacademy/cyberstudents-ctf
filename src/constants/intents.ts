import { IntentsBitField } from "discord.js";

export const intents = new IntentsBitField().add([
  IntentsBitField.Flags.Guilds,
  IntentsBitField.Flags.GuildMessages,
  IntentsBitField.Flags.MessageContent,
]);
