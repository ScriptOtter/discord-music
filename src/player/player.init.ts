import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
} from '@discordjs/voice';
import { YtDlp } from 'ytdlp-nodejs';

export class VoicePlayerService {
  private client: VoiceConnection;
  private player: AudioPlayer;
  private ytdlp: YtDlp;
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

  public async playAudio(url: string): Promise<void> {
    const fs = require('fs');
    const cookieFilePath = './cookies.txt';
    const cookies = fs.readFileSync(cookieFilePath, 'utf-8');
    console.log(cookies);
    return new Promise((resolve, reject) => {
      try {
        const stream = this.ytdlp
          .stream(url)
          .cookies('./cookies.txt')
          .filter('audioonly')
          .getStream();
        const resource = createAudioResource(stream);
        this.player.play(resource);

        this.player.on(AudioPlayerStatus.Idle, () => {
          console.log('Audio finished playing!');
          resolve();
        });
      } catch (error) {
        console.error(`Failed to play audio: ${error.message}`);
        reject();
      }
    });
  }
}
