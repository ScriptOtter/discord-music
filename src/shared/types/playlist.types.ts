import { Playlist, Track } from 'prisma/generated/browser';

export type PlaylistType = {
  id: string;
  title: string;
  url: string;
};

export type PlaylistWithTracks = Playlist & { tracks: Track[] };
