import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerCommandService } from './player.command';
import { VoicePlayerService } from './player.init';

@Module({
  providers: [PlayerService, PlayerCommandService, VoicePlayerService],
})
export class PlayerModule {}
