import { Injectable } from '@nestjs/common';
import {
  Button,
  Context,
  Options,
  SlashCommand,
  SlashCommandContext,
} from 'necord';
import { TextDto } from './dto/text.dto';
import { PlayerService } from './player.service';
import { GuildMember, VoiceChannel } from 'discord.js';
import { PlayerMenuService } from './player-menu.service';
import { PlayerStateService } from './player-state.service';

@Injectable()
export class PlayerCommandService {
  constructor(
    private readonly playerService: PlayerService,
    private readonly menuService: PlayerMenuService,
    private readonly stateService: PlayerStateService,
  ) {}

  @SlashCommand({
    name: 'queue',
    description: 'Текущая очередь песен',
  })
  public async getQueue(@Context() [ctx]: SlashCommandContext) {
    let message = '';
    for (let key in this.stateService.playlist) {
      message += `[${key}] - ${this.stateService.playlist[key]}\n`;
    }
    return await ctx.reply({
      content: `${message !== '' ? message : 'Очередь пуста'}`,
    });
  }
}
