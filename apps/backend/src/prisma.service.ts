import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

function getDirectDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl) return '';
  if (envUrl.startsWith('prisma+postgres://')) {
    try {
      const urlObj = new URL(envUrl);
      const apiKey = urlObj.searchParams.get('api_key');
      if (apiKey) {
        const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
        const json = JSON.parse(decoded);
        if (json.databaseUrl) {
          return json.databaseUrl;
        }
      }
    } catch (e) {
      console.warn('Failed to parse Prisma Postgres API key:', e);
    }
  }
  return envUrl;
}

// Extract the direct URL once at module load time
const directUrl = getDirectDatabaseUrl();
console.log('PrismaService: Using direct database URL:', directUrl);

// Override DATABASE_URL so the Prisma engine also uses the direct connection
if (directUrl && directUrl.startsWith('postgres')) {
  process.env.DATABASE_URL = directUrl;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const isNeon = directUrl.includes('neon.tech') || directUrl.includes('sslmode=require');
    const pool = new Pool({
      connectionString: directUrl,
      ssl: isNeon ? { rejectUnauthorized: false } : false,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.pool) {
      await this.pool.end();
    }
  }
}
