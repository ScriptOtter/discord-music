import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
  VoiceConnection,
} from '@discordjs/voice';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType } from 'discord.js';
import { SlashCommandContext } from 'necord';
import { getYoutubeTitle } from 'src/shared/utils/youtube.utils';
import { YtDlp } from 'ytdlp-nodejs';

@Injectable()
export class PlayerService {
  private client: VoiceConnection;
  private player: AudioPlayer;
  private ytdlp: YtDlp;
  private currentTrackName: string;
  public playlist: string[];
  public state: keyof typeof AudioPlayerStatus;

  constructor(private readonly configService: ConfigService) {
    this.player = createAudioPlayer();
    this.ytdlp = new YtDlp();
    this.playlist =
      this.configService.getOrThrow<string>('TEST') === 'TEST'
        ? [
            'https://www.youtube.com/watch?v=bxplN6z8spc',
            'https://www.youtube.com/watch?v=ARzH04uXu0Q',
          ]
        : [];
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.state = 'Playing';
      console.log('Playing audio!');
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      this.state = 'Buffering';
      console.log('Buffering!');
    });

    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      this.state = 'AutoPaused';
      console.log('Autopaused!');
    });

    this.player.on('error', (error) => {
      this.state = 'Idle';
      console.error(`Error: ${error.message}`);
    });
  }

  public deleteTrackFromPlaylist(url: string) {
    this.playlist = this.playlist.filter((item) => item !== url);
  }

  public getCurrentTrackName(): string {
    return this.currentTrackName;
  }

  public join(
    channelId: string,
    guildId: string,
    adapterCreator: DiscordGatewayAdapterCreator,
  ) {
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
    } catch (e) {
      console.log(e);
    }
  }

  public leave() {
    try {
      return this.client.disconnect();
    } catch (e) {
      console.log(e);
    }
  }

  private async setCurrentTrackName(url: string): Promise<void> {
    this.currentTrackName = await getYoutubeTitle(url);
  }

  public async playAudio(
    url: string,
    [ctx]: SlashCommandContext,
  ): Promise<void> {
    await this.setCurrentTrackName(url);

    ctx.client.user.setActivity({
      name: `${this.currentTrackName}`,
      state: 'Играет музыка',
      type: ActivityType.Streaming,
      url: url,
    });

    return new Promise(async (resolve, reject) => {
      try {
        const stream = this.ytdlp
          .stream(url)
          .cookies('./cookies.txt')
          .filter('audioonly')
          .getStream();

        const resource = createAudioResource(stream);
        this.player.play(resource);

        this.player.on(AudioPlayerStatus.Idle, () => {
          this.state = 'Idle';
          this.currentTrackName = '';
          ctx.client.user.setActivity();
          resolve();
        });
      } catch (error) {
        console.error(`Failed to play audio: ${error.message}`);
        this.currentTrackName = '';
        reject();
      }
    });
  }

  public unpause(): boolean {
    return this.player.unpause();
  }

  public pause() {
    return this.player.pause();
  }

  public skipTrack() {
    return this.player.stop();
  }
}
