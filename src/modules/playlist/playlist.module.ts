import { Module } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { YoutubeModule } from '../youtube/youtube.module';

@Module({
  imports: [YoutubeModule],
  providers: [PlaylistService],
  exports: [PlaylistService],
})
export class PlaylistModule {}
