import { Events, Listener } from "@sapphire/framework";
import { Message } from "discord.js";

import { handleFlagAutomod } from "../functions/handleFlagAutomod.js";

export class FlagAutomodUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      once: false,
      event: Events.MessageUpdate,
    });
  }

  public async run(_oldMessage: Message, newMessage: Message) {
    await handleFlagAutomod(newMessage);
  }
}
