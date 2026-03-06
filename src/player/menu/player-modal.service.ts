import { Injectable, Logger } from '@nestjs/common';
import { Context, Modal, ModalContext, ModalParam } from 'necord';

import { PlaylistService } from 'src/modules/playlist/playlist.service';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { PlaylistWithTracks } from 'src/shared/types/playlist.types';
import { PlayerPlaylistService } from './player-playlist.service';
import { ICONS } from 'src/shared/utils/icons.enum';
import { YoutubeService } from 'src/modules/youtube/youtube.service';

@Injectable()
export class PlayerModalService {
  private readonly logger = new Logger(PlayerModalService.name);
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly playerPlaylistService: PlayerPlaylistService,
    private readonly youtubeService: YoutubeService,
  ) {}

  @Modal('create_playlist_modal')
  private async createPlaylist(@Context() [interaction]: ModalContext) {
    const playlistName = interaction.fields.getTextInputValue('playlist_name');
    const tracksInput = interaction.fields.getTextInputValue('tracks');

    await interaction.deferReply({ flags: 64 });

    try {
      // Валидация названия плейлиста
      if (!playlistName || playlistName.trim().length === 0) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Название плейлиста не может быть пустым`,
        });
      }

      if (playlistName.length > 100) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Название плейлиста слишком длинное (максимум 100 символов)`,
        });
      }

      // Получаем и валидируем ссылки
      const trackUrls = tracksInput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.includes('youtu'));

      if (trackUrls.length === 0) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Не найдено валидных YouTube ссылок`,
        });
      }

      await interaction.editReply({
        content: `${ICONS.LOADING} Создаю плейлист "${playlistName}" и добавляю треки...`,
      });

      // Создаем плейлист
      const playlist = await this.playlistService.createPlaylist({
        name: playlistName.trim(),
        owner: interaction.user.username,
      });

      if (!playlist) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Не удалось создать плейлист`,
        });
      }

      // Добавляем треки
      const results = {
        success: [] as any[],
        failed: [] as string[],
      };

      for (let i = 0; i < trackUrls.length; i++) {
        const url = trackUrls[i];

        try {
          const data = await this.youtubeService.getVideoData(url);
          if (data._type === 'playlist') {
            const videos: { url: string; title: string }[] = data.entries.map(
              (video) => {
                return { url: video.url, title: video.title };
              },
            );
            for (const video of videos) {
              const track = await this.playlistService.addTrackToPlaylist(
                playlist.id,
                video.url,
                video.title,
              );
              if (track) {
                results.success.push(track);
              } else {
                results.failed.push(url);
              }
            }
          } else if (data._type === 'video') {
            const track = await this.playlistService.addTrackToPlaylist(
              playlist.id,
              url,
              data.title,
            );

            if (track) {
              results.success.push(track);
            } else {
              results.failed.push(url);
            }
          }
        } catch (error) {
          results.failed.push(url);
          this.logger.debug(`Failed to add track: ${url}`);
        }

        if (
          (i + 1) % 3 === 0 ||
          i === results.success.length + results.failed.length - 1
        ) {
          await interaction.editReply({
            content: `${ICONS.LOADING} Создаю плейлист "${playlistName}" и добавляю треки... `,
          });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(results.success.length > 0 ? 0x00ff00 : 0xff0000)
        .setTitle(`Плейлист "${playlistName}" создан!`)
        .setDescription(`${ICONS.ID} ID плейлиста: \`${playlist.id}\``)
        .addFields(
          {
            name: `Успешно добавлено`,
            value: results.success.length.toString(),
            inline: true,
          },
          {
            name: `${ICONS.ERROR} С ошибками`,
            value: results.failed.length.toString(),
            inline: true,
          },
          {
            name: `${ICONS.PLAYLIST} Всего треков`,
            value: (results.success.length + results.failed.length).toString(),
            inline: true,
          },
        )
        .setTimestamp();

      if (results.success.length > 0) {
        const tracksList = results.success
          .slice(0, 5)
          .map((t) => `• ${t.title}`)
          .join('\n');

        embed.addFields({
          name: `Добавленные треки`,
          value:
            tracksList +
            (results.success.length > 5
              ? `\n... и еще ${results.success.length - 5}`
              : ''),
        });
      }

      if (results.failed.length > 0) {
        embed.addFields({
          name: `${ICONS.ERROR} Невалидные ссылки`,
          value:
            results.failed.slice(0, 5).join('\n') +
            (results.failed.length > 5
              ? `\n... и еще ${results.failed.length - 5}`
              : ''),
        });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`playlist_${playlist.id}`)
          .setLabel(`${ICONS.PLAYLIST} Перейти к плейлисту`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`back`)
          .setLabel(`${ICONS.BACK} Назад`)
          .setStyle(ButtonStyle.Secondary),
      );

      const previousMessage = interaction.message;

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      if (previousMessage) {
        try {
          await previousMessage.delete();
        } catch (deleteError) {
          this.logger.debug(
            `Could not delete previous message: ${deleteError.message}`,
          );
        }
      }

      // Настраиваем коллектор на новом сообщении
      this.playerPlaylistService.setupCollector(message);
    } catch (error) {
      this.logger.error(`Error in createPlaylist modal: ${error.message}`);
      await interaction
        .editReply({
          content: `${ICONS.ERROR} Ошибка при создании плейлиста: ${error.message}`,
        })
        .catch(() => {});
    }
  }

  @Modal('add_tracks_modal_:playlistId')
  private async addTrack(
    @Context() [interaction]: ModalContext,
    @ModalParam('playlistId') playlistId: string,
  ) {
    const tracksInput = interaction.fields.getTextInputValue('tracks');

    await interaction.deferReply({ flags: 64 });

    try {
      const playlist = await this.playlistService.getPlaylistById(playlistId);
      if (!playlist) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Плейлист не найден`,
        });
      }

      const trackUrls = tracksInput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.includes('youtu'));

      if (trackUrls.length === 0) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Не найдено валидных YouTube ссылок`,
        });
      }

      await interaction.editReply({
        content: `${ICONS.LOADING} Добавляю треки...`,
      });

      const results = {
        success: [] as any[],
        failed: [] as string[],
      };

      for (let i = 0; i < trackUrls.length; i++) {
        const url = trackUrls[i];

        try {
          const data = await this.youtubeService.getVideoData(url);
          if (data._type === 'playlist') {
            const videos: { url: string; title: string }[] = data.entries.map(
              (video) => {
                return { url: video.url, title: video.title };
              },
            );
            for (const video of videos) {
              const track = await this.playlistService.addTrackToPlaylist(
                playlist.id,
                video.url,
                video.title,
              );
              if (track) {
                results.success.push(track);
              } else {
                results.failed.push(url);
              }
            }
          } else if (data._type === 'video') {
            const track = await this.playlistService.addTrackToPlaylist(
              playlist.id,
              url,
              data.title,
            );

            if (track) {
              results.success.push(track);
            } else {
              results.failed.push(url);
            }
          }
        } catch (error) {
          results.failed.push(url);
          this.logger.debug(`Failed to add track: ${url}`);
        }

        if (
          (i + 1) % 3 === 0 ||
          i === results.success.length + results.failed.length - 1
        ) {
          await interaction.editReply({
            content: `${ICONS.LOADING} Добавляю треки...`,
          });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(results.success.length > 0 ? 0x00ff00 : 0xff0000)
        .setTitle(`Результаты добавления в "${playlist.name}"`)
        .addFields(
          {
            name: `${ICONS.SUCCESS} Успешно`,
            value: results.success.length.toString(),
            inline: true,
          },
          {
            name: `${ICONS.ERROR} С ошибками`,
            value: results.failed.length.toString(),
            inline: true,
          },
          {
            name: `${ICONS.PLAYLIST} Всего`,
            value: (results.success.length + results.failed.length).toString(),
            inline: true,
          },
        )
        .setTimestamp();

      if (results.success.length > 0) {
        const tracksList = results.success
          .slice(0, 5)
          .map((t) => `${ICONS.TRACK} ${t.title}`)
          .join('\n');

        embed.addFields({
          name: `Добавленные треки`,
          value:
            tracksList +
            (results.success.length > 5
              ? `\n... и еще ${results.success.length - 5}`
              : ''),
        });
      }

      if (results.failed.length > 0) {
        embed.addFields({
          name: `${ICONS.ERROR} Невалидные ссылки`,
          value:
            results.failed.slice(0, 5).join('\n') +
            (results.failed.length > 5
              ? `\n... и еще ${results.failed.length - 5}`
              : ''),
        });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`playlist_${playlistId}`)
          .setLabel(`${ICONS.BACK} Назад к плейлисту`)
          .setStyle(ButtonStyle.Primary),
      );

      const previousMessage = interaction.message;

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      if (previousMessage) {
        try {
          await previousMessage.delete();
        } catch (deleteError) {
          this.logger.debug(
            `Could not delete previous message: ${deleteError.message}`,
          );
        }
      }

      this.playerPlaylistService.setupCollector(message);

      await this.playerPlaylistService.updatePlaylistMenu(
        interaction,
        playlist as PlaylistWithTracks,
      );
    } catch (error) {
      this.logger.error(`Error in onAddTracksModal: ${error.message}`);
      await interaction
        .editReply({
          content: `${ICONS.ERROR} Ошибка: ${error.message}`,
        })
        .catch(() => {});
    }
  }

  @Modal('delete_tracks_modal_:playlistId')
  private async delTrack(
    @Context() [interaction]: ModalContext,
    @ModalParam('playlistId') playlistId: string,
  ) {
    const trackIdsInput = interaction.fields.getTextInputValue('track_ids');

    await interaction.deferReply({ flags: 64 });

    try {
      const playlist = await this.playlistService.getPlaylistById(playlistId);
      if (!playlist) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Плейлист не найден`,
        });
      }

      const trackIds = trackIdsInput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (trackIds.length === 0) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Не введено ни одного ID трека`,
        });
      }

      const existingTrackIds = new Set(playlist.tracks.map((t) => t.id));
      const validIds = trackIds.filter((id) => existingTrackIds.has(id));
      const invalidIds = trackIds.filter((id) => !existingTrackIds.has(id));

      if (validIds.length === 0) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Ни один из введенных ID не найден в плейлисте`,
        });
      }

      await interaction.editReply({
        content: `${ICONS.LOADING} Удаляю треки... 0/${validIds.length}`,
      });

      const results = {
        success: [] as string[],
        failed: [] as string[],
      };

      for (let i = 0; i < validIds.length; i++) {
        const trackId = validIds[i];

        try {
          const success = await this.playlistService.deleteTrackFromPlaylist(
            playlistId,
            trackId,
          );

          if (success) {
            results.success.push(trackId);
          } else {
            results.failed.push(trackId);
          }
        } catch (error) {
          results.failed.push(trackId);
          this.logger.debug(
            `Failed to delete track ${trackId}: ${error.message}`,
          );
        }

        if ((i + 1) % 3 === 0 || i === validIds.length - 1) {
          await interaction.editReply({
            content: `${ICONS.LOADING} Удаляю треки... ${i + 1}/${validIds.length}`,
          });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(results.success.length > 0 ? 0x00ff00 : 0xff0000)
        .setTitle(`Результаты удаления из "${playlist.name}"`)
        .addFields(
          {
            name: `Удалено`,
            value: results.success.length.toString(),
            inline: true,
          },
          {
            name: `${ICONS.ERROR} Ошибка`,
            value: results.failed.length.toString(),
            inline: true,
          },
          {
            name: `${ICONS.ID} Всего ID`,
            value: validIds.length.toString(),
            inline: true,
          },
        )
        .setTimestamp();

      if (invalidIds.length > 0) {
        embed.addFields({
          name: `${ICONS.WARNING} Не найдены в плейлисте`,
          value:
            invalidIds.slice(0, 5).join('\n') +
            (invalidIds.length > 5
              ? `\n... и еще ${invalidIds.length - 5}`
              : ''),
        });
      }

      if (results.success.length > 0) {
        const deletedTrackNames = playlist.tracks
          .filter((t) => results.success.includes(t.id))
          .slice(0, 5)
          .map((t) => `${ICONS.TRACK} ${t.title}`)
          .join('\n');

        embed.addFields({
          name: `Удаленные треки`,
          value:
            deletedTrackNames +
            (results.success.length > 5
              ? `\n... и еще ${results.success.length - 5}`
              : ''),
        });
      }

      const previousMessage = interaction.message;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`playlist_${playlistId}`)
          .setLabel(`${ICONS.BACK} Назад к плейлисту`)
          .setStyle(ButtonStyle.Primary),
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      if (previousMessage) {
        try {
          await previousMessage.delete();
        } catch (deleteError) {
          this.logger.debug(
            `Could not delete previous message: ${deleteError.message}`,
          );
        }
      }

      this.playerPlaylistService.setupCollector(message);
      await this.playerPlaylistService.updatePlaylistMenu(
        interaction,
        playlist as PlaylistWithTracks,
      );
    } catch (error) {
      this.logger.error(`Error in onDeleteTracksModal: ${error.message}`);
      await interaction
        .editReply({
          content: `${ICONS.ERROR} Ошибка: ${error.message}`,
        })
        .catch(() => {});
    }
  }

  @Modal('delete_playlist_modal_:playlistId')
  private async deletePlaylist(
    @Context() [interaction]: ModalContext,
    @ModalParam('playlistId') playlistId: string,
  ) {
    const confirmation = interaction.fields.getTextInputValue('confirmation');

    await interaction.deferReply({ flags: 64 });

    try {
      if (confirmation.toLowerCase() !== 'да') {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Удаление отменено: введите "да" для подтверждения`,
        });
      }

      const playlist = await this.playlistService.getPlaylistById(playlistId);
      if (!playlist) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Плейлист не найден`,
        });
      }
      if (playlist.owner !== interaction.user.username) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Вы не можете удалить этот плейлист`,
        });
      }

      await this.playlistService.deletePlaylist(playlistId);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('Плейлист удален')
        .setDescription(`Плейлист "${playlist.name}" был успешно удален`)
        .addFields(
          {
            name: 'ID плейлиста',
            value: `\`${playlistId}\``,
            inline: true,
          },
          {
            name: 'Владелец',
            value: playlist.owner,
            inline: true,
          },
        )
        .setTimestamp();

      const previousMessage = interaction.message;

      const message = await interaction.editReply({
        embeds: [embed],
      });

      if (previousMessage) {
        try {
          await previousMessage.delete();
        } catch (deleteError) {
          this.logger.debug(
            `Could not delete previous message: ${deleteError.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in deletePlaylist modal: ${error.message}`);
      await interaction
        .editReply({
          content: `${ICONS.ERROR} Ошибка при удалении плейлиста: ${error.message}`,
        })
        .catch(() => {});
    }
  }

  @Modal('update_playlist_name_modal_:playlistId')
  private async updatePlaylistName(
    @Context() [interaction]: ModalContext,
    @ModalParam('playlistId') playlistId: string,
  ) {
    const newPlaylistName =
      interaction.fields.getTextInputValue('playlist_name');

    await interaction.deferReply({ flags: 64 });

    try {
      // Валидация названия плейлиста
      if (!newPlaylistName || newPlaylistName.trim().length === 0) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Название плейлиста не может быть пустым`,
        });
      }

      if (newPlaylistName.length > 100) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Название плейлиста слишком длинное (максимум 100 символов)`,
        });
      }

      const playlist = await this.playlistService.getPlaylistById(playlistId);
      if (!playlist) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Плейлист не найден`,
        });
      }

      if (playlist.owner !== interaction.user.username) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Вы не можете редактировать этот плейлист`,
        });
      }

      // Обновляем название
      const updatedPlaylist = await this.playlistService.renamePlaylist(
        playlistId,
        newPlaylistName.trim(),
      );

      if (!updatedPlaylist) {
        return await interaction.editReply({
          content: `${ICONS.ERROR} Не удалось обновить название плейлиста`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Название плейлиста обновлено')
        .setDescription(`Название плейлиста было успешно изменено`)
        .addFields(
          {
            name: 'Старое название',
            value: playlist.name,
            inline: true,
          },
          {
            name: 'Новое название',
            value: updatedPlaylist.name,
            inline: true,
          },
          {
            name: 'ID плейлиста',
            value: `\`${playlistId}\``,
            inline: false,
          },
        )
        .setTimestamp();

      // Кнопка для перехода к плейлисту
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`playlist_${playlistId}`)
          .setLabel(`${ICONS.PLAYLIST} Перейти к плейлисту`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`back`)
          .setLabel(`${ICONS.BACK} Назад`)
          .setStyle(ButtonStyle.Secondary),
      );

      const previousMessage = interaction.message;

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      // Удаляем предыдущее сообщение если есть
      if (previousMessage) {
        try {
          await previousMessage.delete();
        } catch (deleteError) {
          this.logger.debug(
            `Could not delete previous message: ${deleteError.message}`,
          );
        }
      }

      // Настраиваем коллектор на новом сообщении
      this.playerPlaylistService.setupCollector(message);
    } catch (error) {
      this.logger.error(`Error in updatePlaylistName modal: ${error.message}`);
      await interaction
        .editReply({
          content: `${ICONS.ERROR} Ошибка при обновлении названия плейлиста: ${error.message}`,
        })
        .catch(() => {});
    }
  }
}
