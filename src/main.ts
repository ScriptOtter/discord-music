import { NestFactory } from '@nestjs/core';
import { AppModule } from './core/app.module';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { PlayerActivityService } from './player/player-activity.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  const activityService = app.get(PlayerActivityService);
  activityService.setDiscordClient(client);

  await client.login(config.getOrThrow('DISCORD_TOKEN'));
  await app.listen(config.getOrThrow('SERVER_PORT') ?? 4200);
}
bootstrap();
