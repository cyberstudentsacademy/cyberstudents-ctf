import { Events, Listener } from "@sapphire/framework";

import { logger } from "../../index.js";

export class ContextMenuCommandErrorListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      once: false,
      event: Events.ListenerError,
    });
  }

  public async run(error: Error) {
    logger.error(error);
  }
}
