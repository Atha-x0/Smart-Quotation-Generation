import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { QueueService } from './queue.service';
import { PdfService } from './pdf.service';
import { AuditService } from './audit.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [],
  controllers: [AppController, QuotationController],
  providers: [
    AppService,
    PrismaService,
    QuotationService,
    QueueService,
    PdfService,
    AuditService,
    RolesGuard,
  ],
})
export class AppModule {}
