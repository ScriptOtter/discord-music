import { StringOption } from 'necord';

export class AddTrackDto {
  @StringOption({
    name: 'playlist_id',
    description: 'ID плейлиста',
    required: true,
  })
  playlistId: string;

  @StringOption({
    name: 'track_url',
    description: 'Youtube URL',
    required: true,
  })
  url: string;
}

export class AddTracksModalDto {
  tracks: string;
}

export class DeleteTracksModalDto {
  trackIds: string;
}

export class CreatePlaylistModalDto {
  playlistName: string;
  tracks: string;
}
