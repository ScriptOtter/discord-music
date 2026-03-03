import { Injectable } from '@nestjs/common';
import { YtDlp } from 'ytdlp-nodejs';
import { PassThrough } from 'stream';

@Injectable()
export class YoutubeService {
  private youtubeService: YtDlp;
  constructor() {
    this.youtubeService = new YtDlp();
  }

  public createStream(url: string): PassThrough {
    this.validateUrl(url);

    try {
      return this.youtubeService
        .stream(url)
        .cookies('./cookies.txt')
        .filter('audioonly')
        .getStream();
    } catch (error) {
      throw new Error(`Failed to create stream from ${url}: ${error.message}`);
    }
  }

  public async getTitle(url: string) {
    this.validateUrl(url);
    return (await this.youtubeService.getInfoAsync(url)).title;
  }
  private validateUrl(url: string): void {
    if (!url) {
      throw new Error('URL is required');
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(url)) {
      throw new Error('Invalid YouTube URL');
    }
  }
}
