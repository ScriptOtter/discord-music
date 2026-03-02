import { ActionRowBuilder } from 'discord.js';
import { CustomButton } from './ui/button';
import { PlayerState } from 'src/shared/types/player-state.types';

export const getPlaylistInfo = (
  state: PlayerState,
  currentTrack?: string,
  nextTrack?: string,
): string => {
  let content = '';

  if (state === 'Playing') content = `Сейчас играет ${currentTrack}\n`;
  if (state === 'Paused') content = `Трек ${currentTrack} на паузе`;
  if (state === 'Idle') content = 'Бот ожидает запуска';

  if (nextTrack !== '') content += `\nСледующий трек ${nextTrack}`;
  return content;
};

export function playerMenu(
  state: PlayerState,
  hasCurrentTrack: boolean,
): ActionRowBuilder {
  const prevTrack = CustomButton('prevTrack', 'GRAY', '⏮');
  const nextTrack = CustomButton('nextTrack', 'GRAY', '⏭');
  const play = CustomButton(
    'play',
    'GREEN',
    '▶️ Play',
    state === 'Playing' || !hasCurrentTrack,
  );
  const unpause = CustomButton('unpause', 'GREEN', '▶');
  const pause = CustomButton('pause', 'RED', '⏸');

  const playingRow = new ActionRowBuilder().addComponents(
    prevTrack,
    pause,
    nextTrack,
  );
  const pausedRow = new ActionRowBuilder().addComponents(
    prevTrack,
    unpause,
    nextTrack,
  );
  const idleRow = new ActionRowBuilder().addComponents(
    prevTrack,
    play,
    nextTrack,
  );

  if (state === 'Playing') return playingRow;
  if (state === 'Paused') return pausedRow;

  return idleRow;
}
