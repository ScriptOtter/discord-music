import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'prisma/generated/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private logger = new Logger('📖 Database Service');

  public constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
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
