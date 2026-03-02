import { Module } from '@nestjs/common';
import { PlayerCommandService } from './player.command';
import { PlayerService } from './player.service';
import { PlayerMenuService } from './player-menu.service';

@Module({
  providers: [PlayerService, PlayerCommandService, PlayerMenuService],
})
export class PlayerModule {}
