import { Injectable, Logger } from '@nestjs/common';
import { Track } from 'prisma/generated/browser';
import { PlayerState } from 'src/shared/types/player-state.types';
import {
  PlaylistType,
  PlaylistWithTracks,
} from 'src/shared/types/playlist.types';

export interface QueuedTrack {
  track: PlaylistType;
  originalIndex: number; // Оригинальная позиция в плейлисте
  played: boolean; // Был ли трек уже сыгран
}

export interface PlaylistQueue {
  originalPlaylist: PlaylistWithTracks | null; // Оригинальный плейлист
  tracks: QueuedTrack[]; // Текущая очередь (с учетом shuffle)
  history: QueuedTrack[]; // Сыгранные треки
  currentIndex: number; // Текущая позиция в очереди
}

@Injectable()
export class PlayerStateService {
  private queue: PlaylistQueue = {
    originalPlaylist: null,
    tracks: [],
    history: [],
    currentIndex: 0,
  };

  private logger = new Logger(PlayerStateService.name);

  public currentTrack: PlaylistType | null = null;
  public playlistName: string = 'Mix';
  public state: PlayerState = 'Idle';
  public isPlaying: boolean = false;
  public loop: boolean = false;
  public shuffle: boolean = false;
  public isJoined: boolean = false;

  /**
   * Установить новый плейлист
   */
  public setPlaylist(playlist: PlaylistWithTracks): void {
    this.logger.log('Playlist setted');
    this.queue.originalPlaylist = playlist;
    this.playlistName = playlist.name;

    // Создаем очередь из треков
    this.queue.tracks = playlist.tracks.map((track, index) => ({
      track,
      originalIndex: index,
      played: false,
      playCount: 0,
    }));

    this.queue.history = [];
    this.queue.currentIndex = 0;
    this.currentTrack = this.queue.tracks[0]?.track || null;

    if (this.shuffle) {
      this.logger.log('Playlist setted (shuffle)');
      this.shuffleQueue();
    }
  }

  public getPlaylist(): QueuedTrack[] | null {
    if (this.queue.tracks.length === 0) return null;

    return this.queue.tracks;
  }

  /**
   * Перемешать очередь (сохраняя историю)
   */
  private shuffleQueue(): void {
    const currentQueuedTrack = this.queue.tracks[this.queue.currentIndex];
    currentQueuedTrack.played = true;

    this.queue.history.push({ ...currentQueuedTrack });
    const unplayedTracks = this.queue.tracks
      .filter((t) => !t.played)
      .map((t) => ({ ...t }));

    // Перемешиваем непроигранные треки
    for (let i = unplayedTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unplayedTracks[i], unplayedTracks[j]] = [
        unplayedTracks[j],
        unplayedTracks[i],
      ];
    }

