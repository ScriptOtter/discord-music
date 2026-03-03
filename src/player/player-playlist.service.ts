import { Injectable } from '@nestjs/common';
import { Context, Options, SlashCommand, SlashCommandContext } from 'necord';
import { PlaylistService } from 'src/modules/playlist/playlist.service';
import { TextDto } from './dto/text.dto';
import { PlayerService } from './player.service';
import { AddTrackDto } from './dto/playlist.dto';
import { PlayerStateService } from './player-state.service';

@Injectable()
export class PlayerPlaylistService {
  public constructor(
    private readonly playlistService: PlaylistService,
    private readonly playerService: PlayerService,
    private readonly stateService: PlayerStateService,
  ) {}
  @SlashCommand({
    name: 'playlists',
    description: 'Получить список плейлистов (id, название, создателя)',
  })
  public async getPlaylists(@Context() [ctx]: SlashCommandContext) {
    const playlists = await this.playlistService.getPlaylists();
    if (!playlists) {
      await ctx.reply({
        content:
          'Плейлистов не найдено\nСоздайте первый плейлист командой /createPlaylist ...',
      });
    }
    let separator = '====================';
    let content = ``;
    for (const playlist of playlists)
      content += `Название: **${playlist.name}**\nСоздатель: **${playlist.owner}**\nID: ${playlist.id}\n${separator}\n`;
    await ctx.reply({ content, ephemeral: true });
  }

  @SlashCommand({
    name: 'playlist-create',
    description: 'Создать плейлист',
  })
  public async createPlaylist(
    @Context() [ctx]: SlashCommandContext,
    @Options() { text }: TextDto,
  ) {
    const playlist = await this.playlistService.createPlaylist({
      name: text,
      owner: String(ctx.user.globalName),
    });
    if (!playlist) {
      return await ctx.reply({
        content: `Не удалось создрать плейлист ${text}, попробуйте еще раз`,
        ephemeral: true,
      });
    }

    await ctx.reply({
      content: `Плейлист ${text} успешно создан. Добавить в него треки можно по следующему идентификатору.\nID: ${playlist.id}`,
      ephemeral: true,
    });
  }

  @SlashCommand({
    name: 'playlist-set',
    description: 'Загрузить плейлист по ID',
  })
  public async setPlaylist(
    @Context() [ctx]: SlashCommandContext,
    @Options() { text }: TextDto,
  ) {
    const playlist = await this.playlistService.getTracksFromPlaylistId(text);
    if (!playlist)
      return await ctx.reply({
        content: `Плейлист не найден`,
        ephemeral: true,
      });
    const result = this.playerService.setPlaylist(playlist);
    if (!result)
      return await ctx.reply({
        content: `Не удалось добавить треки в плейлист`,
        ephemeral: true,
      });

    return await ctx.reply({
      content: `Плейлист успешно загружен`,
      ephemeral: true,
    });
  }

  @SlashCommand({
    name: 'playlist-add-track',
    description: 'Добавить трек в плейлист',
  })
  public async addTrackToPlaylist(
    @Context() [interaction]: SlashCommandContext,
    @Options() { playlistId, url }: AddTrackDto,
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const playlist = await this.playlistService.getPlaylistById(playlistId);
      if (!playlist) {
        return await interaction.editReply({
          content: 'Плейлист не найден',
        });
      }

      const track = await this.playlistService.addTrackToPlaylist(
        playlistId,
        url,
      );
      if (!track) {
        return await interaction.editReply({
          content: 'Не удалось добавить трек в плейлист',
        });
      }

      return await interaction.editReply({
        content: `Трек ${track.title} успешно добавлен в плейлист ${playlist.name}`,
      });
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      return await interaction.editReply({
        content: 'Произошла ошибка при добавлении трека',
      });
    }
  }
}
