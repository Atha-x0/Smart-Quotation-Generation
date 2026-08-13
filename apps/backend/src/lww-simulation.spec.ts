import * as dotenv from 'dotenv';
dotenv.config();

function setupEnvironment() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('prisma+postgres://')) {
    try {
      const urlObj = new URL(envUrl);
      const apiKey = urlObj.searchParams.get('api_key');
      if (apiKey) {
        const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
        const json = JSON.parse(decoded);
        if (json.databaseUrl) {
          process.env.DATABASE_URL = json.databaseUrl;
          console.log("Rewrote DATABASE_URL to direct URL:", json.databaseUrl);
        }
      }
    } catch (e) {
      console.warn('Failed to parse Prisma Postgres API key:', e);
    }
  }
}

setupEnvironment();

import { Test, TestingModule } from '@nestjs/testing';

describe('Last-Write-Wins (LWW) Sync Conflict Resolution & Auditing', () => {
  let service: QuotationService;
  let prisma: PrismaService;
  let audit: AuditService;

  beforeAll(async () => {
    // Standard synchronous require to ensure process.env.DATABASE_URL rewrite completes before Prisma Client load
    const { QuotationService } = require('./quotation.service');
    const { PrismaService } = require('./prisma.service');
    const { AuditService } = require('./audit.service');

    const module: TestingModule = await Test.createTestingModule({
      providers: [QuotationService, PrismaService, AuditService],
    }).compile();

    await module.init();

    service = module.get<QuotationService>(QuotationService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);

    // Clean databases before test
    await prisma.quotationItem.deleteMany({});
    await prisma.contentBlock.deleteMany({});
    await prisma.quotation.deleteMany({});
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should successfully apply last-write-wins policy and log overrides on outdated sync arrivals', async () => {
    // 1. Create a base quotation first
    const baseQuote = await service.create({
      client_name: 'Conflict Test Corp',
      client_timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      items: [
        { item_name: 'Base Service', quantity: 1, rate: 100 },
      ],
      content_blocks: [
        { block_type: 'scope_of_work', source: 'manual', title: 'Scope', content: 'Base Scope' },
      ],
    }, { username: 'sales_rep_1', role: 'SalesRep' });

    const qNo = baseQuote.quotation_no;

    // 2. Simulate Edit A (Older revision edit, T1 = 5 minutes ago)
    const editA_T1 = new Date(Date.now() - 300000); // 5 minutes ago
    const editAPayload = {
      client_name: 'Conflict Test Corp',
      client_timestamp: editA_T1.toISOString(),
      items: [
        { item_name: 'Base Service', quantity: 1, rate: 150 }, // Edit A set rate to 150
      ],
      content_blocks: [
        { block_type: 'scope_of_work', source: 'manual', title: 'Scope', content: 'Edit A Scope' },
      ],
    };

    // 3. Simulate Edit B (Newer revision edit, T2 = 2 minutes ago)
    const editB_T2 = new Date(Date.now() - 120000); // 2 minutes ago
    const editBPayload = {
      client_name: 'Conflict Test Corp',
      client_timestamp: editB_T2.toISOString(),
      items: [
        { item_name: 'Base Service', quantity: 1, rate: 200 }, // Edit B set rate to 200 (should win!)
      ],
      content_blocks: [
        { block_type: 'scope_of_work', source: 'manual', title: 'Scope', content: 'Edit B Scope' },
      ],
    };

    // 4. Simulate patchy network conditions:
    // Edit B comes online first and syncs to the server
    const syncBResult = await service.createRevision(qNo, editBPayload, {
      username: 'sales_rep_2',
      role: 'SalesRep',
    });

    expect(Number(syncBResult.total_amount)).toBe(236);

    // 5. Edit A (outdated sync) arrives later
    const syncAResult = await service.createRevision(qNo, editAPayload, {
      username: 'sales_rep_1',
      role: 'SalesRep',
    });

    // 6. Assert LWW kicked in:
    // - Returned result from sync A is overridden and returns the winner (Edit B total value of 236)
    expect(Number(syncAResult.total_amount)).toBe(236);

    // - Verify audit log recorded the discard action
    const auditLogs = await service.getAuditLogs();
    const discardLog = auditLogs.find(log => log.action.includes('DISCARDED_OUTDATED_SYNC'));

    expect(discardLog).toBeDefined();
    expect(discardLog?.quotation_no).toBe(qNo);
    expect(discardLog?.username).toBe('sales_rep_1');
  });
});
