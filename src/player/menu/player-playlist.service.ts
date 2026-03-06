import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'necord';
import { PlaylistService } from 'src/modules/playlist/playlist.service';
import { PlayerService } from '../player.service';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { PlaylistWithTracks } from 'src/shared/types/playlist.types';
import { ICONS } from 'src/shared/utils/icons.enum';
import { getPlaylistMenu } from '../components/playlist-menu';

@Injectable()
export class PlayerPlaylistService {
  private logger = new Logger(PlayerPlaylistService.name);
  private activeMenus: Map<string, Message> = new Map();

  public constructor(
    private readonly playlistService: PlaylistService,
    private readonly playerService: PlayerService,
  ) {}

  public async getPlaylistButtons(interaction: ButtonInteraction) {
    try {
      const playlists = await this.playlistService.getPlaylists();
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('create')
          .setLabel(`${ICONS.ADD} Создать плейлист`)
          .setStyle(ButtonStyle.Success),
      );

      if (!playlists || playlists.length === 0) {
        const message = await interaction.followUp({
          components: [row],
          embeds: [],
        });
        return this.setupCollector(message);
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`playlist_mix`)
          .setLabel(`${ICONS.DISK} Микс из всех треков`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`back`)
          .setLabel(`${ICONS.BACK} Назад`)
          .setStyle(ButtonStyle.Secondary),
      );

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      let currentRow = new ActionRowBuilder<ButtonBuilder>();
      let buttonCount = 0;

