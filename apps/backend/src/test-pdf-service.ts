import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PdfService } from './pdf.service';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  console.log('Creating Nest application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Context created. Getting PdfService and PrismaService...');
  const pdfService = app.get(PdfService);
  const prismaService = app.get(PrismaService);

  try {
    console.log('Fetching quotation from database...');
    const quotation = await prismaService.quotation.findFirst({
      include: { items: true, content_blocks: true }
    });
    if (!quotation) {
      console.log('No quotations found in database!');
      return;
    }
    console.log('Compiling PDF for quotation:', quotation.quotation_no);
    const filePath = await pdfService.compilePdf(quotation);
    console.log('PDF compiled successfully! Path:', filePath);
  } catch (error) {
    console.error('Error compiling PDF:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
