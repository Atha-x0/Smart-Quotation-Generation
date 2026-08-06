import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper to draw SVG paths for icons
 */
function drawIcon(doc: any, pathStr: string, x: number, y: number, size = 12, fillColor = '#000000') {
  doc.save();
  doc.translate(x, y);
  const scale = size / 16; // Icons designed on a 16x16 grid
  doc.scale(scale);
  doc.path(pathStr).fillColor(fillColor).fill();
  doc.restore();
}

const ICONS = {
  phone: 'M3 0 C1.5 0 0 1.5 0 3 C0 8.5 4.5 13 10 13 C11.5 13 13 11.5 13 10 L11 8 C10.5 7.5 9.5 7.5 9 8 L8 9 C6 8 5 7 4 5 L5 4 C5.5 3.5 5.5 2.5 5 2 L3 0 Z',
  envelope: 'M0 2 L0 12 L16 12 L16 2 Z M2 4 L8 8 L14 4 Z M2 5.5 L5.5 8 L2 10.5 Z M14 5.5 L14 10.5 L10.5 8 Z M6.5 8.7 L8 9.7 L9.5 8.7 L13 11.5 L3 11.5 Z',
  user: 'M8 0 C10.2 0 12 1.8 12 4 C12 6.2 10.2 8 8 8 C5.8 8 4 6.2 4 4 C4 1.8 5.8 0 8 0 Z M2 14 C2 10.5 5 10 8 10 C11 10 14 10.5 14 14 Z',
  cog: 'M8 6 C6.9 6 6 6.9 6 8 C6 9.1 6.9 10 8 10 C9.1 10 10 9.1 10 8 C10 6.9 9.1 6 8 6 Z M8 1 C7.5 1 7.1 1.3 7 1.8 L6.7 3 C6.1 3.2 5.6 3.5 5.1 3.9 L4 3.1 C3.6 2.8 3.1 2.9 2.8 3.3 L1.3 5.9 C1.1 6.3 1.2 6.8 1.6 7.1 L2.6 7.9 C2.5 8.2 2.5 8.5 2.6 8.8 L1.6 9.6 C1.2 9.9 1.1 10.4 1.3 10.8 L2.8 13.4 C3.1 13.8 3.6 13.9 4.0 13.6 L5.1 12.8 C5.6 13.2 6.1 13.5 6.7 13.7 L7.0 14.9 C7.1 15.4 7.5 15.7 8.0 15.7 C8.5 15.7 8.9 15.4 9.0 14.9 L9.3 13.7 C9.9 13.5 10.4 13.2 10.9 12.8 L12.0 13.6 C12.4 13.9 12.9 13.8 13.2 13.4 L14.7 10.8 C14.9 10.4 14.8 9.9 14.4 9.6 L13.4 8.8 C13.5 8.5 13.5 8.2 13.4 7.9 L14.4 7.1 C14.8 6.8 14.9 6.3 14.7 5.9 L13.2 3.3 C12.9 2.9 12.4 2.8 12.0 3.1 L10.9 3.9 C10.4 3.5 9.9 3.2 9.3 3.0 L9.0 1.8 C8.9 1.3 8.5 1 8.0 1 Z',
  droplet: 'M8 0 C8 0 2 6 2 10.5 C2 13.5 4.7 16 8 16 C11.3 16 14 13.5 14 10.5 C14 6 8 0 8 0 Z',
  document: 'M2 0 L10 0 L14 4 L14 16 L2 16 Z M3 2 L9 2 L9 5 L12 5 L12 15 L3 15 Z M5 7 L11 7 M5 10 L11 10 M5 13 L9 13',
  grid: 'M1 1 H3 V3 H1 Z M6 1 H8 V3 H6 Z M11 1 H13 V3 H11 Z M1 6 H3 V8 H1 Z M6 6 H8 V8 H6 Z M11 6 H13 V8 H11 Z M1 11 H3 V13 H1 Z M6 11 H8 V13 H6 Z M11 11 H13 V13 H11 Z',
  box: 'M1 4 L8 1 L15 4 L15 12 L8 15 L1 12 Z M8 1.5 L14 3.8 L8 6.1 L2 3.8 Z M8 6.8 L14 4.5 L14 11.2 L8 13.9 Z M2 4.5 L8 6.8 L8 13.9 L2 11.2 Z'
};

