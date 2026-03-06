import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { PlayerMenuService } from './menu/player-menu.service';
import { ChannelType, EmbedBuilder, TextChannel } from 'discord.js';
import { ICONS } from 'src/shared/utils/icons.enum';

@Injectable()
export class PlayerCommandService {
  constructor(private readonly menuService: PlayerMenuService) {}

  @SlashCommand({
    name: 'player',
    description: 'Открыть меню управления плеером',
  })
  private async createMenu(@Context() [interaction]: SlashCommandContext) {
    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ Эта команда работает только в текстовых каналах',
        ephemeral: true,
      });
    }

    const textChannel = channel as TextChannel;

    const botId = interaction.client.user.id;

    const messages = await textChannel.messages.fetch({ limit: 100 });

    const botMessages = messages.filter((msg) => msg.author.id === botId);
    console.log(botMessages);
    await textChannel.bulkDelete(botMessages, true);

    await this.menuService.createPlayerMenu([interaction]);
  }

  @SlashCommand({
    name: 'rules',
    description: 'Показать инструкцию по использованию бота',
  })
  async onRules(@Context() [interaction]: SlashCommandContext) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${ICONS.PLAYLIST} Музыкальный бот — полная инструкция`)
      .setDescription(
        'Управление ботом — **только через кнопки в плеере**. Бота перемещать **нельзя**.',
      )
      .addFields([
        {
          name: `${ICONS.JOYSTICK} Кнопки плеера`,
          value: [
            `${ICONS.LOOP} **Автоповтор** — зацикливает текущий трек`,
            `${ICONS.SHUFFLE} **Перемешать** — перемешивает только текущую очередь`,
            `${ICONS.CLEAR} **Очистить** — удаляет плейлист из очереди`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '',
          value: '',
          inline: false,
        },
        {
          name: '📚 Плейлисты',
          value: [
            `${ICONS.ADD} Создавать — могут все`,
            `${ICONS.DELETE} Удалять — **только создатель** (необратимо!)`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '',
          value: '',
          inline: false,
        },
        {
          name: `${ICONS.ADD} Добавление треков`,
          value: [
            '• **Ссылки YouTube** — каждая с новой строки',
            '• **Плейлисты YouTube** — проверяйте название!',
            '• **Добавить несколько через Enter**',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${ICONS.WARNING} Важно! Плейлисты YouTube`,
          value:
            'Если в названии есть **"Джем"** или **"Плейлист, созданный специально для вас"** — бот добавит **до 100 треков в плейлист**!',
          inline: false,
        },
        {
          name: `${ICONS.DELETE} Удаление треков`,
          value: [
            'Введите **ID треков** через Enter:',
            '```',
            '-128fsfs-jhgjgh',
            '-13fsfss-jhghjgjh',
            '```',
            'ID выделены **\`чёрным фоном\`** в плейлисте',
          ].join('\n'),
          inline: false,
        },
      ])
      .setFooter({
        text: 'Приятного прослушивания!',
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  }
}