    // Обновляем очередь, сохраняя сыгранные треки на своих местах
    let unplayedIndex = 0;
    this.queue.tracks = this.queue.tracks.map((t) => {
      if (t.played) return t;
      return unplayedTracks[unplayedIndex++];
    });
  }

  /**
   * Получить следующий трек
   */
  public getNextTrack(): PlaylistType | null {
    if (this.queue.tracks.length === 0) return null;

    if (
      this.queue.currentIndex >= 0 &&
      this.queue.currentIndex < this.queue.tracks.length
    ) {
      const currentQueuedTrack = this.queue.tracks[this.queue.currentIndex];
      currentQueuedTrack.played = true;

      this.queue.history.push({ ...currentQueuedTrack });
    }

    if (this.loop) {
      return this.currentTrack;
    }

    let nextIndex = this.queue.currentIndex + 1;

    if (nextIndex >= this.queue.tracks.length) {
      {
        this.currentTrack = null;
        this.isPlaying = false;
        return null;
      }
    }

    this.queue.currentIndex = nextIndex;
    this.currentTrack = this.queue.tracks[nextIndex]?.track || null;

    return this.currentTrack;
  }

  public getNextTrackInfo(): PlaylistType | null {
    if (this.queue.tracks.length === 0) return null;

    let nextIndex = this.queue.currentIndex + 1;
    if (!this.queue.tracks[nextIndex]) return null;
    return this.queue.tracks[nextIndex].track;
  }

  /**
   * Получить предыдущий трек
   */
  public getPreviousTrack(): PlaylistType | null {
    if (this.queue.history.length === 0) return null;
    if (this.loop) {
      return this.currentTrack;
    }
    let prevIndex = this.queue.currentIndex - 1;

    this.queue.currentIndex = prevIndex;
    this.currentTrack = this.queue.tracks[prevIndex]?.track || null;

    return this.currentTrack;
  }

  public getPreviousTrackInfo(): PlaylistType | null {
    if (this.queue.history.length === 0) return null;
    let prevIndex = this.queue.currentIndex - 1;
    if (!this.queue.history[prevIndex]) return null;

    return this.queue.history[prevIndex].track;
  }

  /**
   * Переключить shuffle режим
   */
  public toggleShuffle(): boolean {
    this.logger.log('toggleShuffle');
    this.shuffle = !this.shuffle;

    if (this.shuffle && this.queue.tracks.length > 0) {
      // Сохраняем текущий трек на его позиции
      const currentTrackId = this.currentTrack?.id;

      this.shuffleQueue();

      // Восстанавливаем текущий трек на правильной позиции
      if (currentTrackId) {
        const newIndex = this.queue.tracks.findIndex(
          (t) => t.track.id === currentTrackId,
        );
        if (newIndex !== -1) {
          this.queue.currentIndex = newIndex;
        }
      }
    }

    this.shuffle = !this.shuffle;
    return this.shuffle;
  }

  /**
   * Переключить loop режим
   */
  public toggleLoop(): boolean {
    this.logger.log('toggleLoop');
    this.loop = !this.loop;
    return this.loop;
  }

  /**
   * Получить информацию о текущей позиции в плейлисте
   */
  public getQueueInfo(): {
    currentPosition: number;
    totalTracks: number;
    remainingTracks: number;
    playedTracks: number;
  } {
    this.logger.log('getQueueInfo');
    const currentPosition = this.queue.currentIndex;
    const totalTracks = this.queue.tracks.length;
    const playedTracks = this.queue.history.length;
    const remainingTracks = totalTracks - playedTracks;

    return {
      currentPosition,
      totalTracks,
      remainingTracks,
      playedTracks,
    };
  }

  public getRemainingTracks(): number {
    if (!this.queue.originalPlaylist) return 0;
    return this.queue.originalPlaylist?.tracks.length - this.queue.currentIndex;
  }

  /**
   * Получить историю воспроизведения
   */
  public getHistory(): QueuedTrack[] {
    return this.queue.history;
  }

  /**
   * Получить предстоящие треки
   */
  public getUpcomingTracks(): QueuedTrack[] {
    return this.queue.tracks
      .slice(this.queue.currentIndex + 1)
      .filter((t) => !t.played);
  }

  /**
   * Удалить трек из очереди
   */
  public removeTrack(index: number): boolean {
    if (index < 0 || index >= this.queue.tracks.length) return false;

    this.queue.tracks.splice(index, 1);

    if (index < this.queue.currentIndex) {
      this.queue.currentIndex--;
    } else if (index === this.queue.currentIndex) {
      // Если удалили текущий трек, переходим к следующему
      if (this.queue.currentIndex >= this.queue.tracks.length) {
        this.queue.currentIndex = this.queue.tracks.length - 1;
      }
      this.currentTrack =
        this.queue.tracks[this.queue.currentIndex]?.track || null;
    }

    return true;
  }

  /**
   * Очистить плейлист
   */
  public clearPlaylist(): void {
    this.queue = {
      originalPlaylist: null,
      tracks: [],
      history: [],
      currentIndex: 0,
    };
    this.currentTrack = null;
    this.isPlaying = false;
  }

  // Существующие методы...
  public getIsJoined(): boolean {
    return this.isJoined;
  }

  public toggleIsJoined(): boolean {
    this.isJoined = !this.isJoined;
    return this.isJoined;
  }

  public getCurrentTrack(): PlaylistType | null {
    return this.currentTrack;
  }

  public setCurrentTrack(track: PlaylistType | null): void {
    this.currentTrack = track;
  }

  public setState(state: PlayerState): void {
    this.state = state;
  }

  public setIsPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  public getLoop(): boolean {
    return this.loop;
  }

  public getShuffle(): boolean {
    return this.shuffle;
  }

  public getPlaylistName(): string {
    return this.playlistName;
  }
}
