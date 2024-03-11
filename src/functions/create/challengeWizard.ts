import { MessageLinkRegex } from "@sapphire/discord-utilities";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { ThreadAutoArchiveDuration } from "discord.js";

import colors from "../../constants/colors.js";
import { challengeCache, prisma } from "../../index.js";
import { filterUser } from "../filterUser.js";
import { generateAuthorEmbed } from "../generateAuthorEmbed.js";
import { getChallengeChannel } from "../getChannels.js";
import { filesModal, hintsModal, mainFieldsModal } from "./modalBuilders.js";
import { generateMessageOptions } from "./publishMessage.js";
import { runPublishProtection } from "./runPublishProtection.js";

export type ChallengeWizardOptions = {
  title: string;
  category: string;
  points: number;
  flags: string[];
  hint?: string | null; // null to account for database result
  hintCost?: number | null;
  description: string;
  files: string[];
  published: boolean;
  archived: boolean;
  publishedMessageURL?: string | null;
  threadChannelId?: string | null;
};

export function generateEmbed(
  { title, category, points, flags, hint, hintCost, description, files, published }: ChallengeWizardOptions,
  existingChallengeId?: number,
  viewOnly = false,
) {
  return new EmbedBuilder()
    .setColor(published ? colors.success : existingChallengeId ? colors.orange : colors.warning)
    .setTitle(`${viewOnly ? "View a" : existingChallengeId ? "Edit a" : "Create a new"} challenge`)
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
      text: existingChallengeId
        ? ` ${viewOnly ? "Viewing" : "Changes are not saved automatically. Editing"} ${
            published ? "challenge" : "draft"
          } #${existingChallengeId}.`
        : "Creating a new challenge.",
    });
}

