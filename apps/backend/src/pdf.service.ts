import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from './prisma.service';
import { generateQuotePdf } from './pdf-generator';

@Injectable()
export class PdfService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}
  private storageDir = path.join(__dirname, '..', 'storage');

  onModuleInit() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async compilePdf(quotation: any): Promise<string> {
    // Ensure storage path matching pattern [QuotationNumber]_rev[Label].pdf
    const fileName = `${quotation.quotation_no}_rev${quotation.revision_label}.pdf`;
    const filePath = path.join(this.storageDir, fileName);

    console.log(`--- compilePdf: Compiling PDF using PDFKit for ${quotation.quotation_no} at ${filePath}`);
    await generateQuotePdf(quotation, null, filePath);

    // Generate SHA-256 checksum
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Store hash in database
    await this.prisma.quotation.update({
      where: { id: quotation.id },
      data: { pdf_hash: hash },
    });

    return filePath;
  }

  getStorageDirectory(): string {
    return this.storageDir;
  }

  generateHtml(quotation: any): string {
    const itemsRows = quotation.items.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #1e293b;">${item.item_name}</strong>
          ${item.description ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">${item.description}</p>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${item.hsn_sac_code || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.rate).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #ef4444;">$${Number(item.discount || 0).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #4f46e5;">
          $${(Number(item.quantity) * Number(item.rate) - Number(item.discount || 0)).toFixed(2)}
        </td>
      </tr>
    `).join('');

    const contentBlocksHtml = quotation.content_blocks.map((cb: any) => `
      <div style="margin-top: 25px; page-break-inside: avoid;">
        <h3 style="border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; color: #1e293b; font-size: 14px; text-transform: uppercase;">
          ${cb.title}
        </h3>
        <div style="font-size: 12px; color: #334155; line-height: 1.6; font-family: sans-serif;">
          ${cb.content}
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            margin: 0;
            padding: 0;
            font-size: 12px;
          }
          .header-table, .client-table, .items-table, .footer-table {
            width: 100%;
            border-collapse: collapse;
          }
          .header-title {
            font-size: 24px;
            font-weight: bold;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .label {
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <!-- Company Letterhead -->
        <table class="header-table" style="margin-bottom: 30px;">
          <tr>
            <td>
              <span class="header-title">SEETECH Solutions</span>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px;">
                100 Innovation Parkway, Suite 400<br>
                Tech City, CA 94016<br>
                contact@seetechsolutions.com | +1 (555) 019-2834
              </p>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <h1 style="margin: 0; color: #1e293b; font-size: 20px; text-transform: uppercase;">Quotation</h1>
              <table style="float: right; margin-top: 10px; font-size: 11px;">
                <tr>
                  <td style="padding: 2px 10px; font-weight: bold; color: #64748b;">QUOTE NO:</td>
                  <td style="padding: 2px 10px; font-family: monospace; font-weight: bold; color: #4f46e5;">${quotation.quotation_no}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 10px; font-weight: bold; color: #64748b;">REVISION:</td>
                  <td style="padding: 2px 10px; font-family: monospace;">Index ${quotation.revision_index} (${quotation.revision_label})</td>
                </tr>
                <tr>
                  <td style="padding: 2px 10px; font-weight: bold; color: #64748b;">DATE:</td>
                  <td style="padding: 2px 10px;">${new Date(quotation.created_at).toLocaleDateString()}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Client Info Details -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
          <table class="client-table">
            <tr>
              <td style="width: 60%; vertical-align: top;">
                <span class="label">Prepared For:</span>
                <h2 style="margin: 5px 0; font-size: 14px; color: #1e293b;">${quotation.client_name}</h2>
                <p style="margin: 0; color: #475569; line-height: 1.4;">
                  ${quotation.client_address ? quotation.client_address.replace(/\n/g, '<br>') : ''}
                </p>
                ${quotation.client_contact ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #64748b;">Contact: ${quotation.client_contact}</p>` : ''}
              </td>
              <td style="vertical-align: top;">
                ${quotation.subject ? `
                  <span class="label">Subject Reference:</span>
                  <p style="margin: 5px 0 0 0; font-weight: bold; color: #334155; line-height: 1.4;">
                    ${quotation.subject}
                  </p>
                ` : ''}
                ${quotation.validity_date ? `
                  <div style="margin-top: 10px;">
                    <span class="label">Valid Until:</span>
                    <p style="margin: 3px 0 0 0; font-weight: bold; color: #ef4444;">
                      ${new Date(quotation.validity_date).toLocaleDateString()}
                    </p>
                  </div>
                ` : ''}
              </td>
            </tr>
          </table>
        </div>

        <!-- Line Items Grid -->
        <table class="items-table">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left;">
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569;">Description</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; width: 12%;">HSN/SAC</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right; width: 8%;">Qty</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right; width: 12%;">Rate</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right; width: 12%;">Discount</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right; width: 15%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Totals summary block -->
        <div style="float: right; width: 35%; margin-top: 20px; font-size: 12px; page-break-inside: avoid;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Subtotal Taxable:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold;">$${Number(quotation.taxable_amount).toFixed(2)}</td>
            </tr>
            <tr style="border-top: 2px solid #1e293b;">
              <td style="padding: 10px 0; font-weight: bold; color: #4f46e5; font-size: 14px;">Total rounded:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #4f46e5; font-size: 14px;">$${Number(quotation.total_amount).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        <div style="clear: both;"></div>

        <!-- Rich-Text Content Blocks (Scope, terms, specifications) -->
        ${contentBlocksHtml}

        <!-- Bank Details and Signatory signature block -->
        <div style="margin-top: 50px; page-break-inside: avoid;">
          <table class="footer-table">
            <tr>
              <td style="width: 50%; vertical-align: top; font-size: 11px; color: #64748b; line-height: 1.5;">
                <strong style="color: #475569; text-transform: uppercase; font-size: 10px;">Bank Details for Wire Transfer:</strong><br>
                Bank Name: Silicon Valley Commerce Bank<br>
                Account Name: SEETECH Solutions Inc.<br>
                Account Number: 98765432109876<br>
                IFSC / SWIFT: SVCB0000412
              </td>
              <td style="text-align: right; vertical-align: bottom;">
                <div style="display: inline-block; text-align: center; width: 200px;">
                  <div style="height: 60px; border-bottom: 1px solid #94a3b8;"></div>
                  <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase;">Authorized Signatory</p>
                  <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">SEETECH Solutions</p>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }
}
