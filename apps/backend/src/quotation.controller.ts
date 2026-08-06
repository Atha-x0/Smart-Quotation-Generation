import { Controller, Get, Post, Body, Param, ParseIntPipe, Patch, Res, NotFoundException, UseGuards, Req } from '@nestjs/common';
import { Response } from 'express';
import { QuotationService } from './quotation.service';
import { QueueService } from './queue.service';
import { PdfService } from './pdf.service';
import { RolesGuard } from './roles.guard';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api/quotations')
@UseGuards(RolesGuard)
export class QuotationController {
  constructor(
    private readonly quotationService: QuotationService,
    private readonly queueService: QueueService,
    private readonly pdfService: PdfService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() createDto: any, @Req() req: any) {
    const user = req['user'];
    return this.quotationService.create(createDto, user);
  }

  @Get()
  findAllLatest() {
    return this.quotationService.findAllLatest();
  }

  @Post(':id/compile')
  compile(@Param('id') id: string) {
    return this.queueService.addPdfJob(id);
  }

  @Get('audit-logs')
  async getAuditLogs() {
    // Expose audit logs for dashboard view
    return this.quotationService.getAuditLogs();
  }

  @Get(':quotation_no/:revision_label/download')
  async downloadPdf(
    @Param('quotation_no') quotationNo: string,
    @Param('revision_label') revisionLabel: string,
    @Res() res: any,
  ) {
    const fileName = `${quotationNo}_rev${revisionLabel}.pdf`;
    const filePath = path.join(this.pdfService.getStorageDirectory(), fileName);
    console.log('--- downloadPdf: Resolving filePath:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('--- downloadPdf: PDF missing, compiling on-the-fly...');
      const quotation = await this.prisma.quotation.findFirst({
        where: { quotation_no: quotationNo, revision_label: revisionLabel },
        include: { items: true, content_blocks: true },
      });
      if (quotation) {
        try {
          await this.pdfService.compilePdf(quotation);
        } catch (err) {
          console.error('--- downloadPdf: Failed to compile PDF:', err);
          return res.status(500).json({
            statusCode: 500,
            message: `Failed to compile PDF: ${err.message}`,
            error: 'Internal Server Error'
          });
        }
      } else {
        return res.status(404).json({
          statusCode: 404,
          message: `Compiled PDF ${fileName} not found, and no matching quotation version exists.`,
          error: 'Not Found'
        });
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${fileName}`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Get(':quotation_no/:revision_label/render')
  async renderHtml(
    @Param('quotation_no') quotationNo: string,
    @Param('revision_label') revisionLabel: string,
    @Res() res: any,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { quotation_no: quotationNo, revision_label: revisionLabel },
      include: { items: true, content_blocks: true },
    });

    if (!quotation) {
      return res.status(404).json({
        statusCode: 404,
        message: `Quotation ${quotationNo} rev ${revisionLabel} not found`,
        error: 'Not Found'
      });
    }

    const html = this.pdfService.generateHtml(quotation);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }


  @Get(':quotation_no')
  findByQuotationNo(@Param('quotation_no') quotationNo: string) {
    return this.quotationService.findByQuotationNo(quotationNo);
  }

  @Get(':quotation_no/:revision_index')
  findOne(
    @Param('quotation_no') quotationNo: string,
    @Param('revision_index', ParseIntPipe) revisionIndex: number,
  ) {
    return this.quotationService.findOne(quotationNo, revisionIndex);
  }

  @Patch(':quotation_no')
  async createRevision(
    @Param('quotation_no') quotationNo: string,
    @Body() updateDto: any,
    @Req() req: any,
  ) {
    const user = req['user'];
    return this.quotationService.createRevision(quotationNo, updateDto, user);
  }
}