function cleanHtmlText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function generateQuotePdf(quote: any, res: any = null, filePath: string | null = null): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });

    let writeStream: fs.WriteStream | null = null;
    if (filePath) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
    }
    
    if (res) {
      doc.pipe(res);
    }

    // Resolve fonts
    const resolveFont = (basename: string, ext = '.ttf') => {
      const filenames = [`${basename}-v2${ext}`, `${basename}${ext}`];
      for (const filename of filenames) {
        const paths = [
          path.join(__dirname, 'fonts', filename),
          path.join(__dirname, '..', 'fonts', filename),
          path.join(__dirname, '..', '..', 'fonts', filename),
          path.join(process.cwd(), 'fonts', filename),
          path.join(process.cwd(), 'apps', 'backend', 'fonts', filename)
        ];
        for (const p of paths) {
          if (fs.existsSync(p)) return p;
        }
      }
      return null;
    };

    const fontPathRegular = resolveFont('Roboto-Regular');
    const fontPathBold = resolveFont('Roboto-Bold');
    const fontPathItalic = resolveFont('Roboto-Italic');

    if (fontPathRegular) doc.registerFont('Roboto', fontPathRegular);
    else doc.registerFont('Roboto', 'Helvetica');

    if (fontPathBold) doc.registerFont('Roboto-Bold', fontPathBold);
    else doc.registerFont('Roboto-Bold', 'Helvetica-Bold');

    if (fontPathItalic) doc.registerFont('Roboto-Italic', fontPathItalic);
    else doc.registerFont('Roboto-Italic', 'Helvetica-Oblique');

    // Colors
    const brandIndigo = '#4f46e5';      // Primary template Indigo
    const brandLightBlue = '#f0f2ff';  // Light card blue
    const brandGreen = '#10b981';     // Secondary accent Green
    const brandLightGreen = '#ecfdf5';// Light card green
    
    const primaryColor = '#1e293b';   // Slate 800
    const textColor = '#334155';      // Slate 700
    const lightBg = '#f8fafc';        // Zebra rows
    const borderColor = '#cbd5e1';    // Slate 300
    const borderLight = '#e2e8f0';    // Table inner borders

    // Date and number formatting
    const dateStr = new Date(quote.created_at || Date.now()).toLocaleDateString('en-US');
    const quoteNum = quote.quotation_no || `QT-${new Date(quote.created_at || Date.now()).toISOString().slice(0, 10).replace(/-/g, '')}-${String(quote.id).padStart(4, '0')}`;

    const formatCurrency = (val: any) => {
      return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // 1. TOP HEADER BANNER
    doc.rect(0, 0, 595.28, 30).fill(brandIndigo);
    
    // Top Bar Text and Icons
    drawIcon(doc, ICONS.phone, 50, 9, 12, '#ffffff');
    doc.fillColor('#ffffff').font('Roboto-Bold').fontSize(10).text('+1 (555) 019-2834', 68, 10);
    
    doc.moveTo(175, 8).lineTo(175, 22).strokeColor('#818cf8').lineWidth(1).stroke();

    drawIcon(doc, ICONS.envelope, 190, 9, 12, '#ffffff');
    doc.fillColor('#ffffff').font('Roboto').fontSize(10).text('contact@seetechsolutions.com', 210, 10);

    // 2. BRANDING / LOGO SECTION
    const logoX = 50;
    const logoY = 50;
    doc.save();
    doc.translate(logoX + 20, logoY + 25);
    doc.path('M -18 -8 C -15 -18, -3 -22, 8 -18 C 15 -14, 18 -5, 15 4 C 13 10, 7 14, 0 15')
       .lineWidth(3).strokeColor(brandGreen).stroke();
    doc.path('M -8 12 C -15 8, -17 -2, -12 -10 C -8 -15, 0 -17, 7 -12 C 12 -8, 11 0, 7 4')
       .lineWidth(3).strokeColor(brandIndigo).stroke();
    doc.path('M -4 -8 C -2 -11, 2 -11, 4 -8 C 5 -5, 1 -3, -1 0 C -4 3, -4 7, -1 10 C 2 12, 6 11, 7 8')
       .lineWidth(2.5).strokeColor(primaryColor).stroke();
    doc.restore();

    doc.fillColor(brandGreen).font('Roboto-Bold').fontSize(26).text('SEETECH', 95, 52);
    doc.fillColor('#475569').font('Roboto-Bold').fontSize(15).text('S O L U T I O N S', 95, 77);
    doc.moveTo(95, 96).lineTo(250, 96).strokeColor(brandGreen).lineWidth(1.5).stroke();
    doc.fillColor('#64748b').font('Roboto-Italic').fontSize(9.5).text('energy savings delivered...', 108, 101);

    // Right Quotation Headers
    doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(22).text('QUOTATION', 400, 52, { align: 'right' });
    
    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(10.5).text('Quote #:', 310, 85, { width: 130, align: 'right' });
    doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(10.5).text(quoteNum, 450, 85, { width: 95, align: 'left' });

    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(10.5).text('Revision:', 310, 99, { width: 130, align: 'right' });
    doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(10.5).text(`Index ${quote.revision_index} (${quote.revision_label})`, 450, 99, { width: 95, align: 'left' });

    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(10.5).text('Date:', 310, 113, { width: 130, align: 'right' });
    doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(10.5).text(dateStr, 450, 113, { width: 95, align: 'left' });

    // Divider Line
    doc.moveTo(50, 134).lineTo(545, 134).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // 3. CLIENT SPECIFICATIONS CARD
    const cardY = 145;
    const cardHeight = 100;

    // Prepared For Card
    doc.roundedRect(50, cardY, 235, cardHeight, 6).fill(brandLightBlue);
    
    doc.fillColor(brandIndigo).rect(60, cardY + 10, 16, 16).fill();
    drawIcon(doc, ICONS.user, 62, cardY + 12, 12, '#ffffff');
    doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(10.5).text('PREPARED FOR:', 82, cardY + 14);

    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(11).text(quote.client_name || 'N/A', 60, cardY + 36);
    doc.fillColor(textColor).font('Roboto').fontSize(9.5).text(quote.client_address || 'N/A', 60, cardY + 52, { width: 215, lineGap: 2 });
    doc.fillColor(textColor).font('Roboto').fontSize(9.5).text(`Contact: ${quote.client_contact || 'N/A'}`, 60, cardY + 82);

    // Subject & Validity Card
    doc.roundedRect(300, cardY, 245, cardHeight, 6).fill(brandLightGreen);

    doc.fillColor(brandGreen).rect(310, cardY + 10, 16, 16).fill();
    drawIcon(doc, ICONS.cog, 312, cardY + 12, 12, '#ffffff');
    doc.fillColor(brandGreen).font('Roboto-Bold').fontSize(10.5).text('REFERENCE DETAILS:', 332, cardY + 14);

    doc.fillColor(textColor).font('Roboto').fontSize(9.5);
    doc.text(`Subject: ${quote.subject || 'N/A'}`, 310, cardY + 36, { width: 225, lineGap: 1 });
    
    if (quote.validity_date) {
      const validityStr = new Date(quote.validity_date).toLocaleDateString('en-US');
      doc.fillColor('#ef4444').font('Roboto-Bold').text(`Valid Until: ${validityStr}`, 310, cardY + 76);
    }

    // 4. LINE ITEMS SUMMARY TABLE
    let currentY = 265;

    doc.fillColor(brandIndigo).rect(50, currentY, 16, 16).fill();
    drawIcon(doc, ICONS.document, 52, currentY + 2, 12, '#ffffff');
    doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(11).text('COST SUMMARY & LINE ITEMS', 72, currentY + 4);

    const tableTop = currentY + 22;
    const headerHeight = 22;

    // Draw main Table Header
    doc.rect(50, tableTop, 495, headerHeight).fill(brandIndigo);
    doc.fillColor('#ffffff').font('Roboto-Bold').fontSize(9.5);
    doc.text('Item Description', 60, tableTop + 7);
    doc.text('HSN/SAC', 270, tableTop + 7, { width: 60, align: 'center' });
    doc.text('Qty', 335, tableTop + 7, { width: 35, align: 'center' });
    doc.text('Rate', 375, tableTop + 7, { width: 50, align: 'right' });
    doc.text('Disc.', 430, tableTop + 7, { width: 45, align: 'right' });
    doc.text('Total', 480, tableTop + 7, { width: 55, align: 'right' });

    let rowY = tableTop + headerHeight;
    const rowHeight = 24;

    doc.font('Roboto').fontSize(9).fillColor(textColor);

    const items = quote.items || [];
    items.forEach((item: any, index: number) => {
      // Zebra shading
      if (index % 2 === 1) {
        doc.rect(50, rowY, 495, rowHeight).fill(lightBg);
      }
      
      // Row borders
      doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(borderLight).lineWidth(0.5).stroke();
      
      // Cell values
      doc.fillColor(textColor)
        .font('Roboto-Bold').text(item.item_name, 60, rowY + 4)
        .font('Roboto').fontSize(7.5).fillColor('#64748b').text(item.description || '', 60, rowY + 14, { width: 200, height: 10, ellipsis: true })
        .fontSize(9).fillColor(textColor)
        .text(item.hsn_sac_code || '-', 270, rowY + 7, { width: 60, align: 'center' })
        .text(item.quantity.toString(), 335, rowY + 7, { width: 35, align: 'center' })
        .text(formatCurrency(item.rate), 370, rowY + 7, { width: 55, align: 'right' })
        .text(formatCurrency(item.discount || 0), 430, rowY + 7, { width: 45, align: 'right' })
        .text(formatCurrency((Number(item.quantity) * Number(item.rate)) - Number(item.discount || 0)), 480, rowY + 7, { width: 55, align: 'right' });

      // Outer columns borders
      doc.moveTo(50, rowY).lineTo(50, rowY + rowHeight).strokeColor(borderColor).lineWidth(0.5).stroke();
      doc.moveTo(545, rowY).lineTo(545, rowY + rowHeight).strokeColor(borderColor).lineWidth(0.5).stroke();

      rowY += rowHeight;
    });

    // Draw bottom table boundary line
    doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(borderColor).lineWidth(1).stroke();

    // Subtotal and Grand Total blocks
    doc.rect(340, rowY + 6, 110, 20).fill(lightBg).strokeColor(borderColor).lineWidth(0.5).stroke();
    doc.rect(450, rowY + 6, 95, 20).fill(lightBg).strokeColor(borderColor).lineWidth(0.5).stroke();
    doc.fillColor(textColor).font('Roboto').fontSize(8.5)
       .text('Subtotal Taxable:', 345, rowY + 12)
       .text(formatCurrency(quote.taxable_amount || 0), 455, rowY + 12, { width: 85, align: 'right' });

    doc.rect(340, rowY + 30, 110, 24).fill(brandIndigo);
    doc.rect(450, rowY + 30, 95, 24).fill(brandGreen);
    doc.fillColor('#ffffff').font('Roboto-Bold').fontSize(9.5)
       .text('Total Rounded:', 345, rowY + 38)
       .text(formatCurrency(quote.total_amount || 0), 455, rowY + 38, { width: 85, align: 'right' });

    // Transition to natural flow mode below table
    let flowY = rowY + 65;
    doc.y = flowY;

    // Helper to add dynamic page breaks safely
    const checkPageBreak = (heightNeeded: number) => {
      if (doc.y + heightNeeded > 780) {
        doc.addPage();
        doc.y = 50; // top margin on new page
      }
    };

    // 5. CONTENT BLOCKS (Scope of work, Terms, etc.)
    const contentBlocks = quote.content_blocks || [];
    if (contentBlocks.length > 0) {
      contentBlocks.forEach((cb: any) => {
        checkPageBreak(80);
        
        doc.y += 15;
        doc.fillColor(brandIndigo).rect(50, doc.y, 16, 16).fill();
        drawIcon(doc, ICONS.cog, 52, doc.y + 2, 10, '#ffffff');
        doc.fillColor(brandIndigo).font('Roboto-Bold').fontSize(11).text(cb.title.toUpperCase(), 72, doc.y + 4);
        
        doc.y += 22;
        doc.moveTo(50, doc.y - 4).lineTo(545, doc.y - 4).strokeColor(borderLight).lineWidth(0.8).stroke();
        
        doc.fillColor(textColor).font('Roboto').fontSize(9);
        const cleanedText = cleanHtmlText(cb.content);
        
        doc.text(cleanedText, 50, doc.y, { width: 495, align: 'left', lineGap: 3 });
        
        // Spacer after block text
        doc.y += 10;
      });
    }

    // 6. BANK DETAILS AND AUTHORIZED SIGNATORY BLOCK
    checkPageBreak(120);
    
    doc.y += 35;
    const footerStartY = doc.y;
    
    // Draw outer boundary line for footer section
    doc.moveTo(50, footerStartY).lineTo(545, footerStartY).strokeColor(borderColor).lineWidth(1).stroke();

    // Bank Details on the Left
    doc.y += 15;
    doc.fillColor(textColor).font('Roboto-Bold').fontSize(9.5).text('Bank Details for Wire Transfer:', 50, doc.y);
    doc.font('Roboto').fontSize(8.5).fillColor('#64748b');
    doc.text('Bank Name: Silicon Valley Commerce Bank', 50, doc.y + 16);
    doc.text('Account Name: SEETECH Solutions Inc.', 50, doc.y + 28);
    doc.text('Account Number: 98765432109876', 50, doc.y + 40);
    doc.text('IFSC / SWIFT: SVCB0000412', 50, doc.y + 52);

    // Signatory on the Right
    doc.moveTo(380, footerStartY + 65).lineTo(530, footerStartY + 65).strokeColor(borderColor).lineWidth(0.8).stroke();
    doc.fillColor(textColor).font('Roboto-Bold').fontSize(9).text('Authorized Signatory', 380, footerStartY + 72, { width: 150, align: 'center' });
    doc.font('Roboto').fontSize(8).fillColor('#94a3b8').text('SEETECH Solutions', 380, footerStartY + 84, { width: 150, align: 'center' });

    // 7. FOOTER ACCENTS
    doc.fillColor('#94a3b8').font('Roboto').fontSize(8)
       .text('Generated dynamically via PDFKit engine', 50, 808, { align: 'center' });

    // Decorative Angled Corner Accent Bars at the bottom
    doc.moveTo(0, 835).lineTo(30, 835).lineTo(45, 842).lineTo(0, 842).closePath().fill(brandIndigo);
    doc.moveTo(48, 842).lineTo(65, 842).lineTo(60, 839).lineTo(45, 839).closePath().fill(brandGreen);

    doc.moveTo(595, 835).lineTo(565, 835).lineTo(550, 842).lineTo(595, 842).closePath().fill(brandIndigo);
    doc.moveTo(547, 842).lineTo(530, 842).lineTo(535, 839).lineTo(550, 839).closePath().fill(brandGreen);

    // Finalize PDF
    doc.end();

    if (writeStream) {
      writeStream.on('finish', () => resolve(filePath!));
      writeStream.on('error', reject);
    } else {
      resolve('');
    }
  });
}
