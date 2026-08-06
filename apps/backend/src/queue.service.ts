import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PdfService } from './pdf.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private pdfQueue: Queue | null = null;
  private pdfWorker: Worker | null = null;
  private redisAvailable = false;

  constructor(
    private pdfService: PdfService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    const connectionOpts = {
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
      retryStrategy: () => null, // Do not retry — fail fast
    };

    try {
      // Actually test the Redis connection before creating queues
      const IORedis = require('ioredis');
      const testConn = new IORedis({ host: redisHost, port: redisPort, retryStrategy: () => null, lazyConnect: true });
      await testConn.connect();
      await testConn.ping();
      await testConn.quit();

      this.pdfQueue = new Queue('pdf-generation', { connection: connectionOpts });
      
      this.pdfWorker = new Worker(
        'pdf-generation',
        async (job) => {
          console.log(`Processing background PDF generation job: ${job.id}`);
          const { quotationId } = job.data;
          
          const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { items: true, content_blocks: true },
          });

          if (!quotation) {
            throw new Error(`Quotation with ID ${quotationId} not found`);
          }

          const filePath = await this.pdfService.compilePdf(quotation);
          console.log(`Successfully generated PDF for quotation: ${quotation.quotation_no} at ${filePath}`);
          return { filePath };
        },
        { connection: connectionOpts }
      );

      this.pdfWorker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed: ${err.message}`);
      });

      this.redisAvailable = true;
      console.log('Successfully connected to Redis. BullMQ background processor is active.');
    } catch (e) {
      console.warn('Redis is not available. PDF jobs will run synchronously (this is fine for development).');
      this.pdfQueue = null;
      this.pdfWorker = null;
      this.redisAvailable = false;
    }
  }

  async addPdfJob(quotationId: string) {
    if (this.redisAvailable && this.pdfQueue) {
      const job = await this.pdfQueue.add('compile', { quotationId });
      return { jobId: job.id, mode: 'async' };
    } else {
      // Fallback to sync generation if Redis is down
      console.log('Running sync PDF compile fallback...');
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { items: true, content_blocks: true },
      });
      if (quotation) {
        await this.pdfService.compilePdf(quotation);
      }
      return { jobId: 'sync-direct', mode: 'sync' };
    }
  }

  async onModuleDestroy() {
    if (this.pdfWorker) {
      await this.pdfWorker.close();
    }
    if (this.pdfQueue) {
      await this.pdfQueue.close();
    }
  }
}
