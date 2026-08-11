import { Injectable, OnModuleInit } from '@nestjs/common';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export interface BackendHsnCode {
  id: string;
  code: string;
  description: string;
  itemNameMatch: string;
}

@Injectable()
export class HsnService implements OnModuleInit {
  private hsnCodes: BackendHsnCode[] = [];

  onModuleInit() {
    this.loadHsnCodes();
  }

  loadHsnCodes() {
    try {
      // Find the file path
      const possiblePaths = [
        path.join(process.cwd(), 'HSN CODE.xlsx'),
        path.join(process.cwd(), '..', '..', 'HSN CODE.xlsx'),
        path.join(__dirname, '..', '..', 'HSN CODE.xlsx'),
        path.join(__dirname, '..', '..', '..', 'HSN CODE.xlsx'),
      ];

      let filePath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }

      if (!filePath) {
        console.error('HsnService: HSN CODE.xlsx file not found in possible paths:', possiblePaths);
        return;
      }

      console.log('HsnService: Reading HSN codes from', filePath);
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(worksheet) as any[];

      const parsed: BackendHsnCode[] = [];
      // Row 0 is the headers: Sr No., HSN/SAC, HSC Code Descriptions, Description of See-Tech Solutions Pvt Ltd.
      // So data rows start from index 1.
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const codeVal = row['__EMPTY'];
        const descVal = row['__EMPTY_1'];
        const matchVal = row['__EMPTY_2'];

        if (codeVal) {
          parsed.push({
            id: String(i),
            code: String(codeVal).trim(),
            description: descVal ? String(descVal).trim() : '',
            itemNameMatch: matchVal ? String(matchVal).trim() : '',
          });
        }
      }

      this.hsnCodes = parsed;
      console.log(`HsnService: Successfully loaded ${this.hsnCodes.length} HSN codes.`);
    } catch (err) {
      console.error('HsnService: Failed to read/parse HSN Excel file:', err);
    }
  }

  getHsnCodes(): BackendHsnCode[] {
    if (this.hsnCodes.length === 0) {
      this.loadHsnCodes();
    }
    return this.hsnCodes;
  }
}
