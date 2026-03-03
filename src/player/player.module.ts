import { Module } from '@nestjs/common';
import { PlayerCommandService } from './player.command';
import { PlayerService } from './player.service';
import { PlayerMenuService } from './player-menu.service';
import { PlaylistModule } from 'src/modules/playlist/playlist.module';
import { PlayerPlaylistService } from './player-playlist.service';
import { YoutubeModule } from 'src/modules/youtube/youtube.module';
import { PlayerActivityService } from './player-activity.service';
import { PlayerStateService } from './player-state.service';

@Module({
  imports: [PlaylistModule, YoutubeModule],
  providers: [
    PlayerService,
    PlayerCommandService,
    PlayerMenuService,
    PlayerPlaylistService,
    PlayerActivityService,
    PlayerStateService,
  ],
})
export class PlayerModule {}
