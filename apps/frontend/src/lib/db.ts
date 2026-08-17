import Dexie, { type Table } from 'dexie';
import { type HsnCode } from './hsnData';

export interface LocalQuotationItem {
  item_name: string;
  description?: string;
  hsn_sac_code?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discount?: number;
  taxable_amount?: number;
}

export interface LocalContentBlock {
  block_type: string;
  source: string;
  title: string;
  content: string;
  category_tag?: string;
  sort_order?: number;
}

export interface LocalQuotation {
  id: string; // uuid for local, will be server's id once synced
  quotation_no: string; // temp uuid or server's sequential no
  revision_index: number;
  revision_label: string;
  client_name: string;
  client_address?: string;
  client_contact?: string;
  validity_date?: string;
  subject?: string;
  taxable_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  items: LocalQuotationItem[];
  content_blocks: LocalContentBlock[];
  sync_status: 'synced' | 'pending';
}

export interface OutboxEntry {
  id?: number;
  action: 'create' | 'create_revision';
  quotation_id: string; // links to the local quotation.id
  quotation_no?: string; // used for create_revision
  payload: any;
  timestamp: number;
}

export interface LocalProduct {
  id: string;
  item_name: string;
  description?: string;
  hsn_sac_code?: string;
  rate: number;
}

export interface LocalTemplate {
  id: string;
  title: string;
  content: string;
}

export class SmartQuotationDatabase extends Dexie {
  quotations!: Table<LocalQuotation>;
  outbox!: Table<OutboxEntry>;
  hsnCodes!: Table<HsnCode>;
  products!: Table<LocalProduct>;
  templates!: Table<LocalTemplate>;

  constructor() {
    super('SmartQuotationDB');
    this.version(3).stores({
      quotations: 'id, quotation_no, sync_status, created_at',
      outbox: '++id, quotation_id, timestamp',
      hsnCodes: 'id, code, description',
      products: 'id, item_name, hsn_sac_code',
      templates: 'id, title'
    });
  }
}

export const db = new SmartQuotationDatabase();

