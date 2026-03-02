import { ModalBuilder } from 'discord.js';

export const CustomModal = (id: string, title: string) => {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);

  return modal;
};
