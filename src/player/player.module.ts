import { Module } from '@nestjs/common';
import { PlayerCommandService } from './player.command';
import { PlayerService } from './player.service';
import { PlayerMenuService } from './player-menu.service';
import { PlaylistModule } from 'src/modules/playlist/playlist.module';
import { PlayerPlaylistService } from './player-playlist.service';

@Module({
  imports: [PlaylistModule],
  providers: [
    PlayerService,
    PlayerCommandService,
    PlayerMenuService,
    PlayerPlaylistService,
  ],
})
export class PlayerModule {}
