import { Injectable } from '@nestjs/common';

@Injectable()
export class PlayerService {
  public musicStack: string[] = [];
  constructor() {}

  public delTrack(url: string) {
    this.musicStack = this.musicStack.filter((item) => item !== url);
  }
}
