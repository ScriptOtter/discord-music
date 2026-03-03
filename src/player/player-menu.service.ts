import { Injectable, Logger } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { PlayerService } from './player.service';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  ComponentType,
  EmbedBuilder,
  ButtonInteraction,
} from 'discord.js';
import { PlayerState } from 'src/shared/types/player-state.types';

@Injectable()
export class PlayerMenuService {
  private readonly logger = new Logger(PlayerMenuService.name);
  private activeMenus: Map<string, Message> = new Map();

  constructor(private readonly playerService: PlayerService) {}

  @SlashCommand({
    name: 'player',
    description: 'Открыть меню управления плеером',
  })
  public async createPlayerMenu(@Context() [ctx]: SlashCommandContext) {
    try {
      const embed = this.createPlayerEmbed();
      const components = this.createPlayerControls();

      const reply = await ctx.reply({
        embeds: [embed],
        components,
        withResponse: true,
      });

      const message = reply.resource?.message;
      if (message) {
        this.activeMenus.set(message.channelId, message);
        this.setupCollector(message);
      }

      return reply;
    } catch (error) {
      this.logger.error(`Failed to create player menu: ${error.message}`);
      throw error;
    }
  }

  private createPlayerEmbed(): EmbedBuilder {
    const state = this.playerService.state;
    const currentTrack = this.playerService.getCurrentTrack();
    const nextTrack = this.playerService.getNextTrack();
    const previousTrack = this.playerService.getPrevioutsTrack();
    const remainingCount = this.playerService.getRemainingTracksCount();

    const embed = new EmbedBuilder()
      .setColor(this.getStateColor(state))
      .setTitle('🎵 Afferists Player')
      .setDescription(this.getStateDescription(state))
      .addFields(
        {
          name: '💿 Сейчас играет',
          value: currentTrack?.title || 'Ничего не играет',
          inline: false,
        },
        {
          name: '⏮ Предыдущий трек',
          value: previousTrack?.title || 'Нет предыдущего трека',
          inline: true,
        },
        {
          name: '⏭ Следующий трек',
          value: nextTrack?.title || 'Нет в очереди',
          inline: true,
        },
        {
          name: `🔄 Автоповтор: ${this.playerService.getLoop() ? '**Включен**' : '**Выключен**'}`,
          value: '',
          inline: false,
        },
        {
          name: `🔀 Микс: ${this.playerService.getShuffle() ? '**Включен**' : '**Выключен**'}`,
          value: '',
          inline: false,
        },
      )
      .setFooter({ text: `⏳ Осталось треков: ${remainingCount}` })
      .setTimestamp();

    if (currentTrack?.url) {
      embed.setURL(currentTrack.url);
    }

    return embed;
  }

  private getStateColor(state: PlayerState): number {
    const colors = {
      Playing: 0x00ff00,
      Paused: 0xffff00,
      Buffering: 0xffa500,
      Idle: 0x808080,
      AutoPaused: 0xff0000,
    };
    return colors[state] || 0x0099ff;
  }

  private getStateDescription(state: PlayerState): string {
    const descriptions = {
      Playing: '▶️ Сейчас воспроизводится',
      Paused: '⏸ На паузе',
      Buffering: '⏳ Буферизация...',
      Idle: '⏹ Ожидание',
      AutoPaused: '⚠ Автопауза',
    };
    return descriptions[state] || 'Статус неизвестен';
  }

