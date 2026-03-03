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
