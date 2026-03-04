import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';

import { PlayerStateService } from './player-state.service';

@Injectable()
export class PlayerCommandService {
  constructor(private readonly stateService: PlayerStateService) {}
}
