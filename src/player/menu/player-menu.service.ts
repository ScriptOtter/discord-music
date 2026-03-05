import { Injectable, Logger } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { PlayerService } from '../player.service';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  ComponentType,
  EmbedBuilder,
  ButtonInteraction,
  VoiceChannel,
  GuildMember,
} from 'discord.js';
import { PlayerState } from 'src/shared/types/player-state.types';
import { PlayerStateService } from '../player-state.service';
import { PlayerPlaylistService } from './player-playlist.service';
import { ICONS } from 'src/shared/utils/icons.enum';

@Injectable()
export class PlayerMenuService {
  private readonly logger = new Logger(PlayerMenuService.name);
  private activeMenus: Map<string, Message> = new Map();

  constructor(
    private readonly playerService: PlayerService,
    private readonly stateService: PlayerStateService,
    private readonly playlistService: PlayerPlaylistService,
  ) {
    this.playerService.setMenuUpdateCallback(this.updateAllMenus.bind(this));
  }

  private async updateAllMenus(): Promise<void> {
    const updatePromises = Array.from(this.activeMenus.entries()).map(
      async ([channelId, message]) => {
        try {
          const embed = this.createPlayerEmbed();
          const components = this.createPlayerControls();

          await message.edit({
            embeds: [embed],
            components,
          });
        } catch (error) {
          this.logger.debug(
            `Failed to update menu in channel ${channelId}: ${error.message}`,
          );
          this.activeMenus.delete(channelId);
        }
      },
    );

    await Promise.allSettled(updatePromises);
  }

