import { Module } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [PlaylistService],
  exports: [PlaylistService],
})
export class PlaylistModule {}