      for (const playlist of playlists) {
        const button = new ButtonBuilder()
          .setCustomId(`playlist_${playlist.id}`)
          .setLabel(`${ICONS.FAVORITE} ${playlist.name}`)
          .setStyle(ButtonStyle.Primary);

        currentRow.addComponents(button);
        buttonCount++;

        // Максимума в строке 5 кнопок
        if (buttonCount === 5 || playlist === playlists[playlists.length - 1]) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder<ButtonBuilder>();
          buttonCount = 0;
        }
      }

      const message = await interaction.followUp({
        content: '**Выберите плейлист**',
        components: [row, ...rows],
        embeds: [],
      });

      this.setupCollector(message);
    } catch (error) {}
  }

  public setupCollector(message: Message) {
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
    });
  }

  private async handleButtonInteraction(interaction: ButtonInteraction) {
    const [method, id, __, pageStr] = interaction.customId.split('_');

    if (method === 'back') {
      return await interaction.message.delete();
    }

    if (method === 'create') {
      return await this.showCreatePlaylistModal(interaction);
    }
    if (method === 'playlist' && id === 'mix') {
      const mix = await this.playlistService.getMixPlaylist();
      this.playerService.setPlaylist(mix);
      return interaction.reply({ content: 'Плейлист Mix загружен', flags: 64 });
    }

    const playlist = await this.playlistService.getPlaylistById(id);
    if (!playlist) {
      return await interaction.reply({
        content: 'Плейлист не найден',
        flags: 64,
      });
    }

    if (method === 'deletePlaylist') {
      return this.showDeletePlaylistModal(interaction, playlist.id);
    }

    if (method === 'updatePlaylist') {
      return this.showUpdatePlaylistNameModal(
        interaction,
        playlist.id,
        playlist.name,
      );
    }

    if (method === 'add') {
      return await this.showAddTracksModal(
        interaction,
        playlist as PlaylistWithTracks,
      );
    }

    if (method === 'del') {
      return await this.showDeleteTracksModal(
        interaction,
        playlist as PlaylistWithTracks,
      );
    }

    // Для остальных кнопок делаем deferUpdate
    await interaction.deferUpdate().catch(() => {});

    try {
      if (method === 'set') {
        await interaction.deleteReply(interaction.message);
        return await this.setPlaylist(interaction, id);
      }

      if (method === 'back') {
        await interaction.deleteReply(interaction.message);
        await this.getPlaylistButtons(interaction);
      }

      if (method === 'playlist') {
        await this.showPlaylistMenu(
          interaction,
          playlist as PlaylistWithTracks,
          parseInt(pageStr),
        );
      }
    } catch (error) {
      this.logger.error(`Error in action playlist_${id}: ${error.message}`);
    }
  }

  public async updatePlaylistMenu(
    interaction: ModalSubmitInteraction | ButtonInteraction,
    playlist: PlaylistWithTracks,
  ) {
    try {
      const updatedPlaylist = (await this.playlistService.getPlaylistById(
        playlist.id,
      )) as PlaylistWithTracks;

      let messageToUpdate: Message | null = null;

      if (interaction instanceof ButtonInteraction) {
        messageToUpdate = interaction.message;
      } else {
        const channel = interaction.channel;
        if (channel) {
          const messages = await channel.messages.fetch({ limit: 10 });
          messageToUpdate =
            messages.find(
              (m) =>
                m.embeds.length > 0 &&
                m.embeds[0].title?.includes(playlist.name),
            ) || null;
        }
      }

      if (messageToUpdate) {
        const { embed, currentPage, totalPages } =
          this.createEmbed(updatedPlaylist);
        const components = getPlaylistMenu(
          playlist.id,
          currentPage,
          totalPages,
        );

        await messageToUpdate.edit({ embeds: [embed], components });
      }
    } catch (error) {
      this.logger.debug(`Could not update playlist menu: ${error.message}`);
    }
  }

  private async showPlaylistMenu(
    interaction: ButtonInteraction,
    playlist: PlaylistWithTracks,
    pageStr: number,
  ) {
    const { embed, currentPage, totalPages } = this.createEmbed(
      playlist,
      pageStr,
    );

    const components = getPlaylistMenu(playlist.id, currentPage, totalPages);
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.message.edit({
        embeds: [embed],
        components,
      });
    }
  }

  private createEmbed(playlist: PlaylistWithTracks, page: number = 1) {
    const itemsPerPage = 8;
    const totalPages = Math.ceil(playlist.tracks.length / itemsPerPage);

    const currentPage = Math.min(Math.max(1, page), totalPages) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(
      startIndex + itemsPerPage,
      playlist.tracks.length,
    );

    const pageTracks = playlist.tracks.slice(startIndex, endIndex);

    const fields = pageTracks.map((track) => {
      return {
        name: `${track.title}`,
        value: ['```', track.id, '```'].join('\n'),
        inline: false,
      };
    });

    if (fields.length === 0) {
      fields.push({
        name: 'Нет треков',
        value: 'Плейлист пуст',
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`🎧 Плейлист: ${playlist.name}`)
      .setDescription(
        `В плейлисте ${playlist.tracks.length} песен. (страница ${currentPage} из ${totalPages || 1})`,
      )
      .addFields(fields)
      .setFooter({
        text: `ID песни выделен черным`,
      })
      .setTimestamp();

    return { embed, currentPage, totalPages };
  }

  private async setPlaylist(
    @Context() interactive: ButtonInteraction,
    id: string,
  ) {
    try {
      const playlist = await this.playlistService.getPlaylistById(id);

      if (!playlist) {
        return await interactive.followUp({
          content: `Плейлист не найден`,
          flags: 64,
        });
      }
      const result = this.playerService.setPlaylist(playlist);

      if (!result) {
        return await interactive.followUp({
          content: `Не удалось добавить треки в плейлист`,
          flags: 64,
        });
      }
      return await interactive.followUp({
        content: `Плейлист успешно загружен)`,
        flags: 64,
      });
    } catch (error) {
      this.logger.error(`Error setting playlist: ${error.message}`);
      await interactive.followUp({
        content: `❌ Ошибка: ${error.message}`,
        flags: 64,
      });
    }
  }

  private async showCreatePlaylistModal(interaction: ButtonInteraction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('create_playlist_modal')
        .setTitle('Создать новый плейлист');

      const nameInput = new TextInputBuilder()
        .setCustomId('playlist_name')
        .setLabel('Название плейлиста')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите название плейлиста')
        .setRequired(true)
        .setMaxLength(100);

      const tracksInput = new TextInputBuilder()
        .setCustomId('tracks')
        .setLabel('Ссылки на YouTube (каждая с новой строки)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('https://youtu.be/...\nhttps://youtube.com/watch?v=...')
        .setRequired(true)
        .setMaxLength(2000);

      const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        nameInput,
      );
      const tracksRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        tracksInput,
      );

      modal.addComponents(nameRow, tracksRow);

      await interaction.showModal(modal);
    } catch (error) {
      this.logger.error(
        `Error showing create playlist modal: ${error.message}`,
      );
    }
  }

  private async showAddTracksModal(
    interaction: ButtonInteraction,
    playlist: PlaylistWithTracks,
  ) {
    try {
      const modal = new ModalBuilder()
        .setCustomId(`add_tracks_modal_${playlist.id}`)
        .setTitle(`Добавить треки в "${playlist.name}"`);

      const tracksInput = new TextInputBuilder()
        .setCustomId('tracks')
        .setLabel('Ссылки на YouTube (каждая с новой строки)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          'https://youtu.be/...\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/...',
        )
        .setRequired(true)
        .setMaxLength(2000);

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        tracksInput,
      );
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      this.logger.error(`Error showing modal: ${error.message}`);
    }
  }
  private async showDeleteTracksModal(
    interaction: ButtonInteraction,
    playlist: PlaylistWithTracks,
  ) {
    try {
      if (playlist.tracks.length === 0) {
        return await interaction.reply({
          content: '❌ В плейлисте нет треков для удаления',
          flags: 64,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`delete_tracks_modal_${playlist.id}`)
        .setTitle(`Удалить треки из "${playlist.name}"`);

      const tracksInput = new TextInputBuilder()
        .setCustomId('track_ids')
        .setLabel('ID треков для удаления')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          'Введите ID треков (каждый с новой строки)\nПример: abc123\ndef456',
        )
        .setRequired(true)
        .setMaxLength(1000);

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        tracksInput,
      );

      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      this.logger.error(`Error showing delete modal: ${error.message}`);
    }
  }

  private async showDeletePlaylistModal(
    interaction: ButtonInteraction,
    playlistId: string,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(`delete_playlist_modal_${playlistId}`)
      .setTitle('Удаление плейлиста')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Введите "да" для подтверждения')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('да')
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(3),
        ),
      );

    await interaction.showModal(modal);
  }

  private async showUpdatePlaylistNameModal(
    interaction: ButtonInteraction,
    playlistId: string,
    currentName: string,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(`update_playlist_name_modal_${playlistId}`)
      .setTitle('Обновление названия плейлиста')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('playlist_name')
            .setLabel('Новое название плейлиста')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Введите новое название...')
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(100)
            .setValue(currentName),
        ),
      );

    await interaction.showModal(modal);
  }
}
