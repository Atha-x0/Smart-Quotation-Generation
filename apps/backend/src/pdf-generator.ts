import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper to draw SVG paths for icons
 */
function drawIcon(doc: any, pathStr: string, x: number, y: number, size = 8, fillColor = '#1A1A1A') {
  doc.save();
  doc.translate(x, y);
  const scale = size / 16; // Icons designed on a 16x16 grid
  doc.scale(scale);
  doc.path(pathStr).fillColor(fillColor).fill();
  doc.restore();
}

const ICONS = {
  mapPin: 'M8 0C3.58 0 0 3.58 0 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
  phone: 'M3.62 1.03c.53.53.94 1.18 1.25 1.86.13.29.07.63-.15.86l-.86.86c.64 1.37 1.76 2.49 3.13 3.13l.86-.86c.23-.23.57-.28.86-.15.68.31 1.33.72 1.86 1.25.39.39.41 1.02.05 1.43l-1.3 1.3c-.56.56-1.46.67-2.14.28-2.61-1.48-4.73-3.6-6.21-6.21-.39-.68-.28-1.58.28-2.14l1.3-1.3c.41-.36 1.04-.34 1.43.05z',
  envelope: 'M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm2 1.6V14h12V3.6L8 8.4 2 3.6zM8 6.6L13.8 2H2.2L8 6.6z',
  globe: 'M8 0a8 8 0 100 16A8 8 0 008 0zm0 1.5c1.17 0 2.26.33 3.19.89L9.61 4H6.39L4.81 2.39A6.47 6.47 0 018 1.5zM3.46 3.13L5.04 5h5.92l1.58-1.87A6.45 6.45 0 0114.27 8h-2.18c-.28-1.78-1.07-3.32-2.19-4.43A6.46 6.46 0 0113.1 6.5h-1.57a4.97 4.97 0 00-.73-2.19c-.43.76-.94 1.45-1.5 2.05L8.5 7.17v5.66l.8-1.2c.56.6 1.07 1.29 1.5 2.05.3-.65.55-1.38.73-2.19h1.57a6.46 6.46 0 01-3.26 3.16c1.12-1.11 1.91-2.65 2.19-4.43h2.18a6.45 6.45 0 01-1.68 3.51M8.5 1.52v5.15L9.19 6h-2.38L7.5 6.67v5.66L6.81 10h2.38L8.5 1.52zm-.69 11.31l-.8 1.2a4.97 4.97 0 00-.73-2.19c-.43.76-.94 1.45-1.5 2.05L3.46 12.87a6.45 6.45 0 011.68-3.51h2.18c.28 1.78 1.07 3.32 2.19 4.43a6.46 6.46 0 01-3.26-3.16h-1.57c.18.81.43 1.54.73 2.19-.56-.6-1.07-1.29-1.5-2.05l-.8 1.2v-.01z',
  cog: 'M8 6 C6.9 6 6 6.9 6 8 C6 9.1 6.9 10 8 10 C9.1 10 10 9.1 10 8 C10 6.9 9.1 6 8 6 Z M8 1 C7.5 1 7.1 1.3 7 1.8 L6.7 3 C6.1 3.2 5.6 3.5 5.1 3.9 L4 3.1 C3.6 2.8 3.1 2.9 2.8 3.3 L1.3 5.9 C1.1 6.3 1.2 6.8 1.6 7.1 L2.6 7.9 C2.5 8.2 2.5 8.5 2.6 8.8 L1.6 9.6 C1.2 9.9 1.1 10.4 1.3 10.8 L2.8 13.4 C3.1 13.8 3.6 13.9 4.0 13.6 L5.1 12.8 C5.6 13.2 6.1 13.5 6.7 13.7 L7.0 14.9 C7.1 15.4 7.5 15.7 8.0 15.7 C8.5 15.7 8.9 15.4 9.0 14.9 L9.3 13.7 C9.9 13.5 10.4 13.2 10.9 12.8 L12.0 13.6 C12.4 13.9 12.9 13.8 13.2 13.4 L14.7 10.8 C14.9 10.4 14.8 9.9 14.4 9.6 L13.4 8.8 C13.5 8.5 13.5 8.2 13.4 7.9 L14.4 7.1 C14.8 6.8 14.9 6.3 14.7 5.9 L13.2 3.3 C12.9 2.9 12.4 2.8 12.0 3.1 L10.9 3.9 C10.4 3.5 9.9 3.2 9.3 3.0 L9.0 1.8 C8.9 1.3 8.5 1 8.0 1 Z',
  droplet: 'M8 0 C8 0 2 6 2 10.5 C2 13.5 4.7 16 8 16 C11.3 16 14 13.5 14 10.5 C14 6 8 0 8 0 Z',
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

function numberToWords(num: number): string {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if ((num = Math.floor(num)) === 0) return 'zero';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += Number(n[1]) != 0 ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += Number(n[2]) != 0 ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += Number(n[3]) != 0 ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += Number(n[4]) != 0 ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += Number(n[5]) != 0 ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' rupees only';
}

export function generateQuotePdf(quote: any, res: any = null, filePath: string | null = null): Promise<string> {
  return new Promise((resolve, reject) => {
    // A4: 595.28 x 841.89 pt
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

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

    // Page margins and setup
    const leftMargin = 40;
    const rightMargin = 40;
    const contentWidth = 595.28 - (leftMargin + rightMargin); // 515.28
    let currentY = 40;

    // Helper to draw clean lines representing user input fields
    const drawFieldLine = (startX: number, endX: number, y: number) => {
      doc.moveTo(startX, y).lineTo(endX, y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    };

    // Helper to write text with an underline
    const drawFieldWithUnderline = (label: string, value: string, x: number, y: number, labelWidth: number, valueWidth: number) => {
      doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(8.5).text(label, x, y, { width: labelWidth });
      doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(8.5).text(':', x + labelWidth - 8, y);
      doc.fillColor('#333333').font('Roboto').fontSize(8.5).text(value || '', x + labelWidth, y, { width: valueWidth });
      drawFieldLine(x + labelWidth, x + labelWidth + valueWidth, y + 10);
    };

    // Header drawing function (can be repeated or drawn on first page)
    const drawHeader = () => {
      // Left Logo Section
      let logoPath = path.join(process.cwd(), 'seetech-logo.png');
      if (!fs.existsSync(logoPath)) {
        logoPath = path.join(__dirname, '..', '..', 'seetech-logo.png');
      }
      
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, leftMargin, currentY + 5, { width: 145 });
      } else {
        doc.fillColor('#3ba846').font('Roboto-Bold').fontSize(24).text('SEE', leftMargin, currentY, { continued: true });
        doc.fillColor('#2d5ca6').font('Roboto-Bold').fontSize(24).text(' TECH');
        doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(9.5).text('SYSTEMS PVT. LTD.', leftMargin, currentY + 28);
        doc.moveTo(leftMargin, currentY + 42).lineTo(leftMargin + 150, currentY + 42).strokeColor('#3ba846').lineWidth(1.5).stroke();
        doc.fillColor('#666666').font('Roboto-Italic').fontSize(7.5).text('energy savings delivered...', leftMargin, currentY + 47);
      }

      // Vertical Divider
      doc.moveTo(205, currentY).lineTo(205, currentY + 60).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

      // Middle Company Info Section
      let midX = 215;
      let midY = currentY;
      
      // Address Row (takes 3 lines, height ~24)
      drawIcon(doc, ICONS.mapPin, midX, midY + 1, 8, '#3ba846');
      doc.fillColor('#333333').font('Roboto').fontSize(7.5).text(
        '11/5, IT Park, S Ambazari Rd,\nOpposite VNIT, Nagpur, Maharashtra 440022',
        midX + 12,
        midY,
        { width: 140, lineGap: 1 }
      );

      const addressHeight = doc.heightOfString(
        '11/5, IT Park, S Ambazari Rd,\nOpposite VNIT, Nagpur, Maharashtra 440022',
        { width: 140, lineGap: 1 }
      );

      // Phone Row
      let phoneY = midY + addressHeight + 3;
      drawIcon(doc, ICONS.phone, midX, phoneY + 1, 8, '#3ba846');
      doc.fillColor('#333333').font('Roboto').fontSize(7.5).text('+91 9422145534', midX + 12, phoneY);

      // Email Row
      let emailY = phoneY + 12;
      drawIcon(doc, ICONS.envelope, midX, emailY + 1, 8, '#3ba846');
      doc.fillColor('#333333').font('Roboto').fontSize(7.5).text('info@seetechsolutions.in', midX + 12, emailY);

      // Website Row
      let webY = emailY + 12;
      drawIcon(doc, ICONS.globe, midX, webY + 1, 8, '#3ba846');
      doc.fillColor('#333333').font('Roboto').fontSize(7.5).text('www.seetechsolutions.in', midX + 12, webY);

      // Vertical Divider
      let dividerHeight = Math.max(60, (webY + 8) - currentY);
      doc.moveTo(205, currentY).lineTo(205, currentY + dividerHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

      // Right Section: Quotation Details
      let rightX = 370;
      let rightY = currentY;

      doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(18).text('QUOTATION', rightX, rightY, { width: contentWidth - (rightX - leftMargin), align: 'left' });

      const dateStr = new Date(quote.created_at || Date.now()).toLocaleDateString('en-IN');
      const quoteNum = quote.quotation_no || `QT-${new Date(quote.created_at || Date.now()).toISOString().slice(0, 10).replace(/-/g, '')}-${String(quote.id).padStart(4, '0')}`;
      const validityStr = quote.validity_date ? new Date(quote.validity_date).toLocaleDateString('en-IN') : '';

      let fieldY = rightY + 24;
      drawFieldWithUnderline('Quotation No.', quoteNum, rightX, fieldY, 65, 80);
      drawFieldWithUnderline('Date', dateStr, rightX, fieldY + 14, 65, 80);
      drawFieldWithUnderline('Valid Until', validityStr, rightX, fieldY + 28, 65, 80);
      drawFieldWithUnderline('Prepared By', 'SEETECH Solutions', rightX, fieldY + 42, 65, 80);

      currentY += 88;
      
      // Bottom divider line
      doc.moveTo(leftMargin, currentY).lineTo(595.28 - rightMargin, currentY).strokeColor('#1A1A1A').lineWidth(1).stroke();
      currentY += 10;
    };

    doc.on('pageAdded', () => {
      currentY = 40;
      drawHeader();
    });

    drawHeader();

    // Client Details Section
    const drawClientDetails = () => {
      let clientY = currentY;
      
      const contactParts = (quote.client_contact || '').split(' | ');
      const contactName = contactParts[0] || '';
      const contactPhone = contactParts[1] || '';

      drawFieldWithUnderline('Client Name', quote.client_name || '', leftMargin, clientY, 110, 405);
      clientY += 14;
      drawFieldWithUnderline('Contact Person', contactName || 'N/A', leftMargin, clientY, 110, 405);
      clientY += 14;
      drawFieldWithUnderline('Contact Number', contactPhone || 'N/A', leftMargin, clientY, 110, 405);
      clientY += 14;
      drawFieldWithUnderline('Client Address', quote.client_address || '', leftMargin, clientY, 110, 405);
      clientY += 14;
      drawFieldWithUnderline('Subject / Reference', quote.subject || '', leftMargin, clientY, 110, 405);

      currentY = clientY + 14;
    };

    drawClientDetails();

    // Items Table Redesign
    const tableTop = currentY;
    const headerHeight = 18;

    // Draw main Table Header box
    doc.rect(leftMargin, tableTop, contentWidth, headerHeight).fill('#F2F2F2');
    doc.rect(leftMargin, tableTop, contentWidth, headerHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();    const colX = {
      sl: leftMargin, // 40
      name: leftMargin + 25, // 65
      desc: leftMargin + 115, // 155
      hsn: leftMargin + 225, // 265
      qty: leftMargin + 285, // 325
      unit: leftMargin + 320, // 360
      rate: leftMargin + 355, // 395
      discount: leftMargin + 405, // 445
      amount: leftMargin + 450 // 490
    };

    const colWidths = {
      sl: 25,
      name: 90,
      desc: 110,
      hsn: 60,
      qty: 35,
      unit: 35,
      rate: 50,
      discount: 45,
      amount: 65.28
    };

    doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(8);
    doc.text('Sr. No.', colX.sl, tableTop + 5, { width: colWidths.sl, align: 'center' });
    doc.text('Item Name', colX.name + 3, tableTop + 5, { width: colWidths.name - 3 });
    doc.text('Description', colX.desc + 3, tableTop + 5, { width: colWidths.desc - 3 });
    doc.text('HSN/SAC Code', colX.hsn, tableTop + 5, { width: colWidths.hsn, align: 'center' });
    doc.text('QTY', colX.qty, tableTop + 5, { width: colWidths.qty, align: 'center' });
    doc.text('Unit', colX.unit, tableTop + 5, { width: colWidths.unit, align: 'center' });
    doc.text('Rate (₹)', colX.rate, tableTop + 5, { width: colWidths.rate, align: 'right' });
    doc.text('Discount', colX.discount, tableTop + 5, { width: colWidths.discount, align: 'right' });
    doc.text('Total Amount (₹)', colX.amount, tableTop + 5, { width: colWidths.amount - 2, align: 'right' });

    let rowY = tableTop + headerHeight;
    const items = quote.items || [];
    const displayRowsCount = items.length;

    const formatCurrency = (val: any) => {
      return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    let totalGrossAmount = 0;
    let totalDiscount = 0;
    let localTableTop = tableTop;

    const colLines = [
      colX.name,
      colX.desc,
      colX.hsn,
      colX.qty,
      colX.unit,
      colX.rate,
      colX.discount,
      colX.amount
    ];

    for (let i = 0; i < displayRowsCount; i++) {
      const item = items[i];
      
      let itemRowHeight = 18;
      let nameHeight = 0;
      let descHeight = 0;

      if (item) {
        // Measure string heights dynamically (adding padding)
        nameHeight = doc.heightOfString(item.item_name || '', { width: colWidths.name - 5 }) + 8;
        descHeight = doc.heightOfString(item.description || '', { width: colWidths.desc - 5 }) + 8;
        itemRowHeight = Math.max(itemRowHeight, nameHeight, descHeight);
      }

      // Check page overflow
      if (rowY + itemRowHeight > 780) {
        // Draw vertical lines on the ending page
        colLines.forEach((x) => {
          doc.moveTo(x, localTableTop).lineTo(x, rowY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
        });

        doc.addPage();
        rowY = currentY;
        localTableTop = currentY;

        // Draw header box on new page
        doc.rect(leftMargin, rowY, contentWidth, headerHeight).fill('#F2F2F2');
        doc.rect(leftMargin, rowY, contentWidth, headerHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
        
        doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(8);
        doc.text('Sr. No.', colX.sl, rowY + 5, { width: colWidths.sl, align: 'center' });
        doc.text('Item Name', colX.name + 3, rowY + 5, { width: colWidths.name - 3 });
        doc.text('Description', colX.desc + 3, rowY + 5, { width: colWidths.desc - 3 });
        doc.text('HSN/SAC Code', colX.hsn, rowY + 5, { width: colWidths.hsn, align: 'center' });
        doc.text('QTY', colX.qty, rowY + 5, { width: colWidths.qty, align: 'center' });
        doc.text('Unit', colX.unit, rowY + 5, { width: colWidths.unit, align: 'center' });
        doc.text('Rate (₹)', colX.rate, rowY + 5, { width: colWidths.rate, align: 'right' });
        doc.text('Discount', colX.discount, rowY + 5, { width: colWidths.discount, align: 'right' });
        doc.text('Total Amount (₹)', colX.amount, rowY + 5, { width: colWidths.amount - 2, align: 'right' });

        rowY += headerHeight;
      }

      // Draw row box
      doc.rect(leftMargin, rowY, contentWidth, itemRowHeight).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      
      if (item) {
        const qty = Number(item.quantity || 0);
        const rate = Number(item.rate || 0);
        const discount = Number(item.discount || 0);
        const itemTotal = (qty * rate) - discount;

        totalGrossAmount += qty * rate;
        totalDiscount += discount;

        doc.fillColor('#333333').font('Roboto').fontSize(8)
          .text((i + 1).toString(), colX.sl, rowY + 5, { width: colWidths.sl, align: 'center' })
          .text(item.item_name || '', colX.name + 3, rowY + 5, { width: colWidths.name - 5 })
          .text(item.description || '', colX.desc + 3, rowY + 5, { width: colWidths.desc - 5 })
          .text(item.hsn_sac_code || '-', colX.hsn, rowY + 5, { width: colWidths.hsn, align: 'center' })
          .text(qty.toString(), colX.qty, rowY + 5, { width: colWidths.qty, align: 'center' })
          .text(item.unit || '-', colX.unit, rowY + 5, { width: colWidths.unit, align: 'center' })
          .text(formatCurrency(rate), colX.rate, rowY + 5, { width: colWidths.rate, align: 'right' })
          .text(discount > 0 ? formatCurrency(discount) : '-', colX.discount, rowY + 5, { width: colWidths.discount, align: 'right' })
          .text(formatCurrency(itemTotal), colX.amount, rowY + 5, { width: colWidths.amount - 2, align: 'right' });
      }

      rowY += itemRowHeight;
    }

    // Draw vertical gridlines for the final page
    colLines.forEach((x) => {
      doc.moveTo(x, localTableTop).lineTo(x, rowY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    });

    currentY = rowY + 8; rowY + 8;

    // Check space for totals box
    if (currentY > 675) {
      doc.addPage();
    }

    const totalTaxableVal = Number(quote.taxable_amount || 0);
    const cgstVal = totalTaxableVal * 0.09;
    const sgstVal = totalTaxableVal * 0.09;
    const grandTotalVal = Math.round(totalTaxableVal + cgstVal + sgstVal);

    // Amount in Words
    const amountInWordsText = numberToWords(grandTotalVal);

    doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(8).text('Amount in Words:', leftMargin, currentY);
    doc.fillColor('#333333').font('Roboto').fontSize(8).text(amountInWordsText, leftMargin + 80, currentY, { width: 200 });

    // Right Side: Summary totals box
    const totalBoxWidth = 190;
    const totalBoxX = 595.28 - rightMargin - totalBoxWidth;
    let tY = currentY - 8; // align with amount in words block top

    const drawTotalRow = (label: string, valStr: string, isBold = false) => {
      doc.rect(totalBoxX, tY, totalBoxWidth, 15).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      doc.fillColor('#1A1A1A').font(isBold ? 'Roboto-Bold' : 'Roboto').fontSize(8)
         .text(label, totalBoxX + 6, tY + 4);
      doc.text('₹ ' + valStr, totalBoxX + 110, tY + 4, { width: totalBoxWidth - 116, align: 'right' });
      tY += 15;
    };

    drawTotalRow('Total Amount', formatCurrency(totalGrossAmount));
    drawTotalRow('Discount', formatCurrency(totalDiscount));
    drawTotalRow('Total Taxable Amount', formatCurrency(totalTaxableVal));
    drawTotalRow('CGST ( 9% )', formatCurrency(cgstVal));
    drawTotalRow('SGST / IGST ( 9% )', formatCurrency(sgstVal));
    drawTotalRow('Grand Total', formatCurrency(grandTotalVal), true);

    currentY = Math.max(currentY + 50, tY + 10);


    // Render Content Blocks dynamically (Scope of Work, Terms, Tech Specs)
    const contentBlocks = quote.content_blocks || [];
    
    const renderContentBlock = (title: string, text: string) => {
      if (!text || !text.trim()) return;
      
      // Check space
      if (currentY > 740) {
        doc.addPage();
      }

      doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(9).text(title, leftMargin, currentY);
      currentY += 14;

      const paragraphs = text.split('\n\n');
      paragraphs.forEach((para) => {
        if (!para.trim()) return;
        
        const lines = para.split('\n');
        lines.forEach((line) => {
          if (!line.trim()) return;
          const lineHeight = doc.heightOfString(line.trim(), { width: contentWidth, align: 'justify', lineGap: 3.5 });
          
          if (currentY + lineHeight > 780) {
            doc.addPage();
          }
          
          doc.fillColor('#333333').font('Roboto').fontSize(8.5).text(line.trim(), leftMargin, currentY, { 
            width: contentWidth, 
            align: 'justify',
            lineGap: 3.5
          });
          currentY += lineHeight + 4;
        });
        currentY += 6;
      });
      currentY += 5;
    };

    // Filter content blocks by type
    const scopeBlock = contentBlocks.find((cb: any) => cb.block_type === 'scope_of_work');
    const termsBlock = contentBlocks.find((cb: any) => cb.block_type === 'terms_conditions');
    const paymentBlock = contentBlocks.find((cb: any) => cb.block_type === 'payment_terms');
    const specBlock = contentBlocks.find((cb: any) => cb.block_type === 'technical_spec');

    if (scopeBlock) {
      renderContentBlock('Scope of Work:', cleanHtmlText(scopeBlock.content));
    }

    if (termsBlock) {
      // Clean terms block content, filter out duplicate payment terms references, and convert bullets to sequential numbers
      const rawText = cleanHtmlText(termsBlock.content);
      const lines = rawText.split('\n')
        .map(l => l.replace(/^[•\-\*\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(l => l.length > 0)
        // Filter out any lines discussing payment terms to avoid duplication
        .filter(l => !l.toLowerCase().includes('payment terms') && !l.toLowerCase().includes('payment shall be'));
      
      const numberedTermsText = lines.map((line, idx) => `${idx + 1}. ${line}`).join('\n');
      renderContentBlock('Terms & Conditions:', numberedTermsText);
    }

    // Always render Payment Terms section separately after
    let paymentTermsText = 'Payment terms shall be as mentioned in the commercial summary of this quotation.';
    if (paymentBlock) {
      const rawPaymentText = cleanHtmlText(paymentBlock.content);
      const paymentLines = rawPaymentText.split('\n')
        .map(l => l.replace(/^[•\-\*\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(l => l.length > 0);
      if (paymentLines.length > 0) {
        paymentTermsText = paymentLines.map((line, idx) => paymentLines.length > 1 ? `${idx + 1}. ${line}` : line).join('\n');
      }
    }
    renderContentBlock('Payment Terms:', paymentTermsText);

    if (specBlock) {
      renderContentBlock('Technical Specifications:', cleanHtmlText(specBlock.content));
    }

    // 5. INTERNAL ENGINEERING MATERIALS LIST
    const out = quote.outputSnapshot || (quote.output_snapshot_json ? JSON.parse(quote.output_snapshot_json) : null);
    if (out) {
      // Check if there is enough space on the current page for the materials list (approx 190 pt)
      if (currentY + 190 > 780) {
        doc.addPage();
      } else {
        currentY += 15;
      }

      const brandBlue = '#1b4c80';
      const brandGreen = '#3ba846';
      const lightBg = '#f8fafc';
      const borderColor = '#cbd5e1';
      const textColor = '#334155';

      doc.fillColor(brandBlue).rect(50, currentY, 16, 16).fill();
      drawIcon(doc, ICONS.cog, 52, currentY + 2, 12, '#ffffff');
      doc.fillColor(brandBlue).font('Roboto-Bold').fontSize(11).text('INTERNAL ENGINEERING MATERIALS LIST', 72, currentY + 4);

      const engBoxY = currentY + 22;
      const engBoxHeight = 158;

      // Main Box
      doc.roundedRect(50, engBoxY, 495, engBoxHeight, 6).fill(lightBg).strokeColor(borderColor).lineWidth(1).stroke();

      // Column 1
      const col1X = 65;
      const colTopY = engBoxY + 12;

      // Subheader: Cooling Pads Details
      drawIcon(doc, ICONS.grid, col1X, colTopY + 2, 10, brandGreen);
      doc.fillColor(brandGreen).font('Roboto-Bold').fontSize(10).text('Cooling Pads Details:', col1X + 16, colTopY + 2);
      
      doc.fillColor(textColor).font('Roboto').fontSize(8.5);
      doc.text(`• Total pads: ${out.pads ? out.pads.totalPads : 0} sheet(s)`, col1X, colTopY + 17);
      doc.text(`• Details per selected face:`, col1X, colTopY + 27);

      let padDetailY = colTopY + 37;
      if (out.pads && out.pads.breakdown) {
        out.pads.breakdown.forEach((fd: any) => {
          doc.text(`  - ${fd.name}: ${fd.padsAcrossWidth}W x ${fd.padsAcrossHeight}H = ${fd.padsForFace} pads`, col1X, padDetailY);
          padDetailY += 10;
        });
      }

      // Subheader: Pumps & Plumbing Sizing
      const pumpTopY = colTopY + 84;
      drawIcon(doc, ICONS.droplet, col1X, pumpTopY + 2, 10, brandBlue);
      doc.fillColor(brandBlue).font('Roboto-Bold').fontSize(10).text('Pumps & Plumbing Sizing:', col1X + 16, pumpTopY + 2);
      
      doc.fillColor(textColor).font('Roboto').fontSize(8.5);
      doc.text(`• Flow required: ${out.pumpPlumbing ? out.pumpPlumbing.requiredFlowLPH.toFixed(2) : 0} LPH`, col1X, pumpTopY + 17);
      doc.text(`• Selected Pump: ${out.pumpPlumbing && out.pumpPlumbing.selectedPump ? out.pumpPlumbing.selectedPump.modelName : 'N/A'}`, col1X, pumpTopY + 27);
      doc.text(`  (Capacity: ${out.pumpPlumbing && out.pumpPlumbing.selectedPump ? out.pumpPlumbing.selectedPump.capacityLPH : 0} LPH)`, col1X, pumpTopY + 37);

      // Dashed Vertical Separator Line
      doc.save();
      doc.moveTo(298, engBoxY + 10).lineTo(298, engBoxY + engBoxHeight - 10)
         .strokeColor(borderColor).lineWidth(0.8).dash(3, { space: 3 }).stroke();
      doc.restore();

      // Column 2
      const col2X = 315;
      
      // Subheader: Metal & Frame Work
      drawIcon(doc, ICONS.box, col2X, colTopY + 2, 10, brandGreen);
      doc.fillColor(brandGreen).font('Roboto-Bold').fontSize(10).text('Metal & Frame Work:', col2X + 16, colTopY + 2);

      doc.fillColor(textColor).font('Roboto').fontSize(8.5);
      doc.text(`• Outer frame bars: ${out.frame ? out.frame.barsNeeded : 0} pcs`, col2X, colTopY + 17);
      doc.text(`  - Total Length: ${out.frame ? out.frame.totalLength.toFixed(0) : 0} mm`, col2X, colTopY + 27);
      
      doc.text(`• Patti (Vertical joints): ${out.patti ? out.patti.barsNeeded : 0} pcs`, col2X, colTopY + 41);
      doc.text(`  - Patti posts count: ${out.patti ? out.patti.postsCount : 0} pcs`, col2X, colTopY + 51);
      
      doc.text(`• Plate sheets (bottom + sides): ${out.plates ? out.plates.sheetsNeeded : 0} pcs`, col2X, colTopY + 65);
      doc.text(`  - Total Plate Area: ${out.plates ? out.plates.totalArea.toFixed(0) : 0} mm²`, col2X, colTopY + 75);

      currentY = engBoxY + engBoxHeight + 15;
    }

    // Add Thank you footer at the bottom of the last page
    if (currentY > 745) {
      doc.addPage();
    }

    // Push footer to bottom of current page
    const footerY = 760;
    doc.moveTo(leftMargin, footerY - 5).lineTo(595.28 - rightMargin, footerY - 5).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

    doc.fillColor('#1A1A1A').font('Roboto-Bold').fontSize(9).text('Thank you for your business!', leftMargin, footerY, { width: contentWidth, align: 'center' });
    doc.fillColor('#666666').font('Roboto').fontSize(7.5).text('This quotation is confidential and intended solely for the recipient.', leftMargin, footerY + 12, { width: contentWidth, align: 'center' });

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
