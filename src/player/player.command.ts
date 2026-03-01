import { Injectable } from '@nestjs/common';
import {
  Button,
  ButtonContext,
  Context,
  Ctx,
  MessageCommand,
  Modal,
  ModalContext,
  Options,
  SlashCommand,
  SlashCommandContext,
} from 'necord';
import { TextDto } from './dto/text.dto';
import { PlayerService } from './player.service';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  VoiceChannel,
} from 'discord.js';

@Injectable()
export class PlayerCommandService {
  constructor(private readonly playerService: PlayerService) {}

  @SlashCommand({
    name: 'add',
    description: 'Добавить песню',
  })
  public async addTrack(
    @Context() [ctx]: SlashCommandContext,
    @Options() { text }: TextDto,
  ) {
    if (!text) ctx.reply('Вы не прикрепили ссылку на песню');
    this.playerService.playlist.push(text);
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
    if (!member) return await ctx.reply({ content: 'Вы не участник сервера' });

    const voiceChannel = member.voice.channel as VoiceChannel;
    if (!voiceChannel) {
      return await ctx.reply({
        content: 'Вы должны находиться в голосовом канале.',
      });
    }
    this.playerService.join(
      voiceChannel.id,
      voiceChannel.guild.id,
      voiceChannel.guild.voiceAdapterCreator,
    );
    if (this.playerService.playlist.length === 0) {
      return await ctx.reply({
        content: 'Плейлист пуст',
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
    this.playerService.leave();

    return await ctx.reply({
      content: `Я отключился!`,
    });
  }

  @SlashCommand({
    name: 'play',
    description: 'Включить музыку',
  })
  public async playMusic(@Context() [ctx]: SlashCommandContext) {
    this.joinInVoiceChannel([ctx]);
    for (let url of this.playerService.playlist) {
      await this.playerService.playAudio(url, [ctx]);

      this.playerService.deleteTrackFromPlaylist(url);

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
    const track = this.playerService.getCurrentTrackName();
    if (this.playerService.playlist.length === 1) {
      return await ctx.reply(`Треки в плейлисте закончились`);
    }
    return ctx.reply(`Трек ${track} успешно пропущен `);
  }

  @SlashCommand({ name: 'pause', description: 'Поставить трек на паузу' })
  public async pauseTrack(@Context() [ctx]: SlashCommandContext) {
    const pause = this.playerService.pause();
    if (!pause) return ctx.reply(`Не удалось поставить паузу`);
    const track = this.playerService.getCurrentTrackName();
    return ctx.reply(`${track} поставлен на паузу`);
  }

  @SlashCommand({ name: 'unpause', description: 'Снять трек с паузы' })
  public async unpauseTrack(@Context() [ctx]: SlashCommandContext) {
    const pause = this.playerService.unpause();
    if (!pause) return ctx.reply(`Не удалось возобновить трек`);
    const track = this.playerService.getCurrentTrackName();
    ctx.reply(`${track} возобновлен`);
  }

  @SlashCommand({ name: 'menu', description: 'menu' })
  public createMenu(@Context() [ctx]: SlashCommandContext) {
    // Создаем кнопку
    const button = new ButtonBuilder()
      .setCustomId('BUTTON')
      .setLabel('LABEL')
      .setStyle(ButtonStyle.Primary);

    // Создаем ряд кнопок и добавляем кнопку в этот ряд
    const row = new ActionRowBuilder().addComponents(button);

    // Отправляем сообщение с текстом и кнопками
    return ctx.reply({
      content: '1234',
      components: [row.toJSON()], // Здесь мы передаем ряд кнопок
    });
  }
  @Button('BUTTON')
  public async onButton(@Context() [interaction]: ButtonContext) {
    // Создаем модальное окно
    const modal = new ModalBuilder()
      .setCustomId('myModal') // Уникальный идентификатор для модала
      .setTitle('My Modal Title'); // Заголовок модала

    // Создаем текстовое поле для ввода
    const textInput = new TextInputBuilder()
      .setCustomId('myTextInput') // Уникальный идентификатор для текстового поля
      .setLabel('Enter something:') // Подсказка для текстового поля
      .setStyle(TextInputStyle.Short); // Тип текстового поля (краткий)

    // Создаем ряд для текстового поля
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
      textInput,
    );

    // Добавляем ряд в модальное окно
    modal.addComponents(row);

    // Показываем модальное окно
    await interaction.showModal(modal);
  }

  @Modal('pizza')
  public onModal(@Ctx() [interaction]: ModalContext) {
    console.log(interaction);
    return;
  }
}
