import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlayerService {
  public musicStack: string[];
  constructor(private readonly configService: ConfigService) {
    this.musicStack =
      this.configService.getOrThrow<string>('TEST') === 'TEST'
        ? [
            'https://www.youtube.com/watch?v=bxplN6z8spc',
            'https://www.youtube.com/watch?v=ARzH04uXu0Q',
          ]
        : [];
  }

  public delTrack(url: string) {
    this.musicStack = this.musicStack.filter((item) => item !== url);
  }
}
