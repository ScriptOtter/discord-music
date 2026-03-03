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
import { PlaylistType } from 'src/shared/types/playlist.types';
import { PlayerActivityService } from './player-activity.service';
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

    this.loadTestPlaylist();
    this.setupPlayerListeners();
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
  public setPlaylist(playlist: PlaylistType[]): boolean {
    this.stateService.clearPlaylist();
    this.stateService.currentIndex = 0;

    this.stateService.setPlaylist(playlist);
    this.logger.log('Плейлист добавлен');
    return true;
  }

  private async loadTestPlaylist(): Promise<void> {
    const playlist = await this.playlistService.getAllTracks();
    if (playlist) this.setPlaylist([...playlist]);
  }

  private setupPlayerListeners(): void {
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.stateService.setState('Playing');
      this.stateService.setIsPlaying(true);

      const currentTrack = this.stateService.getCurrentTrack();
      if (currentTrack) {
        this.logger.log(`Playing: ${currentTrack.title}`);
        this.activityService.onPlaying(currentTrack.title, currentTrack.url);
        this.triggerMenuUpdate();
      }
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      this.stateService.setState('Buffering');
      this.logger.log('Buffering...');
      this.activityService.onBuffering();
      this.triggerMenuUpdate();
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      this.stateService.setState('Paused');
      this.logger.log('Paused');
      this.activityService.onPaused();
      this.triggerMenuUpdate();
    });

    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      this.stateService.setState('AutoPaused');
      this.logger.warn('AutoPaused');
      this.activityService.onAutoPaused();
      this.triggerMenuUpdate();
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.stateService.setState('Idle');
      this.stateService.setIsPlaying(false);
      this.logger.log('Finished playing');
      this.triggerMenuUpdate();

      const hasNextTrack = !!this.stateService.getNextTrack();
      this.activityService.onIdle(hasNextTrack);

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
  private async playNext(): Promise<void> {
    const nextTrack = this.stateService.getNextTrack();
    if (nextTrack) {
      await this.playTrack(nextTrack);
    }
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
    if (this.stateService.playlist.length === 0) {
      this.logger.warn('Cannot play: empty playlist');
      return false;
    }

    if (this.stateService.isPlaying) {
      this.logger.warn('Already playing');
      return false;
    }

    while (this.stateService.currentIndex < this.stateService.playlist.length) {
      let index = this.stateService.currentIndex;
      if (index < 0) {
        this.stateService.currentIndex = 0;
        continue;
      }

      if (this.stateService.shuffle) {
        const randomIndex = Math.floor(
          Math.random() * this.stateService.playlist.length,
        );
        const success = await this.playTrack(
          this.stateService.playlist[randomIndex],
        );
        if (!success) break;
      } else {
        const track = this.stateService.playlist[index];
        console.log(track, index);
        const success = await this.playTrack(track);
        if (!success) break;

        if (!this.stateService.loop) {
          this.stateService.incrementCurrentIndex();
        }
      }
    }
    return true;
  }

  private async playTrack(track: PlaylistType): Promise<boolean> {
    const { title, url } = track;
    return new Promise(async (resolve) => {
      try {
        this.logger.log(`Loading track: ${track.url}`);

        this.stateService.currentTrack = {
          title,
          url,
        };
        await this.triggerMenuUpdate();
        const stream = this.youtubeService.createStream(track.url);
        const resource = createAudioResource(stream);
        this.player.play(resource);

        const onIdle = () => {
          this.player.removeListener(AudioPlayerStatus.Idle, onIdle);
          this.stateService.state = 'Idle';
          this.stateService.currentTrack = null;
          this.logger.log(`Finished: ${title}`);
          resolve(true);
        };

        this.player.on(AudioPlayerStatus.Idle, onIdle);
      } catch (error) {
        this.logger.error(`Failed to play: ${error.message}`);
        this.stateService.currentTrack = null;
        await this.triggerMenuUpdate();

        resolve(false);
      }
    });
  }

  public setLoop(): boolean {
    return this.stateService.toggleLoop();
  }

  public getLoop(): boolean {
    return this.stateService.getLoop();
  }

  public setShuffle(): boolean {
    return this.stateService.toggleShuffle();
  }

  public getShuffle(): boolean {
    return this.stateService.getShuffle();
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
    this.stateService.clearPlaylist();
    this.logger.log('Playlist cleared');
  }
}
