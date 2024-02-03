import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

import colors from "../../constants/colors.js";
import { challengeCache, prisma } from "../../index.js";
import { filterUser } from "../filterUser.js";
import { generateAuthorEmbed } from "../generateAuthorEmbed.js";
import { getChallengeChannel } from "../getChannels.js";
import { filesModal, hintsModal, mainFieldsModal } from "./modalBuilders.js";
import { generateMessageOptions } from "./publishMessage.js";

export type ChallengeWizardOptions = {
  title: string;
  category: string;
  points: number;
  flags: string[];
  hint?: string | null; // null to account for database result
  hintCost?: number | null; // ^^ ditto
  description: string;
  files: string[];
  published: boolean;
  archived: boolean;
};

export async function handleChallengeWizard(
  { title, category, points, flags, hint, hintCost, description, files, published, archived }: ChallengeWizardOptions,
  interaction: ChatInputCommandInteraction,
  existingChallengeId?: number,
) {
  function generateEmbed() {
    return new EmbedBuilder()
      .setColor(published ? colors.success : existingChallengeId ? colors.orange : colors.warning)
      .setTitle(`${existingChallengeId ? "Edit a" : "Create a new"} challenge`)
      .setDescription(
        [
          `- **Title**: ${title || "*None*"}`,
          `- **Category**: ${category || "*None*"}`,
          `- **Points**: ${points || "*None*"}`,
          `- **Hint cost**: ${hintCost || "*None*"}`,
        ].join("\n"),
      )
      .setFields(
        { name: "Description", value: description || "*No description set*" },
        { name: "Attachments", value: files.length ? `- ${files.join("\n- ")}` : "*No attachments set*" },
        { name: "Flags", value: flags.length ? `- ${flags.join("\n- ")}` : "*No flags set*" },
        { name: "Hint", value: hint || "*No hint set*" },
      )
      .setFooter({
        text: `Changes are not saved automatically.${
          existingChallengeId ? ` Editing draft #${existingChallengeId}.` : ""
        }`,
      });
  }

  function generateRows() {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("edit-main-fields").setLabel("Edit main fields").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("edit-files").setLabel("Edit attachments").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("edit-hint").setLabel("Edit hint").setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("delete").setLabel("Delete").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("discard").setLabel("Discard changes").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("archive")
          .setLabel(archived ? "Unarchive" : "Archive")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("save-as-draft")
          .setLabel(published ? "Unpublish & save" : "Save as draft")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("publish")
          .setLabel(published ? "Publish again" : "Publish")
          .setStyle(ButtonStyle.Primary),
      ),
    ];
  }

  const message = await interaction.reply({
    embeds: [generateEmbed()],
    components: generateRows(),
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    filter: (i) => filterUser(i, interaction.user),
    time: 8.64e7,
  });

  collector.on("collect", async (button) => {
    switch (button.customId) {
      case "edit-main-fields": {
        button.showModal(mainFieldsModal(button.id, title, category, points, description, flags));
        const modalInteraction = await button
          .awaitModalSubmit({ time: 8.64e7, filter: (i) => i.customId.endsWith(button.id) })
          .catch(() => undefined);
        if (!modalInteraction) return;

        const newPoints = modalInteraction?.fields.getTextInputValue("points");

        if (isNaN(parseInt(newPoints)) || parseInt(newPoints) < 0) {
          await modalInteraction.reply({
            content: `Points must be zero or a positive number, but received \`${newPoints}\`.`,
            ephemeral: true,
          });
          return;
        }

        title = modalInteraction.fields.getTextInputValue("title").trim();
        category = modalInteraction.fields.getTextInputValue("category").trim();
        points = parseInt(newPoints);
        description = modalInteraction.fields.getTextInputValue("description").trim();
        flags = modalInteraction.fields
          .getTextInputValue("flags")
          .split("\n")
          .map((file) => file.trim())
          .filter(Boolean);

        await modalInteraction.reply({ content: "Main fields have been updated.", ephemeral: true });
        await interaction.editReply({ embeds: [generateEmbed()] });
        break;
      }

      case "edit-hint": {
        button.showModal(hintsModal(button.id, hint, hintCost));
        const modalInteraction = await button
          .awaitModalSubmit({ time: 8.64e7, filter: (i) => i.customId.endsWith(button.id) })
          .catch(() => undefined);
        if (!modalInteraction) return;

        const newHintCost = modalInteraction.fields.getTextInputValue("hint-cost");
        if (newHintCost && (isNaN(parseInt(newHintCost)) || parseInt(newHintCost) < 0)) {
          await modalInteraction.reply({
            content: `Hint cost must be zero or a positive number, but received \`${newHintCost}\`.`,
            ephemeral: true,
          });
          return;
        }

        hint = modalInteraction.fields.getTextInputValue("hint").trim();
        hintCost = newHintCost ? parseInt(newHintCost) : undefined;

        await modalInteraction.reply({ content: "Hints have been updated.", ephemeral: true });
        await interaction.editReply({ embeds: [generateEmbed()] });
        break;
      }

      case "edit-files": {
        button.showModal(filesModal(button.id, files));
        const modalInteraction = await button
          .awaitModalSubmit({ time: 8.64e7, filter: (i) => i.customId.endsWith(button.id) })
          .catch(() => undefined);
        if (!modalInteraction) return;

        files = modalInteraction.fields
          .getTextInputValue("files")
          .split("\n")
          .map((file) => file.trim())
          .filter(Boolean);

        await modalInteraction?.reply({ content: "Files have been updated.", ephemeral: true });
        await interaction.editReply({ embeds: [generateEmbed()] });
        break;
      }

      case "delete": {
        if (!existingChallengeId) {
          await button.reply({
            content: "This challenge hasn't been saved. Did you mean to discard changes?",
            ephemeral: true,
          });
          return;
        }

        await prisma.challenge.delete({ where: { id: existingChallengeId } });
        challengeCache.delete(existingChallengeId);

        await button.update({
          embeds: [generateAuthorEmbed(`Deleted challenge #${existingChallengeId}`, interaction.user)],
          components: [],
        });
        collector.stop();
        break;
      }

      case "discard": {
        await button.update({ embeds: [generateAuthorEmbed("Discarded changes", interaction.user)], components: [] });
        collector.stop();
        break;
      }

      case "archive": {
        if (!existingChallengeId) {
          await button.reply({
            content: "This challenge hasn't been saved. Did you mean to save or publish first?",
            ephemeral: true,
          });
          return;
        }

        await prisma.challenge.update({
          where: { id: existingChallengeId },
          data: { archived: !archived },
        });

        archived = !archived;

        await interaction.editReply({ embeds: [generateEmbed()], components: generateRows() });
        await button.reply({
          content: `This challenge has been ${archived ? "archived" : "unarchived"}.`,
          ephemeral: true,
        });
        break;
      }

      case "save-as-draft": {
        const publishData = { title, category, points, flags, hint, hintCost, description, files };

        if (existingChallengeId) {
          const challenge = await prisma.challenge.update({
            where: { id: existingChallengeId },
            data: { published: false, editedAt: new Date(), challengeAuthorId: interaction.user.id, ...publishData },
            include: { attemptedChallenges: true },
          });

          challengeCache.set(challenge.id, challenge);
        } else {
          const challenge = await prisma.challenge.create({
            data: { published: false, challengeAuthorId: interaction.user.id, ...publishData },
            include: { attemptedChallenges: true },
          });

          challengeCache.set(challenge.id, challenge);
          existingChallengeId = challenge.id;
        }

        await interaction.editReply({ embeds: [generateEmbed()], components: generateRows() });
        await button.reply({
          content: "Your changes have been saved, you can now safely discard changes.",
          ephemeral: true,
        });

        break;
      }

      case "publish": {
        // Points can be 0, so it is left out here
        if (!title || !category || !flags.length || !description) {
          await button.reply({
            content: "You must complete all main fields before publishing.",
            ephemeral: true,
          });
          return;
        }

        const publishData = { title, category, points, flags, hint, hintCost, description, files };

        const challenge = await prisma.challenge.upsert({
          where: { id: existingChallengeId },
          update: { published: true, editedAt: new Date(), challengeAuthorId: interaction.user.id, ...publishData },
          create: { published: true, challengeAuthorId: interaction.user.id, ...publishData },
          include: { attemptedChallenges: true },
        });

        challengeCache.set(challenge.id, challenge);

        const challengeChannel = getChallengeChannel(interaction.client);
        const msg = await challengeChannel.send(generateMessageOptions(challenge, interaction.user));

        await prisma.challenge.update({ where: { id: existingChallengeId }, data: { publishedMessageURL: msg.url } });

        await button.update({
          embeds: [generateAuthorEmbed(`Challenge published: ${msg.url} (#${challenge.id})`, interaction.user)],
          components: [],
        });

        collector.stop();
        break;
      }
    }
  });

  collector.on("end", async () => {
    if (collector.endReason !== "time") return;
    await message
      .edit({ embeds: [generateAuthorEmbed("Timed out", interaction.user)], components: [] })
      .catch(() => undefined);
  });
}
