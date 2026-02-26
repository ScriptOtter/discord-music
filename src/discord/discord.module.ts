import { Module } from '@nestjs/common';
import { DiscordUpdate } from './discord.update';
import { NecordModule } from 'necord';
import { NecordConfig } from 'src/configs/necord.config';
import { ConfigService } from '@nestjs/config';
import { PlayerModule } from 'src/player/player.module';

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
