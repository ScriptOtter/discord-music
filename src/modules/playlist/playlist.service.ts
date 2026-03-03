import { Injectable } from '@nestjs/common';
import { Playlist, Track } from 'prisma/generated/client';
import {
  PlaylistCreateInput,
  TrackCreateManyInput,
} from 'prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import { YoutubeService } from '../youtube/youtube.service';

@Injectable()
export class PlaylistService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly youtubeService: YoutubeService,
  ) {}

  public async getPlaylists(): Promise<Playlist[]> {
    return await this.prismaService.playlist.findMany();
  }

  public async getAllTracks(): Promise<Pick<Track, 'title' | 'url'>[]> {
    return await this.prismaService.track.findMany({
      select: { id: true, title: true, url: true },
    });
  }

  public async createPlaylist(
    data: PlaylistCreateInput,
  ): Promise<Playlist | null> {
    console.log(this.prismaService.playlist);
    try {
      const res = await this.prismaService.playlist.create({
        data,
      });
      console.log(res);
      return res;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  public async addTrackToPlaylist(
    playlistId: string,
    url: string,
  ): Promise<Track | null> {
    const title = await this.youtubeService.getTitle(url);
    if (!title) return null;
    const data: TrackCreateManyInput = {
      playlistId,
      url,
      title,
    };
    return await this.prismaService.track.create({ data });
  }

  public async getTracksFromPlaylistId(
    id: string,
  ): Promise<Pick<Track, 'title' | 'url'>[] | null> {
    const result = await this.prismaService.playlist.findUnique({
      where: { id },
      select: { tracks: { select: { title: true, url: true } } },
    });
    if (!result) return null;
    return result.tracks;
  }
  public async getPlaylistById(
    id: string,
  ): Promise<Pick<Playlist, 'id' | 'name'> | null> {
    const playlist = await this.prismaService.playlist.findFirst({
      where: { id },
      select: { id: true, name: true },
    });
    if (!playlist) return null;
    return playlist;
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
