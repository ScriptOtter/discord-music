import { Module } from '@nestjs/common';
import { PlayerCommandService } from './player.command';
import { PlayerService } from './player.service';

@Module({
  providers: [PlayerService, PlayerCommandService],
})
export class PlayerModule {}