  private createPlayerControls(): ActionRowBuilder<ButtonBuilder>[] {
    const state = this.playerService.state;
    const hasCurrentTrack = !!this.playerService.getCurrentTrack();
    const hasPreviousTrack = !!this.playerService.getPrevioutsTrack();
    const hasNextTrack = !!this.playerService.getNextTrack();
    const loopMod = !!this.playerService.getLoop();
    const shuffleMod = !!this.playerService.getShuffle();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_previous')
        .setLabel('⏮ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasPreviousTrack || shuffleMod),
      new ButtonBuilder()
        .setCustomId('player_play')
        .setLabel('▶️ Play')
        .setStyle(ButtonStyle.Success)
        .setDisabled(state === 'Playing' || !hasCurrentTrack),
      new ButtonBuilder()
        .setCustomId('player_pause')
        .setLabel('⏸ Pause')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state !== 'Playing'),
      new ButtonBuilder()
        .setCustomId('player_skip')
        .setLabel('⏭ Skip')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasNextTrack),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_loop')
        .setLabel('🔄 Loop')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shuffleMod),
      new ButtonBuilder()
        .setCustomId('player_shuffle')
        .setLabel('🔀 Shuffle')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(loopMod),
      new ButtonBuilder()
        .setCustomId('player_clear')
        .setLabel('🗑 Clear')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(this.playerService.playlist.length === 0),
      new ButtonBuilder()
        .setCustomId('player_refresh')
        .setLabel('🔄 Обновить')
        .setStyle(ButtonStyle.Secondary),
    );

    return [row1, row2];
  }

  private setupCollector(message: Message) {
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 900000,
    });

    collector.on('collect', async (interaction: ButtonInteraction) => {
      try {
        await this.handleButtonInteraction(interaction);
      } catch (error) {
        this.logger.error(`Error handling button: ${error.message}`);

        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction
              .reply({
                content: '❌ Произошла ошибка при выполнении команды',
                flags: 64,
              })
              .catch(() => {});
          }
        } catch (replyError) {
          this.logger.debug('Could not reply to expired interaction');
        }
      }
    });

    collector.on('end', () => {
      this.activeMenus.delete(message.channelId);

      message
        .edit({
          components: [this.createExpiredMenu()],
        })
        .catch(() => {});
    });
  }

  private createExpiredMenu(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_expired')
        .setLabel('⌛ Меню неактивно. Используйте /player')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
  }

  private async handleButtonInteraction(interaction: ButtonInteraction) {
    const [_, action] = interaction.customId.split('_');

    await interaction.deferUpdate().catch((error) => {
      this.logger.debug(`Could not defer interaction: ${error.message}`);
      return;
    });

    try {
      switch (action) {
        case 'play':
          await this.handlePlay(interaction);
          break;
        case 'pause':
          await this.handlePause(interaction);
          break;
        case 'skip':
          await this.handleSkip(interaction);
          break;
        case 'previous':
          await this.handlePrevious(interaction);
          break;
        case 'loop':
          await this.handleLoop(interaction);
          break;
        case 'shuffle':
          await this.handleShuffle(interaction);
          break;
        case 'clear':
          await this.handleClear(interaction);
          break;
        case 'refresh':
          await this.handleRefresh(interaction);
          break;
        default:
          await interaction
            .followUp({
              content: '❌ Неизвестная команда',
              flags: 64,
            })
            .catch(() => {});
      }
    } catch (error) {
      this.logger.error(`Error in action ${action}: ${error.message}`);

      try {
        await interaction
          .followUp({
            content: `❌ Ошибка: ${error.message}`,
            flags: 64,
          })
          .catch(() => {});
      } catch (followUpError) {
        this.logger.debug(
          `Could not send error follow-up: ${followUpError.message}`,
        );
      }
    }
  }

  private async handlePlay(interaction: ButtonInteraction) {
    const hasCurrentTrack = this.playerService.getCurrentTrack();

    if (!hasCurrentTrack) {
      await interaction
        .followUp({
          content: '❌ Нет треков в очереди',
          flags: 64,
        })
        .catch(() => {});
      return;
    }

    try {
      if (this.playerService.state === 'Idle')
        await this.playerService.playAudio();
      if (
        this.playerService.state === 'Paused' ||
        this.playerService.state === 'AutoPaused'
      )
        this.playerService.unpause();

      await this.updateMenu(interaction);

      await interaction
        .followUp({
          content: '▶️ Воспроизведение возобновлено',
          flags: 64,
        })
        .catch(() => {});
    } catch (error) {
      this.logger.error(`Play error: ${error.message}`);
      await interaction
        .followUp({
          content: `❌ Ошибка воспроизведения: ${error.message}`,
          flags: 64,
        })
        .catch(() => {});
    }
  }

  private async handlePause(interaction: ButtonInteraction) {
    try {
      if (this.playerService.state !== 'Playing') {
        await interaction
          .followUp({
            content: '❌ Нет активного воспроизведения',
            flags: 64,
          })
          .catch(() => {});
        return;
      }

      const result = this.playerService.pause();

      if (result) {
        await this.updateMenu(interaction);

        await interaction
          .followUp({
            content: '⏸ Воспроизведение приостановлено',
            flags: 64,
          })
          .catch(() => {});
      } else {
        await interaction
          .followUp({
            content: '❌ Не удалось поставить на паузу',
            flags: 64,
          })
          .catch(() => {});
      }
    } catch (error) {
      this.logger.error(`Pause error: ${error.message}`);
      await interaction
        .followUp({
          content: '❌ Ошибка при паузе',
          flags: 64,
        })
        .catch(() => {});
    }
  }

  private async handleSkip(interaction: ButtonInteraction) {
    try {
      const skippedTrack = this.playerService.getCurrentTrack()?.title;
      const result = this.playerService.skipTrack();

      if (result) {
        await this.updateMenu(interaction);

        await interaction
          .followUp({
            content: skippedTrack
              ? `⏭ Трек "${skippedTrack}" пропущен`
              : '⏭ Трек пропущен',
            flags: 64,
          })
          .catch(() => {});
      } else {
        await interaction
          .followUp({
            content: '❌ Не удалось пропустить трек',
            flags: 64,
          })
          .catch(() => {});
      }
    } catch (error) {
      this.logger.error(`Skip error: ${error.message}`);
      await interaction
        .followUp({
          content: `❌ Ошибка: ${error.message}`,
          flags: 64,
        })
        .catch(() => {});
    }
  }

  // Новый обработчик для предыдущего трека
  private async handlePrevious(interaction: ButtonInteraction) {
    try {
      const previousTrack = this.playerService.getPrevioutsTrack();

      if (!previousTrack) {
        await interaction
          .followUp({
            content: '❌ Нет предыдущего трека',
            flags: 64,
          })
          .catch(() => {});
        return;
      }

      if (previousTrack) {
        this.playerService.setPreviousTrack();
        this.playerService.skipTrack();
        await this.updateMenu(interaction);

        await interaction
          .followUp({
            content: `⏮ Воспроизводится предыдущий трек: "${previousTrack.title}"`,
            flags: 64,
          })
          .catch(() => {});
      } else {
        await interaction
          .followUp({
            content: '❌ Не удалось переключить на предыдущий трек',
            flags: 64,
          })
          .catch(() => {});
      }
    } catch (error) {
      this.logger.error(`Previous error: ${error.message}`);
      await interaction
        .followUp({
          content: `❌ Ошибка: ${error.message}`,
          flags: 64,
        })
        .catch(() => {});
    }
  }

  private async handleLoop(interaction: ButtonInteraction) {
    try {
      const currentTrack = this.playerService.getCurrentTrack()?.title;
      const result = this.playerService.setLoop();

      await this.updateMenu(interaction);

      await interaction
        .followUp({
          content: result
            ? `Трек "${currentTrack}" поставлен на повтор`
            : 'Режим Loop отключен',
          flags: 64,
        })
        .catch(() => {});
    } catch (error) {
      this.logger.error(`Loop error: ${error.message}`);
      await interaction
        .followUp({
          content: `❌ Ошибка: ${error.message}`,
          flags: 64,
        })
        .catch(() => {});
    }
  }

  private async handleShuffle(interaction: ButtonInteraction) {
    try {
      const result = this.playerService.setShuffle();

      await this.updateMenu(interaction);

      await interaction
        .followUp({
          content: result ? `Включен микс режим` : 'Режим микс выключен',
          flags: 64,
        })
        .catch(() => {});
    } catch (error) {
      this.logger.error(`Shuffle error: ${error.message}`);
      await interaction
        .followUp({
          content: `❌ Ошибка: ${error.message}`,
          flags: 64,
        })
        .catch(() => {});
    }
  }

  private async handleClear(interaction: ButtonInteraction) {
    try {
      this.playerService.clearPlaylist();
      await this.updateMenu(interaction);

      await interaction
        .followUp({
          content: '🗑 Плейлист очищен',
          flags: 64,
        })
        .catch(() => {});
    } catch (error) {
      this.logger.error(`Clear error: ${error.message}`);
      await interaction
        .followUp({
          content: `❌ Ошибка: ${error.message}`,
          flags: 64,
        })
        .catch(() => {});
    }
  }

  private async handleRefresh(interaction: ButtonInteraction) {
    await this.updateMenu(interaction);

    await interaction
      .followUp({
        content: '🔄 Меню обновлено',
        flags: 64,
      })
      .catch(() => {});
  }

  private async updateMenu(interaction: ButtonInteraction) {
    try {
      const embed = this.createPlayerEmbed();
      const components = this.createPlayerControls();

      await interaction.message.edit({
        embeds: [embed],
        components,
      });
    } catch (error) {
      this.logger.error(`Failed to update menu: ${error.message}`);
    }
  }
}
