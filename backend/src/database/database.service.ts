import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: sql.ConnectionPool;

  async onModuleInit() {
    const config: sql.config = {
      server: process.env.DB_HOST ?? 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      user: process.env.DB_USER ?? 'sa',
      password: process.env.DB_PASSWORD ?? 'TuPassword123',
      database: process.env.DB_NAME ?? 'InventarioDB',
      options: {
        instanceName: process.env.DB_INSTANCE || undefined,
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    };
    this.pool = await new sql.ConnectionPool(config).connect();
    this.logger.log('Conectado a SQL Server');
  }

  async onModuleDestroy() {
    await this.pool?.close();
  }

  getPool(): sql.ConnectionPool {
    return this.pool;
  }
}
