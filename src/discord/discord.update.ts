import { Injectable, Logger } from '@nestjs/common';
import { Context, ContextOf, On, Once } from 'necord';

@Injectable()
export class DiscordUpdate {
  private readonly logger = new Logger('🤖 Discord Update Bot');

  @Once('clientReady')
  public onReady(@Context() [client]: ContextOf<'clientReady'>) {
    this.logger.log(`Bot logged in as ${client.user.username}`);
  }

  @On('warn')
  public onWarn(@Context() [message]: ContextOf<'warn'>) {
    this.logger.warn(message);
  }

  @On('error')
  public onError(@Context() [error]: ContextOf<'error'>) {
    this.logger.error(error);
  }
}
