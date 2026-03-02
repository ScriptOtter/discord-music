import { TextInputBuilder, TextInputStyle } from 'discord.js';

export const CustomInput = (id: string, label: string, placeholder: string) => {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setStyle(TextInputStyle.Short);

  return input;
};
