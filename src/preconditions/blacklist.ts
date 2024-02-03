import { AllFlowsPrecondition } from "@sapphire/framework";
import { ChatInputCommandInteraction, ContextMenuCommandInteraction } from "discord.js";

import { blacklistCache } from "../index.js";

export const BLACKLIST_MESSAGE =
  "You have been blacklisted from using the bot. Please contact a staff member if you have any questions." as const;

export class BotBlacklistPrecondition extends AllFlowsPrecondition {
  public constructor(context: AllFlowsPrecondition.LoaderContext, options: AllFlowsPrecondition.Options) {
    super(context, {
      ...options,
      position: 15,
    });
  }

  private async checkForBlacklist(interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction) {
    if (!blacklistCache.has(interaction.user.id)) return this.ok();

    await interaction.reply({ content: BLACKLIST_MESSAGE, ephemeral: true });
    return this.error();
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    return await this.checkForBlacklist(interaction);
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return await this.checkForBlacklist(interaction);
  }

  public override messageRun() {
    return this.ok();
  }
}
