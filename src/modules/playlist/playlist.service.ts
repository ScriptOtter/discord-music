import { Injectable } from '@nestjs/common';
import { Playlist, Track } from 'prisma/generated/client';
import {
  PlaylistCreateInput,
  TrackCreateManyInput,
} from 'prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import { getYoutubeTitle } from 'src/shared/utils/youtube.utils';

@Injectable()
export class PlaylistService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async getAllTracks(): Promise<Pick<Track, 'id' | 'title' | 'url'>[]> {
    return await this.prismaService.track.findMany({
      select: { id: true, title: true, url: true },
    });
  }

  public async createPlaylist(data: PlaylistCreateInput): Promise<Playlist> {
    return await this.prismaService.playlist.create({ data });
  }

  public async addTrackToPlaylist(
    playlistId: string,
    url: string,
  ): Promise<boolean> {
    const data: TrackCreateManyInput = {
      playlistId,
      url,
      title: await getYoutubeTitle(url),
    };
    return !!(await this.prismaService.track.create({ data }));
  }

  public async getPlaylistById(
    id: string,
  ): Promise<Pick<Track, 'id' | 'title' | 'url'>[] | null> {
    const result = await this.prismaService.playlist.findUnique({
      where: { id },
      select: { tracks: { select: { id: true, title: true, url: true } } },
    });
    if (!result) return null;
    return result.tracks;
  }

  public async deleteTrackFromPlaylist(
    playlistId: string,
    title: string,
  ): Promise<boolean> {
    const track = await this.prismaService.track.findFirst({
      where: { playlistId, title },
    });

    if (!track) return false;
    const result = await this.prismaService.playlist.update({
      where: { id: playlistId },
      data: {
        tracks: {
          disconnect: { id: track.id },
        },
      },
    });
    return !!result;
  }
}
