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
import { YoutubeService } from 'src/modules/youtube/youtube.service';
import {
  PlaylistType,
  PlaylistWithTracks,
} from 'src/shared/types/playlist.types';
import { PlayerActivityService } from './menu/player-activity.service';
import { PlayerStateService } from './player-state.service';
import { PlaylistService } from 'src/modules/playlist/playlist.service';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private client: VoiceConnection | null = null;
  private player: AudioPlayer;
  private menuUpdateCallback: (() => Promise<void>) | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly youtubeService: YoutubeService,
    private readonly activityService: PlayerActivityService,
    private readonly stateService: PlayerStateService,
    private readonly playlistService: PlaylistService,
  ) {
    this.player = createAudioPlayer();
    this.setupPlayerListeners();
    this.loadTestPlaylist();
  }

  public setMenuUpdateCallback(callback: () => Promise<void>): void {
    this.menuUpdateCallback = callback;
  }

  private async triggerMenuUpdate(): Promise<void> {
    if (this.menuUpdateCallback) {
      try {
        await this.menuUpdateCallback();
      } catch (error) {
        this.logger.debug(`Failed to update menu: ${error.message}`);
      }
    }
  }

  private async loadTestPlaylist(): Promise<void> {
    const tracks = await this.playlistService.getAllTracks();
    if (!tracks) this.setPlaylist({ id: '1', name: '1', url: '12' });
    const playlist: PlaylistWithTracks = {
      id: 'mix',
      name: 'mix',
      tracks: tracks.map((track) => {
        return {
          id: track.id,
          title: track.title,
          url: track.url,
          createdAt: new Date(),
          updatedAt: new Date(),
          playlistId: 'mix',
        };
      }),
      owner: 'mix',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    {
      this.stateService.setPlaylist(playlist);
      this.logger.log('Test playlist loaded');
    }
  }

  public setPlaylist(playlist): boolean {
    this.stateService.setPlaylist(playlist);
    this.logger.log(`Плейлист "${playlist.name}" загружен`);
    return true;
  }

  private setupPlayerListeners(): void {
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.stateService.setState('Playing');
      this.stateService.setIsPlaying(true);

      const currentTrack = this.stateService.getCurrentTrack();
      if (currentTrack) {
        this.activityService.onPlaying(currentTrack.title, currentTrack.url);
        this.triggerMenuUpdate();
      }
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      this.stateService.setState('Buffering');
      this.activityService.onBuffering();
      this.triggerMenuUpdate();
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      this.stateService.setState('Paused');
      this.activityService.onPaused();
      this.triggerMenuUpdate();
    });

    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      this.stateService.setState('AutoPaused');
      this.activityService.onAutoPaused();
      this.triggerMenuUpdate();
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.stateService.setState('Idle');
      this.stateService.setIsPlaying(false);

      const hasNextTrack = !!this.stateService.getNextTrackInfo();
      this.activityService.onIdle(hasNextTrack);
      this.triggerMenuUpdate();

      if (hasNextTrack) {
        this.playNext();
      }
    });

    this.player.on('error', (error) => {
      this.stateService.setState('Idle');
      this.stateService.setIsPlaying(false);
      this.logger.error(`Player error: ${error.message}`);
      this.activityService.onError();
      this.triggerMenuUpdate();
    });
  }

  public async play(): Promise<boolean> {
    const queueInfo = this.stateService.getQueueInfo();

    if (queueInfo.totalTracks === 0) {
      this.logger.warn('Cannot play: empty playlist');
      return false;
    }

    if (this.stateService.isPlaying) {
      this.logger.warn('Already playing');
      return false;
    }

    const currentTrack = this.stateService.getCurrentTrack();
    if (currentTrack) {
      return await this.playTrack(currentTrack);
    }

    return false;
  }

  private async playTrack(track: PlaylistType): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        this.logger.log(`Loading track: ${track.title}`);

        const stream = this.youtubeService.createStream(track.url);
        const resource = createAudioResource(stream);
        this.player.play(resource);

        const onIdle = () => {
          this.player.removeListener(AudioPlayerStatus.Idle, onIdle);
          this.logger.log(`Finished: ${track.title}`);
          resolve(true);
        };

        this.player.on(AudioPlayerStatus.Idle, onIdle);
      } catch (error) {
        this.logger.error(`Failed to play: ${error.message}`);
        resolve(false);
      }
    });
  }

  private async playNext(): Promise<void> {
    const nextTrack = this.stateService.getNextTrack();
    if (nextTrack && this.stateService.state === 'Playing') {
      await this.playTrack(nextTrack);
    }
  }

  public async playPrevious(): Promise<boolean> {
    const prevTrack = this.stateService.getPreviousTrack();
    if (prevTrack && this.stateService.state === 'Playing') {
      return await this.playTrack(prevTrack);
    }
    return false;
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

  public skip(): boolean {
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

  public stop(): boolean {
    try {
      this.player.stop();
      this.stateService.clearPlaylist();
      this.logger.log('Stopped and cleared playlist');
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop: ${error.message}`);
      return false;
    }
  }

  public toggleShuffle(): boolean {
    return this.stateService.toggleShuffle();
  }

  public toggleLoop(): boolean {
    return this.stateService.toggleLoop();
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  public getQueueInfo() {
    return this.stateService.getQueueInfo();
  }

  public getUpcomingTracks() {
    return this.stateService.getUpcomingTracks();
  }

  public getHistory() {
    return this.stateService.getHistory();
  }
}
