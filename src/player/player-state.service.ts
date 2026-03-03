import { Injectable } from '@nestjs/common';
import { PlayerState } from 'src/shared/types/player-state.types';
import { PlaylistType } from 'src/shared/types/playlist.types';

@Injectable()
export class PlayerStateService {
  public playlist: PlaylistType[] = [];
  public currentTrack: PlaylistType | null = null;
  public state: PlayerState = 'Idle';
  public isPlaying: boolean = false;
  public currentIndex: number = 0;
  public loop: boolean = false;
  public shuffle: boolean = false;
  public isJoined: boolean = false;

  public getIsJoined(): boolean {
    return this.isJoined;
  }

  public toggleIsJoined(): boolean {
    this.isJoined = !this.isJoined;
    return this.isJoined;
  }

  public setPlaylist(playlist: PlaylistType[]): void {
    this.playlist = [...playlist];
    this.currentTrack = this.playlist[0] || null;
  }

  public clearPlaylist(): void {
    this.playlist = [];
    this.currentTrack = null;
  }

  public deleteTrackFromPlaylist(title: string): void {
    this.playlist = this.playlist.filter((item) => item.title !== title);
  }

  // Методы для получения информации
  public getCurrentTrack(): PlaylistType | null {
    if (this.playlist.length === 0) return null;
    if (!this.currentTrack) {
      this.currentTrack = this.playlist[0];
    }
    return this.currentTrack;
  }

  public getRemainingTracksCount(): number {
    if (this.playlist.length === 0) return 0;
    const index = this.playlist.findIndex(
      (track) => track.url === this.currentTrack?.url,
    );
    return this.playlist.length - index;
  }

  public getNextTrack(): PlaylistType | null {
    if (!this.currentTrack || this.playlist.length === 0) return null;

    const index = this.playlist.findIndex(
      (track) => track.url === this.currentTrack?.url,
    );

    if (index === -1 || index >= this.playlist.length - 1) return null;
    return this.playlist[index + 1];
  }

  public getPreviousTrack(): PlaylistType | null {
    if (this.currentTrack?.url === this.playlist[0]?.url) return null;

    const index = this.playlist.findIndex(
      (track) => track.url === this.currentTrack?.url,
    );

    if (index === -1 || index >= this.playlist.length) return null;

    return this.playlist[index - 1];
  }

  // Методы для управления состоянием
  public setCurrentTrack(track: PlaylistType | null): void {
    this.currentTrack = track;
  }

  public setCurrentIndex(index: number): void {
    this.currentIndex = index;
  }

  public incrementCurrentIndex(): void {
    this.currentIndex++;
  }

  public setPreviousTrack(): boolean {
    if (this.currentIndex < 1) this.currentIndex = 0;
    else this.currentIndex -= 2;
    console.log(this.currentIndex, this.playlist[this.currentIndex]);
    return true;
  }

  public setState(state: PlayerState): void {
    this.state = state;
  }

  public setIsPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  public toggleLoop(): boolean {
    this.loop = !this.loop;
    return this.loop;
  }

  public getLoop(): boolean {
    return this.loop;
  }

  public toggleShuffle(): boolean {
    this.shuffle = !this.shuffle;
    return this.shuffle;
  }

  public getShuffle(): boolean {
    return this.shuffle;
  }
}
