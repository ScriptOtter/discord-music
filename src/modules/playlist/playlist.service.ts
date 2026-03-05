import { Injectable } from '@nestjs/common';
import { Playlist, Track } from 'prisma/generated/client';
import {
  PlaylistCreateInput,
  TrackCreateManyInput,
} from 'prisma/generated/models';
import { PrismaService } from 'src/prisma/prisma.service';
import { YoutubeService } from '../youtube/youtube.service';
import { PlaylistWithTracks } from 'src/shared/types/playlist.types';

@Injectable()
export class PlaylistService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly youtubeService: YoutubeService,
  ) {}

  public async getPlaylists(): Promise<Playlist[]> {
    return await this.prismaService.playlist.findMany();
  }

  public async renamePlaylist(
    id: string,
    name: string,
  ): Promise<Playlist | null> {
    const playlist = await this.prismaService.playlist.findUnique({
      where: { id },
    });
    if (!playlist) return null;
    const updatedPlaylist = await this.prismaService.playlist.update({
      where: { id },
      data: { name },
    });
    if (!updatedPlaylist) return null;
    return updatedPlaylist;
  }

  public async deletePlaylist(id: string): Promise<boolean> {
    const playlist = await this.prismaService.playlist.findUnique({
      where: { id },
    });
    if (!playlist) return false;
    await this.prismaService.playlist.delete({ where: { id } });
    return true;
  }

  public async getMixPlaylist(): Promise<PlaylistWithTracks> {
    const tracks = await this.prismaService.track.findMany({});
    const playlist = {
      id: 'mix',
      name: 'mix',
      tracks,
      owner: 'mix',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return playlist;
  }

  public async createPlaylist(
    data: PlaylistCreateInput,
  ): Promise<Playlist | null> {
    try {
      const res = await this.prismaService.playlist.create({
        data,
      });
      return res;
    } catch (e) {
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

  public async getPlaylistById(id: string): Promise<PlaylistWithTracks | null> {
    const playlist = await this.prismaService.playlist.findFirst({
      where: { id },
      include: { tracks: true },
    });
    if (!playlist) return null;
    return playlist;
  }

  async deleteTrackFromPlaylist(
    playlistId: string,
    trackId: string,
  ): Promise<boolean> {
    try {
      await this.prismaService.track.delete({
        where: {
          id: trackId,
          playlistId,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