export async function handleChallengeWizard(
  {
    title,
    category,
    points,
    flags,
    hint,
    hintCost,
    description,
    files,
    published,
    archived,
    publishedMessageURL,
  }: ChallengeWizardOptions,
  interaction: ChatInputCommandInteraction,
  existingChallengeId?: number,
) {
  function generateWizardEmbed() {
    return generateEmbed(
      { title, category, points, flags, hint, hintCost, description, files, published, archived },
      existingChallengeId,
    );
  }

  function generateRows() {
    const editRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("edit-main-fields").setLabel("Edit main fields").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("edit-files").setLabel("Edit attachments").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("edit-hint").setLabel("Edit hint").setStyle(ButtonStyle.Secondary),
    );

    const fileRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    );

    const showEditPublishedMessage = published || publishedMessageURL;

    const publishButton = new ButtonBuilder()
      .setCustomId("publish")
      .setLabel(published ? "Publish again" : showEditPublishedMessage ? "Publish with new message" : "Publish")
      .setStyle(showEditPublishedMessage ? ButtonStyle.Secondary : ButtonStyle.Primary);

    if (!showEditPublishedMessage) fileRow.addComponents(publishButton);

    const publishRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("edit-published-message")
        .setLabel(published ? "Edit published message" : "Publish with existing message")
        .setStyle(ButtonStyle.Primary),
      publishButton,
    );

    return [editRow, fileRow, ...(showEditPublishedMessage ? [publishRow] : [])];
  }

  const message = await interaction.reply({
    embeds: [generateWizardEmbed()],
    components: generateRows(),
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    filter: (i) => filterUser(i, interaction.user),
    time: 8.64e7,
  });

  collector.on("collect", async (componentInteraction) => {
    switch (componentInteraction.customId) {
      case "edit-main-fields": {
        componentInteraction.showModal(
          mainFieldsModal(componentInteraction.id, title, category, points, description, flags),
        );
        const modalInteraction = await componentInteraction
          .awaitModalSubmit({ time: 8.64e7, filter: (i) => i.customId.endsWith(componentInteraction.id) })
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
        await interaction.editReply({ embeds: [generateWizardEmbed()] });
        break;
      }

      case "edit-hint": {
        componentInteraction.showModal(hintsModal(componentInteraction.id, hint, hintCost));
        const modalInteraction = await componentInteraction
          .awaitModalSubmit({ time: 8.64e7, filter: (i) => i.customId.endsWith(componentInteraction.id) })
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
        await interaction.editReply({ embeds: [generateWizardEmbed()] });
        break;
      }

      case "edit-files": {
        componentInteraction.showModal(filesModal(componentInteraction.id, files));
        const modalInteraction = await componentInteraction
          .awaitModalSubmit({ time: 8.64e7, filter: (i) => i.customId.endsWith(componentInteraction.id) })
          .catch(() => undefined);
        if (!modalInteraction) return;

        files = modalInteraction.fields
          .getTextInputValue("files")
          .split("\n")
          .map((file) => file.trim())
          .filter(Boolean);

        await modalInteraction?.reply({ content: "Files have been updated.", ephemeral: true });
        await interaction.editReply({ embeds: [generateWizardEmbed()] });
        break;
      }

      case "delete": {
        if (!existingChallengeId) {
          await componentInteraction.reply({
            content: "This challenge hasn't been saved. Did you mean to discard changes?",
            ephemeral: true,
          });
          return;
        }

        await prisma.challenge.delete({ where: { id: existingChallengeId } });
        challengeCache.delete(existingChallengeId);

        await componentInteraction.update({
          embeds: [generateAuthorEmbed(`Deleted challenge #${existingChallengeId}`, interaction.user)],
          components: [],
        });
        collector.stop();
        break;
      }

      case "discard": {
        await componentInteraction.update({
          embeds: [generateAuthorEmbed("Discarded changes", interaction.user)],
          components: [],
        });
        collector.stop();
        break;
      }

      case "archive": {
        if (!existingChallengeId) {
          await componentInteraction.reply({
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

        await interaction.editReply({ embeds: [generateWizardEmbed()], components: generateRows() });
        await componentInteraction.reply({
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

        published = false;
        await interaction.editReply({ embeds: [generateWizardEmbed()], components: generateRows() });
        await componentInteraction.reply({
          content: "Your changes have been saved; you can now safely discard changes.",
          ephemeral: true,
        });

        break;
      }

      case "publish": {
        // Points can be 0, so it is left out here
        if (!title || !category || !flags.length || !description) {
          await componentInteraction.reply({
            content: "You must complete all main fields before publishing.",
            ephemeral: true,
          });
          return;
        }

        const publishData = { title, category, points, flags, hint, hintCost, description, files };

        const newInteraction = await runPublishProtection(
          componentInteraction,
          publishData.title,
          published,
          existingChallengeId,
        );

        if (!newInteraction) return;

        const challenge = existingChallengeId
          ? await prisma.challenge.update({
              where: { id: existingChallengeId },
              data: { published: true, editedAt: new Date(), challengeAuthorId: interaction.user.id, ...publishData },
              include: { attemptedChallenges: true },
            })
          : await prisma.challenge.create({
              data: { published: true, challengeAuthorId: interaction.user.id, ...publishData },
              include: { attemptedChallenges: true },
            });

        challengeCache.set(challenge.id, challenge);

        const challengeChannel = getChallengeChannel(interaction.client);
        const msg = await challengeChannel.send(generateMessageOptions(challenge, interaction.user));

        await prisma.challenge.update({ where: { id: challenge.id }, data: { publishedMessageURL: msg.url } });

        if (msg.channel.type === ChannelType.GuildText && !challenge.threadChannelId) {
          const thread = await msg.channel.threads.create({
            name: `${challenge.title} - Solved Discussion (#${challenge.id})`,
            type: ChannelType.PrivateThread,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            invitable: false,
          });

          const threadEmbed = new EmbedBuilder()
            .setColor(colors.pink)
            .setTitle(`${challenge.title} - Solved Discussion`)
            .setDescription(
              "Welcome to the solved discussion thread! You can discuss about the challenge here and share your thought process; however, please avoid sharing solutions outside this thread. Threads will be made public after the round concludes.",
            )
            .setFooter({ text: `#${challenge.id}` });

          await thread.send({ embeds: [threadEmbed] });
          await prisma.challenge.update({ where: { id: challenge.id }, data: { threadChannelId: thread.id } });
        }

        if (newInteraction.id !== componentInteraction.id) {
          await newInteraction.update({
            content: "Challenge published despite warnings present.",
            embeds: [],
            components: [],
          });

          await interaction.editReply({
            embeds: [generateAuthorEmbed(`Challenge published: ${msg.url} (#${challenge.id})`, interaction.user)],
            components: [],
          });
        } else {
          await componentInteraction.update({
            embeds: [generateAuthorEmbed(`Challenge published: ${msg.url} (#${challenge.id})`, interaction.user)],
            components: [],
          });
        }

        collector.stop();
        break;
      }

      case "edit-published-message": {
        // Points can be 0, so it is left out here
        if (!title || !category || !flags.length || !description) {
          await componentInteraction.reply({
            content: "You must complete all main fields before publishing.",
            ephemeral: true,
          });
          return;
        }

        const publishData = { title, category, points, flags, hint, hintCost, description, files };

        const challenge = await prisma.challenge.update({
          where: { id: existingChallengeId },
          data: { published: true, editedAt: new Date(), challengeAuthorId: interaction.user.id, ...publishData },
          include: { attemptedChallenges: true },
        });

        challengeCache.set(challenge.id, challenge);

        const challengeChannel = getChallengeChannel(interaction.client);

        const messageId = challenge.publishedMessageURL && MessageLinkRegex.exec(challenge.publishedMessageURL)?.[3];
        const oldMsg = await challengeChannel.messages.fetch(messageId ?? "").catch(() => undefined);

        if (!oldMsg?.editable) {
          await componentInteraction.reply({
            content: [
              "The published message could not be found or accessed. Please republish the challenge or check the bot's permissions.",
              `Trying to edit this message: ${challenge.publishedMessageURL ?? "N/A"}`,
              "\nPlease note that the challenge has still been updated internally.",
            ].join("\n"),
            ephemeral: true,
          });
          return;
        }

        const msg = await oldMsg.edit(generateMessageOptions(challenge, interaction.user));

        await prisma.challenge.update({ where: { id: challenge.id }, data: { publishedMessageURL: msg.url } });

        await componentInteraction.update({
          embeds: [generateAuthorEmbed(`Edited published message: ${msg.url} (#${challenge.id})`, interaction.user)],
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
