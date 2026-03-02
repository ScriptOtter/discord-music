import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
  VoiceConnection,
} from '@discordjs/voice';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType, Client } from 'discord.js';
import { PlayerState } from 'src/shared/types/player-state.types';
import { PlaylistType } from 'src/shared/types/playlist.types';
import { getYoutubeTitle } from 'src/shared/utils/youtube.utils';
import { YtDlp } from 'ytdlp-nodejs';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private discordClient: Client;
  private client: VoiceConnection | null = null;
  private player: AudioPlayer;
  private ytdlp: YtDlp;
  private currentTrack: PlaylistType | null = null;
  public playlist: PlaylistType[] = [];
  public state: PlayerState = 'Idle';
  private isPlaying: boolean = false;
  private currentIndex = 0;

  constructor(private readonly configService: ConfigService) {
    this.player = createAudioPlayer();
    this.ytdlp = new YtDlp();

    this.loadTestPlaylist();
    this.setupPlayerListeners();
  }
  public setDiscordClient(client: Client): void {
    this.discordClient = client;
    this.logger.log('Discord client set successfully');
  }
  private loadTestPlaylist(): void {
    if (this.configService.get<string>('TEST') === 'TEST') {
      this.playlist = [
        {
          url: 'https://www.youtube.com/watch?v=bxplN6z8spc',
          title: 'Первый трек',
        },
        {
          url: 'https://www.youtube.com/watch?v=ARzH04uXu0Q',
          title: 'Второй трек',
        },
        {
          url: 'https://www.youtube.com/watch?v=TzE6o8BzNhI',
          title: '3 трек',
        },
        {
          url: 'https://www.youtube.com/watch?v=Nns2DwUM-Jg&pp=0gcJCb4KAYcqIYzv',
          title: '4 трек',
        },
      ];
    }
  }

  private setupPlayerListeners(): void {
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.state = 'Playing';
      this.isPlaying = true;
      this.logger.log(`Playing: ${this.currentTrack?.title}`);

      this.discordClient?.user?.setActivity({
        name: this.currentTrack?.title || 'Unknown track',
        state: '🎵 Играет музыка',
        type: ActivityType.Streaming,
        url: this.currentTrack?.url,
      });
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      this.state = 'Buffering';
      this.logger.log('Buffering...');

      // Можно установить статус буферизации
      if (this.discordClient?.user) {
        try {
          this.discordClient.user.setActivity({
            name: 'Буферизация...',
            state: '⏳ Загрузка трека',
            type: ActivityType.Streaming,
          });
        } catch (error) {
          this.logger.error(`Failed to set activity: ${error.message}`);
        }
      }
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      this.state = 'Paused';
      this.logger.log('Paused');

      // Устанавливаем статус паузы
      if (this.discordClient?.user) {
        try {
          this.discordClient.user.setActivity({
            name: 'На паузе',
            state: '⏸ Музыка на паузе',
            type: ActivityType.Streaming,
          });
        } catch (error) {
          this.logger.error(`Failed to set activity: ${error.message}`);
        }
      }
    });

    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      this.state = 'AutoPaused';
      this.logger.warn('AutoPaused');

      // Статус автопаузы
      if (this.discordClient?.user) {
        try {
          this.discordClient.user.setActivity({
            name: 'Автопауза',
            state: '⚠ Проблемы с соединением',
            type: ActivityType.Streaming,
          });
        } catch (error) {
          this.logger.error(`Failed to set activity: ${error.message}`);
        }
      }
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.state = 'Idle';
      this.isPlaying = false;
      this.logger.log('Finished playing');

      // Сбрасываем activity или устанавливаем статус ожидания
      if (this.discordClient?.user) {
        try {
          // Проверяем, есть ли еще треки в плейлисте
          if (
            this.playlist.length > 0 &&
            this.currentIndex < this.playlist.length - 1
          ) {
            this.discordClient.user.setActivity({
              name: 'Ожидание следующего трека',
              state: '⏳ Скоро заиграет...',
              type: ActivityType.Streaming,
            });
          } else {
            // Если плейлист пуст или закончился, сбрасываем активность
            this.discordClient.user.setActivity();
          }
        } catch (error) {
          this.logger.error(`Failed to set activity: ${error.message}`);
        }
      }
    });

    this.player.on('error', (error) => {
      this.state = 'Idle';
      this.isPlaying = false;
      this.logger.error(`Player error: ${error.message}`);
      this.logger.debug(`Player status: ${this.player.state.status}`);

      // Устанавливаем статус ошибки
      if (this.discordClient?.user) {
        try {
          this.discordClient.user.setActivity({
            name: 'Ошибка воспроизведения',
            state: '❌ Произошла ошибка',
            type: ActivityType.Streaming,
          });

          // Сбрасываем через 5 секунд
          setTimeout(() => {
            if (this.discordClient?.user && this.state === 'Idle') {
              this.discordClient.user.setActivity();
            }
          }, 5000);
        } catch (activityError) {
          this.logger.error(`Failed to set activity: ${activityError.message}`);
        }
      }
    });
  }
  public deleteTrackFromPlaylist(title: string): void {
    this.playlist = this.playlist.filter((item) => item.title !== title);
    this.logger.log(`Removed track: ${title}`);
  }

  public getRemainingTracksCount(): number {
    if (this.playlist.length === 0) return 0;
    const index = this.playlist.findIndex(
      (track) => track.url === this.currentTrack?.url,
    );

    return this.playlist.length - index;
  }

  public getCurrentTrack(): PlaylistType | null {
    if (this.playlist.length === 0) return null;
    if (!this.currentTrack) {
      this.currentTrack = this.playlist[0];
    }
    return this.currentTrack;
  }

  public getPrevioutsTrack(): PlaylistType | null {
    if (this.currentTrack?.url === this.playlist[0].url) return null;

    const index = this.playlist.findIndex(
      (track) => track.url === this.currentTrack?.url,
    );

    if (index === -1 || index >= this.playlist.length) return null;

    return this.playlist[index - 1];
  }

  public getNextTrack(): PlaylistType | null {
    if (!this.currentTrack || this.playlist.length === 0) return null;

    const index = this.playlist.findIndex(
      (track) => track.url === this.currentTrack?.url,
    );

    if (index === -1 || index >= this.playlist.length - 1) return null;
    return this.playlist[index + 1];
  }

  public setPreviousTrack(): boolean | null {
    this.currentIndex -= 2;
    return true;
  }

  public join(
    channelId: string,
    guildId: string,
    adapterCreator: DiscordGatewayAdapterCreator,
  ): boolean {
    try {
      if (this.client) {
        this.client.disconnect();
      }

      this.client = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator,
      });

      this.client.subscribe(this.player);
      this.logger.log(`Joined voice channel: ${channelId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to join: ${error.message}`);
      return false;
    }
  }

  public leave(): boolean {
    try {
      if (this.client) {
        this.client.disconnect();
        this.client = null;
        this.logger.log('Left voice channel');
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to leave: ${error.message}`);
      return false;
    }
  }

  public async playAudio(): Promise<boolean> {
    if (this.playlist.length === 0) {
      this.logger.warn('Cannot play: empty playlist');
      return false;
    }

    if (this.isPlaying) {
      this.logger.warn('Already playing');
      return false;
    }

    for (
      this.currentIndex;
      this.currentIndex < this.playlist.length;
      this.currentIndex++
    ) {
      const track = this.playlist[this.currentIndex];

      const success = await this.playTrack(track);
      if (!success) break;
    }
    return true;
  }
  catch(error) {
    this.logger.error(`Playback failed: ${error.message}`);
    return false;
  }

  private async playTrack(track: PlaylistType): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        this.logger.log(`Loading track: ${track.url}`);

        const title = await getYoutubeTitle(track.url);
        this.currentTrack = {
          title,
          url: track.url,
        };

        const stream = this.ytdlp
          .stream(track.url)
          .cookies('./cookies.txt')
          .filter('audioonly')
          .getStream();

        const resource = createAudioResource(stream);
        this.player.play(resource);

        const onIdle = () => {
          this.player.removeListener(AudioPlayerStatus.Idle, onIdle);
          this.state = 'Idle';
          this.currentTrack = null;
          this.logger.log(`Finished: ${title}`);
          resolve(true);
        };

        this.player.on(AudioPlayerStatus.Idle, onIdle);
      } catch (error) {
        this.logger.error(`Failed to play: ${error.message}`);
        this.currentTrack = null;
        resolve(false);
      }
    });
  }

  public unpause(): boolean {
    try {
      const result = this.player.unpause();
      if (result) {
        this.logger.log('Unpaused');
      }
      return result;
    } catch (error) {
      this.logger.error(`Failed to unpause: ${error.message}`);
      return false;
    }
  }

  public pause(): boolean {
    try {
      const result = this.player.pause();
      if (result) {
        this.logger.log('Paused');
      }
      return result;
    } catch (error) {
      this.logger.error(`Failed to pause: ${error.message}`);
      return false;
    }
  }

  public skipTrack(): boolean {
    try {
      const result = this.player.stop();
      if (result) {
        this.logger.log('Skipped track');
      }
      return result;
    } catch (error) {
      this.logger.error(`Failed to skip: ${error.message}`);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  public clearPlaylist(): void {
    this.playlist = [];
    this.currentTrack = null;
    this.logger.log('Playlist cleared');
  }
}