  public async createPlayerMenu([ctx]: SlashCommandContext) {
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
    const state = this.stateService.state;
    const currentTrack = this.stateService.getCurrentTrack();
    const remainingTracks = this.stateService.getRemainingTracks();
    const loopMod = !!this.stateService.getLoop();
    const isJoined = this.stateService.getIsJoined();
    let footerText = '';
    if (loopMod)
      footerText = `${ICONS.LOADING} Осталось треков: ${ICONS.INFINITY} `;
    else if (remainingTracks > 1)
      footerText = `${ICONS.LOADING} Осталось треков: ${remainingTracks} `;
    else if (remainingTracks === 1)
      footerText = `${ICONS.FAVORITE} Играет последний трек`;
    else footerText = `Загрузите треки из плейлиста`;
    const tracks = this.stateService.getPlaylist();
    const embed = new EmbedBuilder()
      .setColor(this.getStateColor(state))
      .setTitle(`${ICONS.HEADPHONES} Afferists Player`)
      .setDescription(
        isJoined
          ? `Плейлист: ${this.stateService.getPlaylistName()}`
          : 'Добавьте бота в канал',
      );

    if (isJoined) {
      embed
        .addFields(
          {
            name:
              state === 'Playing'
                ? `${ICONS.DISK} Сейчас играет`
                : `${ICONS.LOADING} Ожидает запуска`,
            value: currentTrack?.title || 'Ничего не играет',
            inline: false,
          },
          {
            name: `🔄 Автоповтор: ${loopMod ? '**Включен**' : '**Выключен**'}`,
            value: '',
            inline: false,
          },
        )

        .setFooter({
          text: footerText,
        })
        .setTimestamp();

      if (tracks) {
        embed.addFields([
          { name: 'Очередь треков:', value: '', inline: false },
          ...tracks.map((track) => {
            return {
              name: ``,
              value: `${track.track.title === currentTrack?.title ? ICONS.FAVORITE : '•'} ${track.track.title.slice(0, 40)}... `,
              inline: false,
            };
          }),
        ]);
      }
      if (currentTrack?.url) {
        embed.setURL(currentTrack.url);
      }
      return embed;
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

  private createPlayerControls = (): ActionRowBuilder<ButtonBuilder>[] => {
    const state = this.stateService.state;
    const hasCurrentTrack = !!this.stateService.getCurrentTrack();
    const hasPreviousTrack = !!this.stateService.getPreviousTrackInfo();
    const hasNextTrack = !!this.stateService.getNextTrackInfo();
    const loopMod = !!this.stateService.getLoop();
    const shuffleMod = !!this.stateService.getShuffle();
    const isJoined = this.stateService.getIsJoined();
    const isBuffering = state === 'Buffering';
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_join')
        .setLabel(`${ICONS.ROBOT} Закинь бота в комнату ${ICONS.ROBOT}`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(isJoined),
    );

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_previous')
        .setLabel(`${ICONS.PREV} Предыдущий`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasPreviousTrack || !isJoined || isBuffering),
      new ButtonBuilder()
        .setCustomId('player_play')
        .setLabel(`${ICONS.PLAY} Play`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(
          state === 'Playing' || !hasCurrentTrack || !isJoined || isBuffering,
        ),
      new ButtonBuilder()
        .setCustomId('player_pause')
        .setLabel(`${ICONS.PAUSE} Пауза`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state !== 'Playing' || !isJoined || isBuffering),
      new ButtonBuilder()
        .setCustomId('player_skip')
        .setLabel(`${ICONS.NEXT} Следующий`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasNextTrack || !isJoined || isBuffering),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_loop')
        .setLabel(`${ICONS.LOOP} Loop`)
        .setStyle(loopMod ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(
          shuffleMod || !isJoined || isBuffering || !hasCurrentTrack,
        ),
      new ButtonBuilder()
        .setCustomId('player_shuffle')
        .setLabel(`${ICONS.SHUFFLE} Shuffle`)
        .setStyle(shuffleMod ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(loopMod || !isJoined || isBuffering || !hasCurrentTrack),
      new ButtonBuilder()
        .setCustomId('player_clear')
        .setLabel(`${ICONS.DELETE} Clear`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(
          this.stateService.getRemainingTracks() === 0 ||
            !isJoined ||
            isBuffering,
        ),
      new ButtonBuilder()
        .setCustomId('player_refresh')
        .setLabel(`${ICONS.REFRESH} Обновить`)
        .setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_leave')
        .setLabel(`${ICONS.ROBOT} Выгнать бота из комнаты ${ICONS.ROBOT}`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(state === 'Playing'),
      new ButtonBuilder()
        .setCustomId('player_playlist')
        .setLabel(`${ICONS.HEADPHONES} Плейлист`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state === 'Playing'),
    );
    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('player_playlist')
        .setLabel(`${ICONS.HEADPHONES} Плейлист`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state === 'Playing'),
    );
    return isJoined ? [row1, row2, row3] : [row, row1, row2, row4];
  };

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
        case 'join':
          await this.handleJoin(interaction);
          break;
        case 'leave':
          await this.handleLeave(interaction);
          break;
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
        case 'playlist':
          await this.handlePlaylist(interaction);
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

  private async handlePlaylist(interaction: ButtonInteraction) {
    this.playlistService.getPlaylistButtons(interaction);
  }

  private async handleJoin(interaction: ButtonInteraction) {
    const member = interaction.member as GuildMember;
    if (!member) return;

    const voiceChannel = member.voice.channel as VoiceChannel;
    if (!voiceChannel) {
      return;
    }

    this.playerService.join(
      voiceChannel.id,
      voiceChannel.guild.id,
      voiceChannel.guild.voiceAdapterCreator,
    );
    this.stateService.toggleIsJoined();
    await this.updateMenu(interaction);
  }

  private async handleLeave(interaction: ButtonInteraction) {
    const member = interaction.member as GuildMember;
    if (!member) return;

    const voiceChannel = member.voice.channel as VoiceChannel;
    if (!voiceChannel) {
      return;
    }

    this.playerService.leave();
    this.stateService.toggleIsJoined();
    await this.updateMenu(interaction);
  }

  private async handlePlay(interaction: ButtonInteraction) {
    const hasCurrentTrack = !!this.stateService.getCurrentTrack();
    const state = this.stateService.state;

    if (!hasCurrentTrack) {
      return;
    }

    try {
      if (state === 'Idle') await this.playerService.play();
      if (state === 'Paused' || state === 'AutoPaused')
        this.playerService.unpause();
      await this.updateMenu(interaction);
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
      if (this.stateService.state !== 'Playing') {
        return;
      }

      const result = this.playerService.pause();

      if (result) {
        await this.updateMenu(interaction);
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
      if (
        this.stateService.state === 'Playing' ||
        this.stateService.state === 'Buffering'
      ) {
        this.playerService.pause();
        const result = this.playerService.skip();
        if (result) {
          this.playerService.unpause();
          await this.updateMenu(interaction);
        } else {
          await interaction
            .followUp({
              content: '❌ Не удалось пропустить трек',
              flags: 64,
            })
            .catch(() => {});
        }
      } else {
        if (this.stateService.state === 'Paused') {
          this.playerService.stop(true);
          this.stateService.getPreviousTrack();
          const hasPrevTrack = this.stateService.getPreviousTrackInfo();
          if (hasPrevTrack) this.stateService.getNextTrack();
        }

        if (this.stateService.state === 'Idle')
          this.stateService.getNextTrack();

        await this.updateMenu(interaction);
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

  private async handlePrevious(interaction: ButtonInteraction) {
    try {
      if (
        this.stateService.state === 'Playing' ||
        this.stateService.state === 'Buffering'
      ) {
        const previousTrack = this.stateService.getPreviousTrack();

        if (!previousTrack) {
          return;
        }

        if (previousTrack) {
          this.playerService.pause();
          this.stateService.getPreviousTrack();
          this.playerService.skip();
          this.playerService.unpause();
          await this.updateMenu(interaction);
        } else {
          await interaction
            .followUp({
              content: '❌ Не удалось переключить на предыдущий трек',
              flags: 64,
            })
            .catch(() => {});
        }
      } else {
        if (this.stateService.state === 'Paused') {
          this.playerService.stop(true);
        }

        if (this.stateService.state === 'Idle') {
          this.stateService.getPreviousTrack();
        }
        await this.updateMenu(interaction);
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
      this.stateService.toggleLoop();
      await this.updateMenu(interaction);
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
      this.stateService.toggleShuffle();
      await this.updateMenu(interaction);
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
      this.stateService.clearPlaylist();
      this.playerService.stop(true);
      await this.updateMenu(interaction);
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
