import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

export function mainFieldsModal(title: string, category: string, points: number, description: string, flags: string[]) {
  return new ModalBuilder()
    .setCustomId("modal-main-fields")
    .setTitle("Edit main fields")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Title")
          .setMaxLength(256)
          .setValue(title)
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("category")
          .setLabel("Category")
          .setMaxLength(100)
          .setValue(category)
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("points")
          .setLabel("Points")
          .setMaxLength(10)
          .setValue(points.toString())
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Description")
          .setMaxLength(1024)
          .setValue(description)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("flags")
          .setLabel("Flags (newline-separated)")
          .setPlaceholder("If there are multiple flags, separate them with newlines")
          .setMaxLength(1024)
          .setValue(flags.join("\n"))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );
}

export function hintsModal(hint?: string | null, hintCost?: number | null) {
  return new ModalBuilder()
    .setCustomId("modal-hints")
    .setTitle("Edit hints")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("hint-cost")
          .setLabel("Hint cost")
          .setPlaceholder("Leave blank if you don't want to set a hint.")
          .setMaxLength(10)
          .setValue(hintCost?.toString() || "")
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("hint")
          .setLabel("Hint description")
          .setPlaceholder("Leave blank if you don't want to set a hint.")
          .setMaxLength(1024)
          .setValue(hint || "")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );
}

export function filesModal(files: string[]) {
  return new ModalBuilder()
    .setCustomId("modal-files")
    .setTitle("Edit files")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("files")
          .setLabel("Files (newline-separated)")
          .setPlaceholder("Separate links with newlines. Use Discord links preferably. (Do not delete the messages)")
          .setMaxLength(1024)
          .setValue(files.join("\n"))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false),
      ),
    );
}
