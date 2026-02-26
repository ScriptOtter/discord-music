import { ConfigService } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';

export function NecordConfig(configService: ConfigService) {
  return {
    token: configService.getOrThrow<string>('DISCORD_TOKEN'),
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildVoiceStates,
    ],
    development: [
      configService.getOrThrow<string>('DISCORD_DEVELOPMENT_GUILD_ID'),
    ],
  };
}
