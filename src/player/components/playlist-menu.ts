import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ICONS } from 'src/shared/utils/icons.enum';

export function getPlaylistMenu(
  id: string,
  currentPage: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`add_${id}`)
      .setLabel(`${ICONS.ADD} Добавить треки`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`set_${id}`)
      .setLabel(`${ICONS.PLAYLIST} Загрузить в плейлист`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`del_${id}`)
      .setLabel(`${ICONS.DELETE} Удалить трек`)
      .setStyle(ButtonStyle.Danger),
  ]);

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`updatePlaylist_${id}`)
      .setLabel(`${ICONS.REFRESH} Изменить название`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`deletePlaylist_${id}`)
      .setLabel(`${ICONS.DELETE} Удалить плейлист`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`back`)
      .setLabel(`${ICONS.BACK} Назад`)
      .setStyle(ButtonStyle.Secondary),
  ]);

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`playlist_${id}_page_${currentPage - 1}`)
      .setLabel('◀ Предыдущая страница')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`playlist_${id}_page_${currentPage + 1}`)
      .setLabel('Следующая страница ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
  ]);
  return [row, row2, row3];
}
