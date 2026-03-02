import { Injectable } from '@nestjs/common';
import {
  Button,
  Context,
  Options,
  SlashCommand,
  SlashCommandContext,
} from 'necord';
import { TextDto } from './dto/text.dto';
import { PlayerService } from './player.service';
import { GuildMember, VoiceChannel } from 'discord.js';
import { PlayerMenuService } from './player-menu.service';

@Injectable()
export class PlayerCommandService {
  constructor(
    private readonly playerService: PlayerService,
    private readonly menuService: PlayerMenuService,
  ) {}

  @SlashCommand({
    name: 'add',
    description: 'Добавить песню',
  })
  public async addTrack(
    @Context() [ctx]: SlashCommandContext,
    @Options() { text }: TextDto,
  ) {
    return await ctx.reply({
      content: `${text} успешно добавлен`,
    });
  }

  @SlashCommand({
    name: 'queue',
    description: 'Текущая очередь песен',
  })
  public async getQueue(@Context() [ctx]: SlashCommandContext) {
    let message = '';
    for (let key in this.playerService.playlist) {
      message += `[${key}] - ${this.playerService.playlist[key]}\n`;
    }
    return await ctx.reply({
      content: `${message !== '' ? message : 'Очередь пуста'}`,
    });
  }

  @SlashCommand({
    name: 'remove',
    description: 'Удалить песню из очереди',
  })
  public async delTrack(
    @Context() [ctx]: SlashCommandContext,
    @Options() { text }: TextDto,
  ) {
    if (!text) ctx.reply('Вы не указали номер трека в очереди');
    const track = this.playerService.playlist[text];
    this.playerService.deleteTrackFromPlaylist(track);
    return await ctx.reply({
      content: `${track} успешно убран из очереди`,
    });
  }

  @SlashCommand({
    name: 'join',
    description: 'Подключить/перекинуть бота в голосовой канал',
  })
  public async joinInVoiceChannel(@Context() [ctx]: SlashCommandContext) {
    const member = ctx.member as GuildMember;
    if (!member) return;

    const voiceChannel = member.voice.channel as VoiceChannel;
    if (!voiceChannel) {
      return await ctx.editReply({
        content: 'Вы должны находиться в голосовом канале.',
      });
    }
    this.playerService.join(
      voiceChannel.id,
      voiceChannel.guild.id,
      voiceChannel.guild.voiceAdapterCreator,
    );
  }

  @SlashCommand({
    name: 'quit',
    description: 'Удалить бота из голосового канала',
  })
  public async quitVoiceChannel(@Context() [ctx]: SlashCommandContext) {
    this.playerService.leave();

    return await ctx.reply({
      content: `Я отключился!`,
    });
  }

  @Button('play')
  @SlashCommand({
    name: 'play',
    description: 'Включить музыку',
  })
  public async playMusic(@Context() [ctx]: SlashCommandContext) {
    this.joinInVoiceChannel([ctx]);
    for (let data of this.playerService.playlist) {
      await this.playerService.playAudio();

      if (this.playerService.playlist.length === 0) {
        this.playerService.leave();
        return await ctx.editReply('Музыка закончилась');
      }
    }
  }

  @SlashCommand({ name: 'skip', description: 'Пропустить текущий трек' })
  public async skipTrack(@Context() [ctx]: SlashCommandContext) {
    const result = this.playerService.skipTrack();
    console.log(this.playerService.state);
    if (!result && this.playerService.state === 'Buffering')
      return ctx.reply(`Трек подгружается`);
    const track = this.playerService.getCurrentTrack();
    if (!track) return await ctx.reply('Не удалось пропустить трек');
    if (this.playerService.playlist.length === 1) {
      return await ctx.reply(`Треки в плейлисте закончились`);
    }
    return ctx.reply(`Трек ${track.title} успешно пропущен `);
  }
  @Button('pause')
  @SlashCommand({ name: 'pause', description: 'Поставить трек на паузу' })
  public async pauseTrack(@Context() [ctx]: SlashCommandContext) {
    const pause = this.playerService.pause();
    if (!pause) return ctx.reply(`Не удалось поставить паузу`);
    const track = this.playerService.getCurrentTrack();
    return ctx.reply(`${track} поставлен на паузу`);
  }
  @Button('unpause')
  @SlashCommand({ name: 'unpause', description: 'Снять трек с паузы' })
  public async unpauseTrack(@Context() [ctx]: SlashCommandContext) {
    const pause = this.playerService.unpause();
    if (!pause) return ctx.reply(`Не удалось возобновить трек`);
    const track = this.playerService.getCurrentTrack();
    if (!track) return ctx.reply(`Не удалось возобновить трек`);
    ctx.reply(`${track.title} возобновлен`);
  }
}
