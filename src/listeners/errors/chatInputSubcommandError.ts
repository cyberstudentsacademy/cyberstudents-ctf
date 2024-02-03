import { Listener } from "@sapphire/framework";
import { ChatInputSubcommandErrorPayload, SubcommandPluginEvents } from "@sapphire/plugin-subcommands";

import { handleCommandError } from "../../functions/handleCommandError.js";

export class ChatInputSubcommandErrorListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      once: false,
      event: SubcommandPluginEvents.ChatInputSubcommandError,
    });
  }

  public async run(error: Error, { interaction }: ChatInputSubcommandErrorPayload) {
    await handleCommandError(error, interaction);
  }
}
