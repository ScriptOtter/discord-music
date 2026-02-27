import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
} from '@discordjs/voice';
import { ActivityType } from 'discord.js';
import { SlashCommandContext } from 'necord';
import { YtDlp } from 'ytdlp-nodejs';

export class VoicePlayerService {
  private client: VoiceConnection;
  private player: AudioPlayer;
  private ytdlp: YtDlp;
  private currentTrackName: string;

  constructor() {
    this.player = createAudioPlayer();
    this.ytdlp = new YtDlp();

    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log('Playing audio!');
    });

    this.player.on('error', (error) => {
      console.error(`Error: ${error.message}`);
    });
  }

  public getCurrentTrackName(): string {
    return this.currentTrackName;
  }

  public join(channelId, guildId, adapterCreator) {
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
    this.currentTrackName = (await this.ytdlp.getInfoAsync(url)).title;
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
