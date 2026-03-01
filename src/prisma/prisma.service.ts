import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private logger = new Logger('📖 Database Service');
  public constructor(private readonly configService: ConfigService) {
    const url = configService.getOrThrow('DATABASE_URL');
    const adapter = new PrismaPg({ url });
    super({ adapter });
  }

  public async onModuleInit() {
    try {
      const time = new Date().getMilliseconds();
      this.logger.log(`Initialization database...`);
      await this.$connect();
      this.logger.log(
        `Database initialized (${new Date().getMilliseconds() - time}ms)`,
      );
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected');
    } catch (error) {
      this.logger.error(error);
    }
  }
}
