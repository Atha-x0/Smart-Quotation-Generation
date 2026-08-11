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
import { HsnService } from './hsn.service';
import { HsnController } from './hsn.controller';

@Module({
  imports: [],
  controllers: [AppController, QuotationController, HsnController],
  providers: [
    AppService,
    PrismaService,
    QuotationService,
    QueueService,
    PdfService,
    AuditService,
    RolesGuard,
    HsnService,
  ],
})
export class AppModule {}
