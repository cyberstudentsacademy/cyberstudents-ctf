import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import { type ButtonInteraction } from "discord.js";

import { findOrCreateUser } from "../../functions/findOrCreateUser.js";
import { generateMessageOptions } from "../../functions/updateLeaderboard.js";
import { blacklistCache, prisma } from "../../index.js";
import { BLACKLIST_MESSAGE } from "../../preconditions/blacklist.js";

export class SubmitFlagHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override async parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("leaderboard-")) return this.none();
    if (blacklistCache.has(interaction.user.id)) {
      await interaction.reply({ content: BLACKLIST_MESSAGE, ephemeral: true });
      return this.none();
    }

    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    let page = parseInt(interaction.customId.split(":")[1]);
    if (interaction.customId.startsWith("leaderboard-previous:")) page--;
    else if (interaction.customId.startsWith("leaderboard-next:")) page++;

    const users = await prisma.user.findMany({
      where: { blacklisted: false, points: { gt: 0 } },
      orderBy: { points: "desc" },
    });

    const user = await findOrCreateUser(interaction.user);
    const userIndex = users.findIndex((u) => u.id === user.id);

    const msg = await interaction.reply({
      ...generateMessageOptions(users, page, user, userIndex !== -1 ? userIndex : undefined),
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 890_000 });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.customId.startsWith("leaderboard-previous:")) page--;
      else if (buttonInteraction.customId.startsWith("leaderboard-next:")) page++;

      await buttonInteraction
        .update(generateMessageOptions(users, page, user, userIndex !== -1 ? userIndex : undefined))
        .catch(() => undefined);
    });

    collector.on("end", async () => {
      if (collector.endReason !== "time") return;
      await msg
        .edit(generateMessageOptions(users, page, user, userIndex !== -1 ? userIndex : undefined, true))
        .catch(() => undefined);
    });

    return;
  }
}
