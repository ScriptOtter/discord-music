import { Injectable } from '@nestjs/common';
import { Context, Options, SlashCommand, SlashCommandContext } from 'necord';
import { PlaylistService } from 'src/modules/playlist/playlist.service';
import { TextDto } from './dto/text.dto';
import { PlayerService } from './player.service';

@Injectable()
export class PlayerPlaylistService {
  public constructor(
    private readonly playlistService: PlaylistService,
    private readonly playerService: PlayerService,
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
      content += `ID: ${playlist.id}\nНазвание: ${playlist.name}\nСоздатель: ${playlist.owner}\n${separator}\n`;
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
    const playlist = await this.playlistService.getPlaylistById(text);
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
}
