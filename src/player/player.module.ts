import { Module } from '@nestjs/common';
import { PlayerCommandService } from './player.command';
import { PlayerService } from './player.service';
import { PlayerMenuService } from './menu/player-menu.service';
import { PlaylistModule } from 'src/modules/playlist/playlist.module';
import { PlayerPlaylistService } from './menu/player-playlist.service';
import { YoutubeModule } from 'src/modules/youtube/youtube.module';
import { PlayerActivityService } from './menu/player-activity.service';
import { PlayerStateService } from './player-state.service';
import { PlayerModalService } from './menu/player-modal.service';

@Module({
  imports: [PlaylistModule, YoutubeModule],
  providers: [
    PlayerService,
    PlayerCommandService,
    PlayerMenuService,
    PlayerPlaylistService,
    PlayerActivityService,
    PlayerStateService,
    PlayerModalService,
  ],
})
export class PlayerModule {}
