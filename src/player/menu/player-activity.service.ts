import { Injectable, Logger } from '@nestjs/common';
import { Client, ActivityType } from 'discord.js';

export interface ActivityConfig {
  name: string;
  state: string;
  type: ActivityType;
  url?: string;
}

@Injectable()
export class PlayerActivityService {
  private readonly logger = new Logger(PlayerActivityService.name);
  private discordClient: Client | null = null;

  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  clearActivity(): void {
    if (!this.discordClient?.user) return;

    try {
      this.discordClient.user.setActivity();
    } catch (error) {
      this.logger.error(`Failed to clear activity: ${error.message}`);
    }
  }

  onPlaying(trackTitle: string, trackUrl?: string): void {
    this.discordClient?.user?.setActivity({
      name: trackTitle,
      state: '🎵 Играет музыка',
      type: ActivityType.Streaming,
      url: trackUrl,
    });
  }

  onBuffering(): void {
    this.discordClient?.user?.setActivity({
      name: 'Буферизация...',
      state: '⏳ Загрузка трека',
      type: ActivityType.Streaming,
    });
  }

  onPaused(): void {
    this.discordClient?.user?.setActivity({
      name: 'На паузе',
      state: '⏸ Музыка на паузе',
      type: ActivityType.Streaming,
    });
  }

  onAutoPaused(): void {
    this.discordClient?.user?.setActivity({
      name: 'Автопауза',
      state: '⚠ Проблемы с соединением',
      type: ActivityType.Streaming,
    });
  }

  onIdle(hasNextTrack: boolean): void {
    if (hasNextTrack) {
      this.discordClient?.user?.setActivity({
        name: 'Ожидание следующего трека',
        state: '⏳ Скоро заиграет...',
        type: ActivityType.Streaming,
      });
    } else {
      this.clearActivity();
    }
  }

  onError(): void {
    this.discordClient?.user?.setActivity({
      name: 'Ошибка воспроизведения',
      state: '❌ Произошла ошибка',
      type: ActivityType.Streaming,
    });

    setTimeout(() => {
      this.clearActivity();
    }, 5000);
  }
}
