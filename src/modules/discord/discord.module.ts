import { Module } from '@nestjs/common';
import { DiscordUpdate } from './discord.update';
import { NecordModule } from 'necord';

import { ConfigService } from '@nestjs/config';
import { PlayerModule } from 'src/player/player.module';
import { NecordConfig } from 'src/config/necord.config';

@Module({
  imports: [
    NecordModule.forRootAsync({
      useFactory: NecordConfig,
      inject: [ConfigService],
    }),
    PlayerModule,
  ],
  providers: [DiscordUpdate],
})
export class DiscordModule {}
