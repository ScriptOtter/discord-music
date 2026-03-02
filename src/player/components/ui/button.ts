import { ButtonBuilder, ButtonStyle } from 'discord.js';

enum ButtonColor {
  RED = ButtonStyle.Danger,
  BLUE = ButtonStyle.Primary,
  GRAY = ButtonStyle.Secondary,
  GREEN = ButtonStyle.Success,
}

export const CustomButton = (
  id: string,
  color: keyof typeof ButtonColor,
  label?: string,
  disabled?: boolean,
  emoji?: string,
) => {
  const button = new ButtonBuilder()
    .setCustomId(id)
    .setStyle(ButtonColor[color] as unknown as ButtonStyle);
  if (label) button.setLabel(label);
  if (disabled) button.setDisabled(disabled);
  if (emoji) button.setEmoji(emoji);

  return button;
};
