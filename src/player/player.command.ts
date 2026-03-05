import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';

import { PlayerStateService } from './player-state.service';
import { PlayerMenuService } from './menu/player-menu.service';

@Injectable()
export class PlayerCommandService {
  constructor(private readonly menuService: PlayerMenuService) {}

  @SlashCommand({
    name: 'player',
    description: 'Открыть меню управления плеером',
  })
  private async createMenu(@Context() [interaction]: SlashCommandContext) {
    this.menuService.createPlayerMenu([interaction]);
  }
}
