import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

@Injectable()
export class QuotationService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE SEQUENCE IF NOT EXISTS quotation_no_seq START WITH 1;
    `);
  }

  private calculateTotals(items: any[]) {
    let taxable_amount = new Prisma.Decimal(0);
    let total_amount = new Prisma.Decimal(0);

    for (const item of items) {
      const qty = new Prisma.Decimal(item.quantity || 0);
      const rate = new Prisma.Decimal(item.rate || 0);
      const discount = new Prisma.Decimal(item.discount || 0);
      
      const itemTaxable = qty.mul(rate).sub(discount);
      taxable_amount = taxable_amount.add(itemTaxable);
    }
    
    const totalWithTax = taxable_amount.mul(1.18);
    total_amount = totalWithTax.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    return { taxable_amount, total_amount };
  }

  async create(data: {
    client_name: string;
    client_address?: string;
    client_contact?: string;
    validity_date?: string;
    subject?: string;
    status?: string;
    client_timestamp?: string | Date;
    items: {
      item_name: string;
      description?: string;
      hsn_sac_code?: string;
      quantity: number;
      unit?: string;
      rate: number;
      discount?: number;
    }[];
    content_blocks?: {
      block_type: string;
      source: string;
      title: string;
      content: string;
      category_tag?: string;
      sort_order?: number;
    }[];
  }, user?: { username: string, role: string }) {
    const seqResult = await this.prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('quotation_no_seq');`
    );
    const seqVal = seqResult[0].nextval;
    const quotation_no = `QT-${String(seqVal).padStart(4, '0')}`;

    const { taxable_amount, total_amount } = this.calculateTotals(data.items);

    const clientTs = data.client_timestamp ? new Date(data.client_timestamp) : new Date();

    const quote = await this.prisma.quotation.create({
      data: {
        quotation_no,
        revision_index: 0,
        revision_label: '0',
        client_name: data.client_name,
        client_address: data.client_address,
        client_contact: data.client_contact,
        validity_date: data.validity_date ? new Date(data.validity_date) : null,
        subject: data.subject,
        status: data.status || 'Draft',
        taxable_amount,
        total_amount,
        client_timestamp: clientTs,
        items: {
          create: data.items.map(item => {
            const qty = new Prisma.Decimal(item.quantity);
            const rate = new Prisma.Decimal(item.rate);
            const disc = new Prisma.Decimal(item.discount || 0);
            return {
              item_name: item.item_name,
              description: item.description,
              hsn_sac_code: item.hsn_sac_code,
              quantity: qty,
              unit: item.unit,
              rate: rate,
              discount: disc,
              taxable_amount: qty.mul(rate).sub(disc),
            };
          }),
        },
        content_blocks: {
          create: (data.content_blocks || []).map((cb, idx) => ({
            block_type: cb.block_type,
            source: cb.source,
            title: cb.title,
            content: cb.content,
            category_tag: cb.category_tag,
            sort_order: cb.sort_order ?? idx,
          })),
        },
      },
      include: {
        items: true,
        content_blocks: true,
      },
    });

    const uName = user?.username || 'System';
    const uRole = user?.role || 'Unknown';
    await this.audit.log(uName, uRole, 'CREATE_QUOTATION', quote.quotation_no);

    return quote;
  }

  async findAllLatest() {
    const latestRevisions = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT q1.id FROM "Quotation" q1
        INNER JOIN (
          SELECT quotation_no, MAX(revision_index) as max_rev
          FROM "Quotation"
          GROUP BY quotation_no
        ) q2 ON q1.quotation_no = q2.quotation_no AND q1.revision_index = q2.max_rev
      `
    );

    const ids = latestRevisions.map(r => r.id);
    if (ids.length === 0) return [];

    return this.prisma.quotation.findMany({
      where: { id: { in: ids } },
      include: {
        items: true,
        content_blocks: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findByQuotationNo(quotation_no: string) {
    return this.prisma.quotation.findMany({
      where: { quotation_no },
      include: {
        items: true,
        content_blocks: true,
      },
      orderBy: { revision_index: 'desc' },
    });
  }

  async findOne(quotation_no: string, revision_index: number) {
    const quote = await this.prisma.quotation.findFirst({
      where: { quotation_no, revision_index },
      include: {
        items: true,
        content_blocks: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quotation ${quotation_no} revision ${revision_index} not found`);
    }

    return quote;
  }

  async createRevision(
    quotation_no: string,
    data: {
      client_name?: string;
      client_address?: string;
      client_contact?: string;
      validity_date?: string;
      subject?: string;
      status?: string;
      revision_label?: string;
      client_timestamp?: string | Date;
      items: {
        item_name: string;
        description?: string;
        hsn_sac_code?: string;
        quantity: number;
        unit?: string;
        rate: number;
        discount?: number;
      }[];
      content_blocks?: {
        block_type: string;
        source: string;
        title: string;
        content: string;
        category_tag?: string;
        sort_order?: number;
      }[];
    },
    user?: { username: string, role: string }
  ) {
    // Find the latest revision of this quotation number
    const latest = await this.prisma.quotation.findFirst({
      where: { quotation_no },
      orderBy: { revision_index: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException(`No existing quotation found for quotation number: ${quotation_no}`);
    }

    const incomingTs = data.client_timestamp ? new Date(data.client_timestamp) : new Date();

    // LAST-WRITE-WINS conflict resolution check:
    // If the latest stored revision on the server has a newer timestamp than the incoming sync timestamp,
    // we discard the incoming change, log it as an override event in the audit trail, and return the winner.
    if (latest.client_timestamp && latest.client_timestamp.getTime() > incomingTs.getTime()) {
      const uName = user?.username || 'System';
      const uRole = user?.role || 'Unknown';
      await this.audit.log(
        uName,
        uRole,
        `DISCARDED_OUTDATED_SYNC_OVERRIDDEN_BY_REV_${latest.revision_index}`,
        quotation_no
      );
      // Return the latest server winner
      return this.prisma.quotation.findUnique({
        where: { id: latest.id },
        include: { items: true, content_blocks: true }
      });
    }

    const nextRevisionIndex = latest.revision_index + 1;
    const defaultLabel = String(nextRevisionIndex);
    const revisionLabel = data.revision_label || defaultLabel;

    const { taxable_amount, total_amount } = this.calculateTotals(data.items);

    const newQuote = await this.prisma.quotation.create({
      data: {
        quotation_no,
        revision_index: nextRevisionIndex,
        revision_label: revisionLabel,
        client_name: data.client_name ?? latest.client_name,
        client_address: data.client_address ?? latest.client_address,
        client_contact: data.client_contact ?? latest.client_contact,
        validity_date: data.validity_date ? new Date(data.validity_date) : latest.validity_date,
        subject: data.subject ?? latest.subject,
        status: data.status ?? latest.status,
        taxable_amount,
        total_amount,
        client_timestamp: incomingTs,
        items: {
          create: data.items.map(item => {
            const qty = new Prisma.Decimal(item.quantity);
            const rate = new Prisma.Decimal(item.rate);
            const disc = new Prisma.Decimal(item.discount || 0);
            return {
              item_name: item.item_name,
              description: item.description,
              hsn_sac_code: item.hsn_sac_code,
              quantity: qty,
              unit: item.unit,
              rate: rate,
              discount: disc,
              taxable_amount: qty.mul(rate).sub(disc),
            };
          }),
        },
        content_blocks: {
          create: (data.content_blocks || []).map((cb, idx) => ({
            block_type: cb.block_type,
            source: cb.source,
            title: cb.title,
            content: cb.content,
            category_tag: cb.category_tag,
            sort_order: cb.sort_order ?? idx,
          })),
        },
      },
      include: {
        items: true,
        content_blocks: true,
      },
    });

    const uName = user?.username || 'System';
    const uRole = user?.role || 'Unknown';
    await this.audit.log(uName, uRole, 'REVISE_QUOTATION', newQuote.quotation_no);

    return newQuote;
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }
}
