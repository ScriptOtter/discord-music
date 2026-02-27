import { Injectable } from '@nestjs/common';
import { Context, Options, SlashCommand, SlashCommandContext } from 'necord';
import { TextDto } from './dto/text.dto';
import { PlayerService } from './player.service';
import { GuildMember, VoiceChannel } from 'discord.js';
import { VoicePlayerService } from './player.init';

@Injectable()
export class PlayerCommandService {
  constructor(
    private readonly playerService: PlayerService,
    private readonly voicePlayerService: VoicePlayerService,
  ) {}

  @SlashCommand({
    name: 'track',
    description: 'Добавить песню',
  })
  public async addTrack(
    @Context() [ctx]: SlashCommandContext,
    @Options() { text }: TextDto,
  ) {
    if (!text) ctx.reply('Вы не прикрепили ссылку на песню');
    this.playerService.musicStack.push(text);
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
    for (let key in this.playerService.musicStack) {
      message += `[${key}] - ${this.playerService.musicStack[key]}\n`;
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
    const track = this.playerService.musicStack[text];
    this.playerService.delTrack(track);
    return await ctx.reply({
      content: `${track} успешно убран из очереди`,
    });
  }

  @SlashCommand({
    name: 'join',
    description: 'Подключить бота к голосовому каналу',
  })
  public async joinInVoiceChannel(@Context() [ctx]: SlashCommandContext) {
    const member = ctx.member as GuildMember;
    if (!member) return await ctx.reply({ content: 'Вы не участник сервера' });

    const voiceChannel = member.voice.channel as VoiceChannel;
    if (!voiceChannel) {
      return await ctx.reply({
        content: 'Вы должны находиться в голосовом канале.',
      });
    }
    this.voicePlayerService.join(
      voiceChannel.id,
      voiceChannel.guild.id,
      voiceChannel.guild.voiceAdapterCreator,
    );
    if (this.playerService.musicStack.length === 0) {
      return await ctx.reply({
        content:
          'Очередь пуста. Добавьте треки через команду /track https:youtube.com/...',
      });
    }
    return await ctx.reply({
      content: `Я присоединился к каналу ${voiceChannel.name}!`,
    });
  }

  @SlashCommand({
    name: 'quit',
    description: 'Удалить бота из голосового канала',
  })
  public async quitVoiceChannel(@Context() [ctx]: SlashCommandContext) {
    this.voicePlayerService.leave();

    return await ctx.reply({
      content: `Я отключился!`,
    });
  }

  @SlashCommand({
    name: 'play',
    description: 'Включить музыку',
  })
  public async playMusic(@Context() [ctx]: SlashCommandContext) {
    await ctx.reply({
      content: `Включаю песню ...`,
    });
    for (let url of this.playerService.musicStack) {
      await this.voicePlayerService.playAudio(url, [ctx]);

      this.playerService.delTrack(url);

      if (this.playerService.musicStack.length === 0) {
        this.voicePlayerService.leave();
        return await ctx.editReply('Музыка закончилась');
      }
    }
  }

  @SlashCommand({ name: 'skip', description: 'Пропустить текущий трек' })
  public async skipTrack(@Context() [ctx]: SlashCommandContext) {
    const result = this.voicePlayerService.skipTrack();
    if (!result) return ctx.reply(`Не удалось скипнуть трек`);
    const track = this.voicePlayerService.getCurrentTrackName();
    return ctx.reply(`Трек ${track} успешно пропущен `);
  }

  @SlashCommand({ name: 'pause', description: 'Поставить трек на паузу' })
  public async pauseTrack(@Context() [ctx]: SlashCommandContext) {
    const pause = this.voicePlayerService.pause();
    if (!pause) return ctx.reply(`Не удалось поставить паузу`);
    const track = this.voicePlayerService.getCurrentTrackName();
    return ctx.reply(`${track} поставлен на паузу`);
  }

  @SlashCommand({ name: 'unpause', description: 'Снять трек с паузы' })
  public async unpauseTrack(@Context() [ctx]: SlashCommandContext) {
    const pause = this.voicePlayerService.unpause();
    if (!pause) return ctx.reply(`Не удалось возобновить трек`);
    const track = this.voicePlayerService.getCurrentTrackName();
    ctx.reply(`${track} возобновлен`);
  }
}
