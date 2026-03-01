import { YtDlp } from 'ytdlp-nodejs';

export async function getYoutubeTitle(url: string): Promise<string> {
  const ytdlp = new YtDlp();
  return (await ytdlp.getInfoAsync(url)).title;
}
