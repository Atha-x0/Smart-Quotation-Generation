'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Fuse from 'fuse.js';
import * as XLSX from 'xlsx';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { db } from '../lib/db';
import { syncOutbox, fetchLatestFromServer, syncHsnCodes } from '../lib/sync';
import { HSN_SEED_DATA } from '../lib/hsnData';
import { 
  FileText, Plus, Edit, Eye, History, Trash2, Calendar, User, 
  MapPin, Phone, Tag, DollarSign, ChevronRight, X, ArrowLeft, RefreshCw, Save, CheckCircle, Wifi, WifiOff, Bold, Italic, List, ListOrdered, FileSpreadsheet, Download, SlidersHorizontal, ArrowUpDown, ChevronDown, Check, Menu, Bell, HelpCircle, FileCheck2, AlertCircle
} from 'lucide-react';

const host = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '[::1]' ? '127.0.0.1' : window.location.hostname)
  : '127.0.0.1';
const API_BASE = `http://${host}:5000/api`;

const DEFAULT_TERMS_CONDITIONS = [
  'GST shall be charged extra as applicable unless specifically stated otherwise.',
  'Payment terms shall be as mentioned in the commercial summary of this quotation.',
  'Delivery schedule shall commence from receipt of technically and commercially clear purchase order and agreed advance payment.',
  'Freight and transit insurance shall be as specified in the commercial summary.',
  'Site shall be made ready with required shutdown, access, utilities and permissions before installation activity.',
  'Warranty shall apply against manufacturing defects for the period stated in the quotation and shall exclude misuse, external damage and consumables.',
  'Only the activities specifically listed in the approved scope of work are included.',
  'Civil work, major structural modification and statutory fees are excluded unless specifically included.',
  'Any quantity or scope variation after order shall be charged additionally with prior approval.',
  'AMC/CMC coverage is limited to the equipment and services explicitly listed in the scope.',
  'Consumables, accidental damage and third-party equipment are excluded unless specifically included.'
];

const parseTermsFromHtml = (htmlContent: string) => {
  if (!htmlContent) return [];
  const liMatches = htmlContent.match(/<li>(.*?)<\/li>/g);
  if (liMatches) {
    return liMatches.map(li => ({
      text: li.replace(/<\/?li>/g, '').trim(),
      selected: true
    }));
  }
  const cleaned = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean);
  return cleaned.map(text => ({ text, selected: true }));
};

const serializeTermsToHtml = (list: Array<{ text: string; selected: boolean }>) => {
  const selected = list.filter(item => item.selected);
  if (selected.length === 0) return '';
  return `<ol>${selected.map(item => `<li>${item.text}</li>`).join('')}</ol>`;
};

// Zod validation schemas
const ItemSchema = z.object({
  item_name: z.string().min(1, 'Item name is required').regex(/^[a-zA-Z0-9\s.,/\-()&':+]+$/, 'Invalid characters in item name'),
  description: z.string().optional().refine(val => !val || /^[a-zA-Z0-9\s.,/\-()&':+!\n]+$/.test(val), 'Invalid characters in description'),
  hsn_sac_code: z.string().optional().refine(val => !val || /^[0-9]+$/.test(val), 'HSN/SAC must be numeric'),
  quantity: z.number().min(1, 'Qty must be at least 1'),
  rate: z.number().min(0, 'Rate cannot be negative'),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
});

const ContentBlockSchema = z.object({
  block_type: z.string(),
  source: z.string(),
  title: z.string().min(1, 'Title is required').regex(/^[a-zA-Z0-9\s.,/\-()&':+]+$/, 'Invalid characters in title'),
  content: z.string().min(1, 'Content is required'),
  category_tag: z.string().optional(),
  sort_order: z.number().optional(),
});

const QuotationFormSchema = z.object({
  client_name: z.string().min(1, 'Client name is required').regex(/^[a-zA-Z0-9\s.,&'()-]+$/, 'Invalid characters in client name'),
  client_address: z.string().min(1, 'Client address is required').regex(/^[a-zA-Z0-9\s.,#/\-()&'\n]+$/, 'Invalid characters in address'),
  contact_person_name: z.string().min(1, 'Contact person name is required').regex(/^[a-zA-Z\s.-]+$/, 'Invalid characters in contact name'),
  contact_person_phone: z.string().min(1, 'Phone number is required').regex(/^[0-9+\s()-]{10,15}$/, 'Invalid phone number format'),
  validity_date: z.string()
    .min(1, 'Validity date is required')
    .refine((val) => {
      if (!val) return true;
      const selected = new Date(val);
      selected.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      return selected > today;
    }, { message: "Validity date must be after today" })
    .refine((val) => {
      if (!val) return true;
      const selected = new Date(val);
      selected.setHours(0,0,0,0);
      const limit = new Date();
      limit.setMonth(limit.getMonth() + 6);
      limit.setHours(23,59,59,999);
      return selected <= limit;
    }, { message: "Validity date must be within 6 months" }),
  subject: z.string().optional().refine(val => !val || /^[a-zA-Z0-9\s.,/\-()&':]+$/.test(val), 'Invalid characters in subject'),
  revision_label: z.string().optional(),
  items: z.array(ItemSchema).min(1, 'At least one item is required'),
  content_blocks: z.array(ContentBlockSchema),
});

type QuotationFormValues = z.infer<typeof QuotationFormSchema>;

// Tiptap Rich Text Editor Component
function TiptapEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors ${editor.isActive('bold') ? 'bg-slate-200 text-indigo-600' : ''}`}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors ${editor.isActive('italic') ? 'bg-slate-200 text-indigo-600' : ''}`}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 text-indigo-600' : ''}`}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors ${editor.isActive('orderedList') ? 'bg-slate-200 text-indigo-600' : ''}`}
          title="Ordered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 py-3 min-h-[100px] text-sm text-slate-700 focus:outline-none">
        <EditorContent editor={editor} className="outline-none focus:outline-none max-w-none prose prose-sm" />
      </div>
    </div>
  );
}

// Diff Comparison Component for revisions
function QuotationDiffView({ baseRev, targetRev }: { baseRev: any; targetRev: any }) {
  if (!baseRev || !targetRev) return null;

  // Diff items
  const baseItemsMap = new Map(baseRev.items.map((i: any) => [i.item_name, i]));
  const targetItemsMap = new Map(targetRev.items.map((i: any) => [i.item_name, i]));

  const allItemNames = Array.from(new Set([
    ...baseRev.items.map((i: any) => i.item_name),
    ...targetRev.items.map((i: any) => i.item_name)
  ]));

  const itemDiffs = allItemNames.map(name => {
    const baseItem: any = baseItemsMap.get(name);
    const targetItem: any = targetItemsMap.get(name);

    if (!baseItem) {
      return { name, status: 'added', qty: targetItem.quantity, rate: targetItem.rate, disc: targetItem.discount };
    }
    if (!targetItem) {
      return { name, status: 'removed', qty: baseItem.quantity, rate: baseItem.rate, disc: baseItem.discount };
    }

    const changed = 
      Number(baseItem.quantity) !== Number(targetItem.quantity) ||
      Number(baseItem.rate) !== Number(targetItem.rate) ||
      Number(baseItem.discount || 0) !== Number(targetItem.discount || 0);

    return {
      name,
      status: changed ? 'changed' : 'unchanged',
      oldQty: baseItem.quantity,
      newQty: targetItem.quantity,
      oldRate: baseItem.rate,
      newRate: targetItem.rate,
      oldDisc: baseItem.discount || 0,
      newDisc: targetItem.discount || 0,
    };
  });

  return (
    <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-slate-800">
      <div>
        <h3 className="font-semibold text-slate-900">Visual Revision Diff</h3>
        <p className="text-xs text-slate-500">Comparing Revision Index {baseRev.revision_index} (Left/Old) with Revision Index {targetRev.revision_index} (Right/New)</p>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items Changes</h4>
        <div className="space-y-2">
          {itemDiffs.map((diff, idx) => (
            <div key={idx} className={`p-4 rounded-xl border text-xs ${
              diff.status === 'added' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              diff.status === 'removed' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              diff.status === 'changed' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-900">{diff.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                  diff.status === 'added' ? 'bg-emerald-200 text-emerald-800' :
                  diff.status === 'removed' ? 'bg-rose-200 text-rose-800' :
                  diff.status === 'changed' ? 'bg-amber-200 text-amber-800' :
                  'bg-slate-200 text-slate-600'
                }`}>
                  {diff.status}
                </span>
              </div>

              {diff.status === 'added' && (
                <p>Added: {diff.qty} units x ₹{Number(diff.rate).toFixed(2)} (Disc: ₹{Number(diff.disc).toFixed(2)})</p>
              )}
              {diff.status === 'removed' && (
                <p className="line-through">Removed: {diff.qty} units x ₹{Number(diff.rate).toFixed(2)}</p>
              )}
              {diff.status === 'changed' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-slate-500">
                    <p className="text-[10px] uppercase">Old Values</p>
                    <p>Qty: {diff.oldQty}</p>
                    <p>Rate: ₹{Number(diff.oldRate).toFixed(2)}</p>
                    <p>Disc: ₹{Number(diff.oldDisc).toFixed(2)}</p>
                  </div>
                  <div className="text-amber-700 font-semibold">
                    <p className="text-[10px] uppercase text-slate-500">New Values</p>
                    <p>Qty: {diff.newQty}</p>
                    <p>Rate: ₹{Number(diff.newRate).toFixed(2)}</p>
                    <p>Disc: ₹{Number(diff.newDisc).toFixed(2)}</p>
                  </div>
                </div>
              )}
              {diff.status === 'unchanged' && (
                <p className="text-slate-500">No changes: {diff.oldQty} units x ₹{Number(diff.oldRate).toFixed(2)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SmartQuotationSystem() {
  const quotations = useLiveQuery(
    () => db.quotations.orderBy('created_at').reverse().toArray()
  ) || [];

  const hsnList = useLiveQuery(() => db.hsnCodes.toArray()) || [];

  const uniqueClients = useMemo(() => {
    const clientsMap = new Map<string, {
      client_name: string;
      client_address: string;
      contact_person_name: string;
      contact_person_phone: string;
    }>();

    for (const q of quotations) {
      if (!q.client_name) continue;
      const key = q.client_name.trim().toLowerCase();
      if (!clientsMap.has(key)) {
        const contactParts = (q.client_contact || '').split(' | ');
        const contactName = contactParts[0] || '';
        const contactPhone = contactParts[1] || '';
        clientsMap.set(key, {
          client_name: q.client_name,
          client_address: q.client_address || '',
          contact_person_name: contactName,
          contact_person_phone: contactPhone,
        });
      }
    }
    return Array.from(clientsMap.values());
  }, [quotations]);

  const [history, setHistory] = useState<any[]>([]);
  const [termsList, setTermsList] = useState<Array<{ text: string; selected: boolean }>>([]);

  const toggleTerm = (idx: number) => {
    const updated = [...termsList];
    updated[idx].selected = !updated[idx].selected;
    setTermsList(updated);
  };

  const updateTermText = (idx: number, val: string) => {
    const updated = [...termsList];
    updated[idx].text = val;
    setTermsList(updated);
  };

  const deleteTerm = (idx: number) => {
    setTermsList(termsList.filter((_, i) => i !== idx));
  };

  const addTerm = () => {
    setTermsList([...termsList, { text: '', selected: true }]);
  };
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'view' | 'history'>('dashboard');
  const [isOnline, setIsOnline] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('Quotations');
  
  // Diff target selection
  const [diffBaseIndex, setDiffBaseIndex] = useState<number>(0);

  const [compilingId, setCompilingId] = useState<string | null>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // tomorrow
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const limit = new Date();
    limit.setMonth(limit.getMonth() + 6);
    return limit.toISOString().split('T')[0];
  };

  // Filters State
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMinVal, setFilterMinVal] = useState('');
  const [filterMaxVal, setFilterMaxVal] = useState('');

  // User State
  const [userRole, setUserRole] = useState<'Admin' | 'Sales' | 'Auditor'>('Admin');
  const [userName, setUserName] = useState('Admin');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Settings State
  const [gstRate, setGstRate] = useState<number>(18);
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [defaultValidityDays, setDefaultValidityDays] = useState<number>(30);

  // Products and Templates live queries
  const productsList = useLiveQuery(() => db.products.toArray()) || [];
  const templatesList = useLiveQuery(() => db.templates.toArray()) || [];

  // Form States for new items
  const [newProdName, setNewProdName] = useState('');
  const [newProdRate, setNewProdRate] = useState('');
  const [newProdHsn, setNewProdHsn] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');

  const [newTempTitle, setNewTempTitle] = useState('');
  const [newTempContent, setNewTempContent] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('user-role') as any;
      const storedName = localStorage.getItem('user-name');
      if (storedRole) setUserRole(storedRole);
      if (storedName) setUserName(storedName);
      
      const storedGst = localStorage.getItem('setting-gst');
      if (storedGst) setGstRate(Number(storedGst));
      
      const storedCurrency = localStorage.getItem('setting-currency');
      if (storedCurrency) setCurrencySymbol(storedCurrency);

      const storedValidity = localStorage.getItem('setting-validity');
      if (storedValidity) setDefaultValidityDays(Number(storedValidity));
    }
  }, []);

  const handleRoleChange = (role: 'Admin' | 'Sales' | 'Auditor') => {
    setUserRole(role);
    setUserName(role);
    localStorage.setItem('user-role', role);
    localStorage.setItem('user-name', role);
  };

  // Fuse search & local filters
  const filteredQuotes = React.useMemo(() => {
    let result = [...quotations];

    // Status Filter
    if (filterStatus !== 'ALL') {
      result = result.filter(q => {
        if (filterStatus === 'pending') return q.sync_status === 'pending';
        return q.status === filterStatus;
      });
    }

    // Client Filter
    if (filterClient.trim() !== '') {
      const fuse = new Fuse(result, {
        keys: ['client_name', 'quotation_no'],
        threshold: 0.3
      });
      result = fuse.search(filterClient).map(r => r.item);
    }

    // Min Amount Filter
    if (filterMinVal.trim() !== '') {
      const min = Number(filterMinVal);
      result = result.filter(q => Number(q.total_amount) >= min);
    }

    // Max Amount Filter
    if (filterMaxVal.trim() !== '') {
      const max = Number(filterMaxVal);
      result = result.filter(q => Number(q.total_amount) <= max);
    }

    return result;
  }, [quotations, filterClient, filterStatus, filterMinVal, filterMaxVal]);

  // Statistics calculation
  const stats = React.useMemo(() => {
    const total = quotations.length;
    const accepted = quotations.filter(q => q.status === 'Accepted').length;
    const draftPending = quotations.filter(q => q.status === 'Draft' || q.sync_status === 'pending').length;
    const rejected = quotations.filter(q => q.status === 'Rejected').length; // assuming Rejected exists
    return { total, accepted, draftPending, rejected };
  }, [quotations]);

  // Columns definition helper
  const columnHelper = createColumnHelper<any>();
  const columns = [
    columnHelper.accessor('quotation_no', {
      header: 'Quote No',
      cell: info => (
        <span className="text-blue-600 bg-blue-50 font-semibold px-2.5 py-1 rounded-lg text-xs border border-blue-100">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('client_name', {
      header: 'Client Name & Contact',
      cell: info => {
        const contact = info.row.original.client_contact || '';
        const parts = contact.split(' | ');
        const name = parts[0] || '';
        const phone = parts[1] || '';
        return (
          <div>
            <div className="font-semibold text-slate-800">{info.getValue()}</div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center space-x-1.5 mt-0.5">
              <span>{name}</span>
              {phone && <span className="text-slate-350">|</span>}
              <span>{phone}</span>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('revision_index', {
      header: 'Latest Rev',
      cell: info => (
        <span className="text-blue-500 hover:underline font-medium text-xs">
          Rev {info.getValue()} ({info.row.original.revision_label})
        </span>
      ),
    }),
    columnHelper.accessor('total_amount', {
      header: 'Total Value (₹)',
      cell: info => {
        const amount = Number(info.getValue());
        return <span className="font-bold text-slate-800">₹{amount.toLocaleString('en-IN')}</span>;
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => {
        const statusVal = info.row.original.sync_status === 'pending' ? 'Sync Pending' : info.getValue();
        let classes = 'bg-slate-100 text-slate-600 border-slate-200';
        if (statusVal === 'Accepted') classes = 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (statusVal === 'Draft') classes = 'bg-amber-50 text-amber-600 border-amber-100';
        if (statusVal === 'Sent') classes = 'bg-blue-50 text-blue-600 border-blue-100';
        if (statusVal === 'Sync Pending') classes = 'bg-orange-50 text-orange-600 border-orange-100 animate-pulse';

        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${classes}`}>
            {statusVal}
          </span>
        );
      },
    }),
    columnHelper.accessor('created_at', {
      header: 'Created On',
      cell: info => {
        const d = new Date(info.getValue());
        return (
          <div className="text-slate-600 font-medium text-xs">
            <div>{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: info => (
        <div className="flex items-center space-x-2.5">
          <button onClick={() => handleViewClick(info.row.original)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="View Details">
            <Eye className="h-4 w-4" />
          </button>
          {info.row.original.sync_status === 'pending' ? (
            <button
              disabled
              className="text-slate-300 cursor-not-allowed opacity-50"
              title="Download PDF (Sync Pending)"
            >
              <Download className="h-4 w-4" />
            </button>
          ) : (
            <a
              href={`${API_BASE}/quotations/${info.row.original.quotation_no}/${info.row.original.revision_label}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-600 transition-colors"
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => handleEditRevisionClick(info.row.original)}
            disabled={info.row.original.sync_status === 'pending'}
            className="text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-40"
            title="Revise Quote"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleHistoryClick(info.row.original.quotation_no)}
            disabled={info.row.original.sync_status === 'pending'}
            className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
            title="Revision History"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: filteredQuotes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<any>({
    mode: 'onBlur',
    resolver: zodResolver(QuotationFormSchema),
    defaultValues: {
      client_name: '',
      client_address: '',
      contact_person_name: '',
      contact_person_phone: '',
      validity_date: '',
      subject: '',
      status: 'Accepted',
      revision_label: '',
      items: [{ item_name: '', description: '', hsn_sac_code: '', quantity: 1, rate: 0, discount: 0 }],
      content_blocks: [
        { block_type: 'scope_of_work', source: 'manual', title: 'Scope of Work', content: '<p>Include technical proposal or delivery scopes here.</p>', sort_order: 0 },
        { block_type: 'terms_conditions', source: 'manual', title: 'Terms & Conditions', content: '<p>Payment: 100% advance along with Purchase Order.<br>Delivery: Within 2-3 weeks.</p>', sort_order: 1 }
      ]
    }
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: 'items'
  });

  const { fields: blockFields, append: appendBlock, remove: removeBlock } = useFieldArray({
    control,
    name: 'content_blocks'
  });

  const watchedItems = watch('items');
  const watchedBlocks = watch('content_blocks');
  const subtotal = (watchedItems || []).reduce((acc: number, item: any) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const disc = Number(item.discount) || 0;
    return acc + (qty * rate - disc);
  }, 0);
  const totalRounded = Math.round(subtotal);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/quotations/audit-logs`, {
        headers: {
          'X-User-Role': localStorage.getItem('user-role') || 'Admin',
          'X-User-Name': localStorage.getItem('user-name') || 'Admin',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs from backend, using local state.');
    }
  };

  useEffect(() => {
    const seedHsnData = async () => {
      const count = await db.hsnCodes.count();
      if (count === 0) {
        await db.hsnCodes.bulkAdd(HSN_SEED_DATA);
      }
    };
    const seedProductsData = async () => {
      const count = await db.products.count();
      if (count === 0) {
        await db.products.bulkAdd([
          { id: '1', item_name: 'IT Consultancy Services', description: 'Expert technical infrastructure design', hsn_sac_code: '998311', rate: 5000 },
          { id: '2', item_name: 'Premium Business Laptop', description: 'Intel i7, 16GB RAM, 512GB SSD', hsn_sac_code: '847130', rate: 65000 },
          { id: '3', item_name: 'Enterprise Router Switch', description: '24-port managed gigabit switch', hsn_sac_code: '851762', rate: 22000 },
          { id: '4', item_name: 'UPS Power Backup 1KVA', description: 'Double conversion online UPS', hsn_sac_code: '850440', rate: 12000 },
        ]);
      }
    };
    const seedTemplatesData = async () => {
      const count = await db.templates.count();
      if (count === 0) {
        await db.templates.bulkAdd([
          { id: '1', title: 'Standard IT Services Contract', content: 'Payment terms: 50% advance, 50% post-delivery. Support: 9am-6pm business days.' },
          { id: '2', title: 'Hardware Sales Terms', content: 'Delivery: 1-2 weeks. Warranty: 1 year manufacturer warranty. Installation: Excluded.' },
        ]);
      }
    };
    
    seedHsnData();
    seedProductsData();
    seedTemplatesData();

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = async () => {
        setIsOnline(true);
        setLoading(true);
        await syncOutbox();
        await fetchLatestFromServer();
        await syncHsnCodes();
        await fetchAuditLogs();
        setLoading(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', () => setIsOnline(false));

      if ('serviceWorker' in navigator) {
        if (process.env.NODE_ENV === 'production') {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('SW Registered', reg.scope))
            .catch((err) => console.error('SW Failed', err));
        } else {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
              registration.unregister().then((success) => {
                if (success) {
                  console.log('Unregistered active service worker');
                }
              });
            }
          });
        }
      }

      handleOnline();
    }
  }, []);

  const handleManualSync = async () => {
    setLoading(true);
    await syncOutbox();
    await fetchLatestFromServer();
    await syncHsnCodes();
    await fetchAuditLogs();
    setLoading(false);
  };

  const handleItemDescriptionChange = (index: number, val: string) => {
    if (!val || hsnList.length === 0) return;
    const fuse = new Fuse(hsnList, { keys: ['itemNameMatch', 'description', 'code'], threshold: 0.4 });
    const results = fuse.search(val);
    if (results.length > 0) {
      setValue(`items.${index}.hsn_sac_code`, results[0].item.code);
    }
  };

  const handleViewClick = (quote: any) => {
    setSelectedQuote(quote);
    setShowPreviewModal(true);
  };

  const handleEditRevisionClick = (quote: any) => {
    setSelectedQuote(quote);
    setIsRevisionMode(true);
    const contactParts = (quote.client_contact || '').split(' | ');
    const contactName = contactParts[0] || '';
    const contactPhone = contactParts[1] || '';
    reset({
      client_name: quote.client_name,
      client_address: quote.client_address || '',
      contact_person_name: contactName,
      contact_person_phone: contactPhone,
      validity_date: quote.validity_date ? new Date(quote.validity_date).toISOString().split('T')[0] : '',
      subject: quote.subject || '',
      status: 'Accepted',
      revision_label: String(quote.revision_index + 1),
      items: quote.items.map((i: any) => ({
        item_name: i.item_name,
        description: i.description || '',
        hsn_sac_code: i.hsn_sac_code || '',
        quantity: Number(i.quantity),
        rate: Number(i.rate),
        discount: Number(i.discount || 0),
      })),
      content_blocks: [],
    });
    const termsBlock = quote.content_blocks.find((b: any) => b.block_type === 'terms_conditions');
    if (termsBlock) {
      setTermsList(parseTermsFromHtml(termsBlock.content));
    } else {
      setTermsList(DEFAULT_TERMS_CONDITIONS.map(text => ({ text, selected: true })));
    }
    setActiveTab('form');
  };

  const handleHistoryClick = async (quoteNo: string) => {
    setLoading(true);
    try {
      const offlineQuotes = await db.quotations.where('quotation_no').equals(quoteNo).toArray();
      const localQuote = offlineQuotes.find(q => q.sync_status === 'pending');
      
      const res = await fetch(`${API_BASE}/quotations/${quoteNo}`);
      if (res.ok) {
        const serverHistory = await res.json();
        const combined = [...serverHistory];
        if (localQuote) {
          combined.unshift(localQuote);
        }
        // Unique by id
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        unique.sort((a, b) => b.revision_index - a.revision_index);
        setHistory(unique);
        if (unique.length > 0) {
          setSelectedQuote(unique[0]);
          setDiffBaseIndex(unique.length > 1 ? 1 : 0);
        }
        setActiveTab('history');
      } else {
        alert('Could not fetch revisions from server.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching history.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedWithExcel = () => {
    if (!excelPreviewData) return;
    const validRows = excelPreviewData.filter(row => row.errors.length === 0);
    if (validRows.length === 0) {
      alert('No valid rows found.');
      return;
    }
    const mainRecord = validRows[0];
    const contactParts = (mainRecord.clientContact || '').split(' | ');
    const contactName = contactParts[0] || mainRecord.clientContact || '';
    const contactPhone = contactParts[1] || '';
    reset({
      client_name: mainRecord.clientName,
      client_address: mainRecord.clientAddress,
      contact_person_name: contactName,
      contact_person_phone: contactPhone,
      validity_date: mainRecord.validityDate ? new Date(mainRecord.validityDate).toISOString().split('T')[0] : '',
      subject: mainRecord.subject,
      status: 'Accepted',
      revision_label: '0',
      items: validRows.map(row => ({
        item_name: row.itemName,
        description: row.description,
        hsn_sac_code: row.hsnCode,
        quantity: row.quantity,
        rate: row.rate,
        discount: row.discount,
      })),
      content_blocks: []
    });
    setTermsList(DEFAULT_TERMS_CONDITIONS.map(text => ({ text, selected: true })));
    setExcelPreviewData(null);
    setActiveTab('form');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      let clientName = '';
      let clientAddress = '';
      let contactPerson = '';
      let contactPhone = '';
      let subject = '';
      const itemsList: any[] = [];

      let headerRowIdx = -1;
      let particularIdx = -1;
      let rateIdx = -1;
      let qtyIdx = -1;
      let hsnIdx = -1;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r] || [];
        for (let c = 0; c < row.length; c++) {
          const cellVal = String(row[c] || '').trim();
          
          if (cellVal.toLowerCase() === 'to,' || cellVal.toLowerCase() === 'to:') {
            clientName = String(row[c + 1] || '').trim();
            const nextRow = rows[r + 1] || [];
            clientAddress = String(nextRow[c + 1] || nextRow[c] || '').trim();
          }
          
          if (cellVal.toLowerCase().includes('kind attn') || cellVal.toLowerCase().startsWith('attn:')) {
            const contactVal = String(row[c + 1] || row[c] || '').trim().replace(/^(kind attn\.?:?|attn:?)/i, '').trim();
            const phoneMatch = contactVal.match(/(?:mobile|phone|mob|m\.?\s*no\.?)\s*:?\s*([0-9+\s\-()]{10,15})/i);
            if (phoneMatch) {
              contactPhone = phoneMatch[1].replace(/[^0-9+\s\-]/g, '').trim();
              contactPerson = contactVal.replace(phoneMatch[0], '').replace(/[()]/g, '').trim();
            } else {
              contactPerson = contactVal;
            }
          }

          if (cellVal.toLowerCase().includes('ref.') || cellVal.toLowerCase().includes('subject')) {
            subject = String(row[c + 1] || row[c + 2] || '').trim();
          }
        }

        const rowStr = row.map(cell => String(cell || '').toLowerCase().trim());
        const hasParticular = rowStr.some(cell => cell.includes('particular') || cell.includes('description') || cell.includes('item'));
        const hasRate = rowStr.some(cell => cell.includes('rate') || cell.includes('price') || cell.includes('unit price'));
        const hasQty = rowStr.some(cell => cell.includes('qty') || cell.includes('quantity') || cell.includes('nos'));

        if (hasParticular && hasRate && hasQty && headerRowIdx === -1) {
          headerRowIdx = r;
          particularIdx = rowStr.findIndex(cell => cell.includes('particular') || cell.includes('description') || cell.includes('item'));
          rateIdx = rowStr.findIndex(cell => cell.includes('rate') || cell.includes('price') || cell.includes('unit price'));
          qtyIdx = rowStr.findIndex(cell => cell.includes('qty') || cell.includes('quantity') || cell.includes('nos'));
          hsnIdx = rowStr.findIndex(cell => cell.includes('hsn') || cell.includes('sac'));
        }
      }

      if (headerRowIdx !== -1) {
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const itemDesc = String(row[particularIdx] || '').trim();
          const lowerDesc = itemDesc.toLowerCase();
          
          if (!itemDesc || 
              lowerDesc.includes('total') || 
              lowerDesc.includes('gst') || 
              lowerDesc.includes('tax') || 
              lowerDesc.includes('terms') || 
              lowerDesc.includes('rupees') ||
              lowerDesc.startsWith('see-tech') ||
              lowerDesc.includes('amount in words')) {
            if (itemsList.length > 0 && (lowerDesc.includes('total') || lowerDesc.includes('gst') || lowerDesc.includes('tax'))) {
              break;
            }
            continue;
          }

          const qty = parseFloat(String(row[qtyIdx] || '').replace(/[^0-9.]/g, ''));
          const rate = parseFloat(String(row[rateIdx] || '').replace(/[^0-9.]/g, ''));

          if (!isNaN(qty) && !isNaN(rate)) {
            itemsList.push({
              itemName: itemDesc,
              quantity: qty,
              rate: rate,
              hsnCode: hsnIdx !== -1 ? String(row[hsnIdx] || '').trim() : '',
              discount: 0,
              description: ''
            });
          }
        }
      }

      // If semantic parsing failed to yield items, fallback to raw sheet_to_json
      if (itemsList.length === 0) {
        const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];
        const fallbackRows = rawJson.map((row, idx) => {
          const errorsList: string[] = [];
          const nameVal = row['Client Name'] || row['Client'] || clientName || 'Imported Client';
          const itemVal = row['Item Name'] || row['Item'] || row['Particular'] || 'Imported Item';
          const qVal = Number(row['Quantity'] || row['Qty'] || 1);
          const rVal = Number(row['Rate'] || row['Price'] || 0);

          return {
            id: idx,
            clientName: nameVal,
            clientAddress: row['Client Address'] || clientAddress || '',
            clientContact: row['Client Contact'] || (contactPerson ? `${contactPerson} | ${contactPhone}` : ''),
            subject: row['Subject'] || subject || '',
            validityDate: row['Validity Date'] || '',
            itemName: itemVal,
            description: row['Description'] || '',
            hsnCode: row['HSN Code'] || row['HSN/SAC'] || '',
            quantity: qVal,
            rate: rVal,
            discount: Number(row['Discount'] || 0),
            errors: errorsList,
          };
        });
        setExcelPreviewData(fallbackRows);
      } else {
        const mappedRows = itemsList.map((item, idx) => ({
          id: idx,
          clientName: clientName || 'Imported Client',
          clientAddress: clientAddress || '',
          clientContact: contactPerson ? `${contactPerson} | ${contactPhone}` : '',
          subject: subject || '',
          validityDate: '',
          itemName: item.itemName,
          description: item.description,
          hsnCode: item.hsnCode,
          quantity: item.quantity,
          rate: item.rate,
          discount: item.discount,
          errors: []
        }));
        setExcelPreviewData(mappedRows);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleProceedToRevisionSave = async (values: QuotationFormValues) => {
    const tempId = crypto.randomUUID();

    let taxable_amount = 0;
    const itemsPayload = values.items.map(item => {
      const lineTax = Number(item.quantity) * Number(item.rate) - Number(item.discount || 0);
      taxable_amount += lineTax;
      return {
        ...item,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        discount: Number(item.discount || 0),
        taxable_amount: lineTax,
      };
    });

    const clientContactValue = `${values.contact_person_name} | ${values.contact_person_phone}`;
    const statusValue = 'Accepted';
    const total_amount = Math.round(taxable_amount * 1.18);

    const serializedTerms = serializeTermsToHtml(termsList);
    const finalContentBlocks = [];
    if (serializedTerms) {
      finalContentBlocks.push({
        block_type: 'terms_conditions',
        source: 'manual',
        title: 'Terms & Conditions',
        content: serializedTerms,
        sort_order: 1
      });
    }

    const payload = {
      client_name: values.client_name,
      client_address: values.client_address,
      client_contact: clientContactValue,
      validity_date: values.validity_date || null,
      subject: values.subject,
      status: statusValue,
      revision_label: values.revision_label || '0',
      items: itemsPayload,
      content_blocks: finalContentBlocks,
    };

    const tempQuoteNo = isRevisionMode && selectedQuote ? selectedQuote.quotation_no : `QT-TEMP-${tempId.substring(0, 8)}`;
    const nextRevIndex = isRevisionMode && selectedQuote ? selectedQuote.revision_index + 1 : 0;

    const localRecord = {
      id: tempId,
      quotation_no: tempQuoteNo,
      revision_index: nextRevIndex,
      revision_label: values.revision_label || String(nextRevIndex),
      client_name: values.client_name,
      client_address: values.client_address,
      client_contact: clientContactValue,
      validity_date: values.validity_date || undefined,
      subject: values.subject,
      taxable_amount,
      total_amount,
      status: statusValue,
      created_at: new Date().toISOString(),
      items: itemsPayload,
      content_blocks: finalContentBlocks,
      sync_status: 'pending' as const,
    };

    await db.quotations.add(localRecord);

    await db.outbox.add({
      action: isRevisionMode ? 'create_revision' : 'create',
      quotation_id: tempId,
      quotation_no: isRevisionMode && selectedQuote ? selectedQuote.quotation_no : undefined,
      payload,
      timestamp: Date.now(),
    });

    setActiveTab('dashboard');

    if (isOnline) {
      await syncOutbox();
      await fetchLatestFromServer();
    }
  };

  const startNewQuote = () => {
    setIsRevisionMode(false);
    reset({
      client_name: '',
      client_address: '',
      contact_person_name: '',
      contact_person_phone: '',
      validity_date: '',
      subject: '',
      status: 'Accepted',
      revision_label: '',
      items: [{ item_name: '', description: '', hsn_sac_code: '', quantity: 1, rate: 0, discount: 0 }],
      content_blocks: []
    });
    setTermsList(DEFAULT_TERMS_CONDITIONS.map(text => ({ text, selected: true })));
    setActiveTab('form');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Panel */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Smart Quotation</h2>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">TanStack Table Dashboard</p>
            </div>
          )}
        </div>

        {/* Sidebar Nav Actions */}
        <div className="p-4 border-b border-slate-50">
          <button 
            onClick={startNewQuote}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 py-3 transition-colors shadow-lg shadow-blue-600/10 ${sidebarCollapsed ? 'px-0' : 'px-4'}`}
            title="Create New Quote"
          >
            <Plus className="h-4 w-4" />
            {!sidebarCollapsed && <span className="text-sm">New Quote</span>}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {[
            { name: 'Dashboard', icon: FileText },
            { name: 'Quotations', icon: FileCheck2 },
            { name: 'Clients', icon: User },
            { name: 'Products / Items', icon: Tag },
            { name: 'Reports', icon: RefreshCw },
            { name: 'Templates', icon: Calendar },
            { name: 'Settings', icon: SlidersHorizontal }
          ].map((item) => {
            const IconComponent = item.icon;
            const isActive = activeSidebarItem === item.name;
            return (
              <button
                key={item.name}
                onClick={() => { setActiveSidebarItem(item.name); setActiveTab('dashboard'); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                title={item.name}
              >
                <IconComponent className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Callout */}
        {!sidebarCollapsed && (
          <div className="p-4 m-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex flex-col space-y-2.5">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                <HelpCircle className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Need Help?</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">Check our documentation or contact support for assistance.</p>
            <button className="w-full bg-white hover:bg-slate-50 text-[10px] font-bold py-2 rounded-xl border border-slate-200 text-slate-700 shadow-sm transition-colors">
              View Docs
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200 shadow-sm"
              title="Toggle Sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {activeTab === 'dashboard' && (
              <div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  onChange={handleExcelUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-200 shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span>Bulk Excel</span>
                </button>
              </div>
            )}

            {/* Offline/Online Badge */}
            <div 
              onClick={handleManualSync}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                isOnline 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                  : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
              }`}
              title="Click to force sync cache"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Notification Bell */}
            <button className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full border border-slate-200 shadow-sm relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-blue-500 border-2 border-white rounded-full" />
            </button>

            {/* User Dropdown Profile Selector */}
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="bg-slate-200 rounded-full h-5 w-5 overflow-hidden">
                <div className="h-full w-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold">A</div>
              </div>
              <select
                value={userRole}
                onChange={(e) => handleRoleChange(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
              >
                <option value="Admin">Admin</option>
                <option value="Sales">Sales</option>
                <option value="Auditor">Auditor</option>
              </select>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-8">

          {/* Excel Import Preview */}
          {excelPreviewData && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                    <span>Excel Import Validation Preview</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Review rows parsed from sheet template before loading to database.</p>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setExcelPreviewData(null)} className="bg-white hover:bg-slate-50 text-slate-700 text-xs px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm">
                    Cancel
                  </button>
                  <button onClick={handleProceedWithExcel} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-semibold shadow-sm">
                    Proceed to Form
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                      <th className="p-3">Status</th>
                      <th className="p-3">Client Name</th>
                      <th className="p-3">Item Details</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Rate</th>
                      <th className="p-3 text-right">Discount</th>
                      <th className="p-3">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelPreviewData.map((row) => (
                      <tr key={row.id} className={row.errors.length > 0 ? 'bg-rose-50/50' : 'hover:bg-slate-50/50'}>
                        <td className="p-3">{row.errors.length > 0 ? <span className="text-rose-600 font-semibold">Flagged</span> : <span className="text-emerald-600 font-semibold">OK</span>}</td>
                        <td className="p-3 font-semibold text-slate-800">{row.clientName || '-'}</td>
                        <td className="p-3">
                          <span className="font-bold text-slate-700">{row.itemName}</span>
                          {row.description && <p className="text-[10px] text-slate-400 mt-0.5">{row.description}</p>}
                        </td>
                        <td className="p-3 text-right text-slate-600">{row.quantity}</td>
                        <td className="p-3 text-right text-slate-600">₹{row.rate}</td>
                        <td className="p-3 text-right text-slate-600">₹{row.discount}</td>
                        <td className="p-3 text-rose-500 font-semibold">{row.errors.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 1. CONDITIONAL DASHBOARD & SIDEBAR VIEWS */}
          {!loading && activeTab === 'dashboard' && (
            <div className="space-y-8">
              
              {/* TOP HEADER */}
              <div className="flex flex-col md:flex-row justify-between md:items-center space-y-4 md:space-y-0">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 leading-tight">{activeSidebarItem}</h2>
                  <div className="text-xs text-slate-400 font-semibold tracking-wide flex items-center space-x-1.5 mt-1.5">
                    <span className="text-slate-500">Workspace</span>
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                    <span className="text-blue-600 font-semibold">{activeSidebarItem}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>Current Period: FY 2026-27</span>
                </div>
              </div>

              {/* A. DASHBOARD ANALYTICS OVERVIEW */}
              {activeSidebarItem === 'Dashboard' && (
                <div className="space-y-8">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { title: 'Pipeline Value', val: `${currencySymbol}${(quotations.reduce((acc, q) => acc + Number(q.total_amount), 0)).toLocaleString('en-IN')}`, desc: 'Total quotation pipeline', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                      { title: 'Conversion Rate', val: `${quotations.length ? Math.round((quotations.filter(q => q.status === 'Accepted').length / quotations.length) * 100) : 0}%`, desc: 'Accepted vs Total quotes', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                      { title: 'Active Drafts', val: quotations.filter(q => q.status === 'Draft' || q.sync_status === 'pending').length, desc: 'Awaiting submission/sync', color: 'text-amber-600 bg-amber-50 border-amber-100' },
                      { title: 'Total Revisions', val: quotations.reduce((acc, q) => acc + q.revision_index, 0), desc: 'Iterative review cycles', color: 'text-blue-600 bg-blue-50 border-blue-100' }
                    ].map((c, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.title}</span>
                          <div className="text-2xl font-extrabold text-slate-900">{c.val}</div>
                          <span className="text-[10px] text-slate-450 block font-medium">{c.desc}</span>
                        </div>
                        <div className={`p-3 rounded-xl border flex-shrink-0 ${c.color}`}>
                          <FileText className="h-5 w-5" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Charts & Quick Actions Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Visual CSS-based Sales Chart */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">Value Distribution by Status</h3>
                        <span className="text-xs text-slate-400">Live DB Metrics</span>
                      </div>
                      
                      <div className="space-y-4">
                        {[
                          { status: 'Accepted', color: 'bg-emerald-500', count: quotations.filter(q => q.status === 'Accepted').length },
                          { status: 'Sent', color: 'bg-blue-500', count: quotations.filter(q => q.status === 'Sent').length },
                          { status: 'Draft', color: 'bg-amber-500', count: quotations.filter(q => q.status === 'Draft').length },
                          { status: 'Expired', color: 'bg-rose-500', count: quotations.filter(q => q.status === 'Expired' || q.status === 'Rejected').length },
                        ].map((item, idx) => {
                          const percentage = quotations.length ? Math.round((item.count / quotations.length) * 100) : 0;
                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-slate-600 flex items-center space-x-2">
                                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                                  <span>{item.status} ({item.count})</span>
                                </span>
                                <span className="text-slate-900">{percentage}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Shortcuts */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 mb-2">Quick Actions</h3>
                        <p className="text-xs text-slate-400 mb-6">Common operations for generating and managing commercial offers.</p>
                        
                        <div className="space-y-3">
                          <button onClick={startNewQuote} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2">
                            <Plus className="h-4 w-4" />
                            <span>Create Custom Quotation</span>
                          </button>
                          
                          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                            <span>Import spreadsheet template</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-400">
                        <span>Local DB Sync Mode</span>
                        <span className="text-emerald-500 font-bold flex items-center space-x-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>IndexedDB active</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Audit Logs / Activity logs */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-slate-900">Recent Server Audit Trail</h3>
                      <button onClick={fetchAuditLogs} className="text-xs text-blue-600 font-semibold hover:underline flex items-center space-x-1">
                        <RefreshCw className="h-3 w-3" />
                        <span>Refresh Logs</span>
                      </button>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {auditLogs.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">No server activities logged, or server currently unreachable.</p>
                      ) : (
                        auditLogs.slice(0, 10).map((log, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action.includes('CREATE') ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                log.action.includes('REVISE') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {log.action}
                              </span>
                              <span className="font-semibold text-slate-800">Quote {log.quotation_no || 'N/A'}</span>
                            </div>
                            <div className="flex items-center space-x-4 text-slate-400">
                              <span>By: {log.username} ({log.role})</span>
                              <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* B. QUOTATIONS VIEW (ORIGINAL DATA TABLE) */}
              {activeSidebarItem === 'Quotations' && (
                <div className="space-y-6">
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { title: 'Total Quotations', val: stats.total, pct: '+ 12.5%', isPos: true, icon: FileText, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                      { title: 'Accepted', val: stats.accepted, pct: '+ 8.2%', isPos: true, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                      { title: 'Pending / Draft', val: stats.draftPending, pct: '- 4.6%', isPos: false, icon: Calendar, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                      { title: 'Rejected', val: stats.rejected || 0, pct: '0%', isPos: true, icon: AlertCircle, color: 'text-rose-600 bg-rose-50 border-rose-100' }
                    ].map((c, i) => {
                      const Icon = c.icon;
                      return (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.title}</span>
                            <div className="flex items-baseline space-x-2">
                              <span className="text-2xl font-extrabold text-slate-900">{c.val}</span>
                              <span className={`text-xs font-bold ${c.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {c.pct}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-450 block font-medium">vs last month</span>
                          </div>
                          <div className={`p-3 rounded-xl border flex-shrink-0 ${c.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Filters Toolbar */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                      <input 
                        type="text"
                        value={filterClient}
                        onChange={e => setFilterClient(e.target.value)}
                        placeholder="Search by Quote No or Client..."
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white w-full sm:w-60 shadow-inner"
                      />
                      
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                        <select
                          value={filterStatus}
                          onChange={e => setFilterStatus(e.target.value)}
                          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="Draft">Draft</option>
                          <option value="Sent">Sent</option>
                          <option value="Accepted">Accepted</option>
                          <option value="pending">Sync Pending</option>
                        </select>
                      </div>

                      <input
                        type="number"
                        value={filterMinVal}
                        onChange={e => setFilterMinVal(e.target.value)}
                        placeholder="Min Value"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white w-28 shadow-inner"
                      />

                      <input
                        type="number"
                        value={filterMaxVal}
                        onChange={e => setFilterMaxVal(e.target.value)}
                        placeholder="Max Value"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white w-28 shadow-inner"
                      />
                    </div>

                    <div className="flex items-center space-x-3 w-full lg:w-auto justify-end">
                      <button 
                        onClick={() => { setFilterClient(''); setFilterStatus('ALL'); setFilterMinVal(''); setFilterMaxVal(''); }}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-colors"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                        <span>Reset Filters</span>
                      </button>
                    </div>
                  </div>

                  {/* Data Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id} className="bg-slate-50/80 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                              {headerGroup.headers.map(header => (
                                <th key={header.id} className="px-6 py-4">
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {table.getRowModel().rows.length === 0 ? (
                            <tr>
                              <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                                No matching quotations found.
                              </td>
                            </tr>
                          ) : (
                            table.getRowModel().rows.map(row => (
                              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                {row.getVisibleCells().map(cell => (
                                  <td key={cell.id} className="px-6 py-4">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        Showing 1 to {filteredQuotes.length} of {filteredQuotes.length} results
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <button className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 disabled:opacity-50" disabled>
                          Prev
                        </button>
                        <button className="px-3.5 py-2 bg-blue-600 border border-blue-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/10">
                          1
                        </button>
                        <button className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 disabled:opacity-50" disabled>
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* C. CLIENTS DIRECTORY VIEW */}
              {activeSidebarItem === 'Clients' && (
                <div className="space-y-6">
                  {/* Dynamic stats */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Clients Ledger</h3>
                      <p className="text-xs text-slate-400 mt-1">Unique client entities compiled from saved proposals.</p>
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-600 font-bold px-3 py-1.5 rounded-xl border border-blue-100">
                      Total: {uniqueClients.length} Active Clients
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {uniqueClients.map((client, idx) => {
                      const clientQuotes = quotations.filter(q => q.client_name === client.client_name);
                      const totalValue = clientQuotes.reduce((acc, q) => acc + Number(q.total_amount), 0);
                      
                      return (
                        <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-350 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm border border-indigo-100">
                                {client.client_name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm leading-snug">{client.client_name}</h4>
                                <span className="text-[10px] text-slate-400 font-medium">Verified Client</span>
                              </div>
                            </div>

                            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                              <p className="flex items-center space-x-2">
                                <MapPin className="h-3.5 w-3.5 text-slate-450" />
                                <span className="truncate">{client.client_address || 'No address specified'}</span>
                              </p>
                              <p className="flex items-center space-x-2">
                                <User className="h-3.5 w-3.5 text-slate-450" />
                                <span>{client.contact_person_name || 'N/A'}</span>
                              </p>
                              <p className="flex items-center space-x-2">
                                <Phone className="h-3.5 w-3.5 text-slate-450" />
                                <span>{client.contact_person_phone || 'N/A'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Quotes</span>
                              <span className="font-bold text-slate-800">{clientQuotes.length} Offers</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Billing pipeline</span>
                              <span className="font-extrabold text-blue-600">{currencySymbol}{totalValue.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {uniqueClients.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400">
                        No clients database available yet. Create a quote to populate the list.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* D. PRODUCTS / ITEMS DIRECTORY VIEW */}
              {activeSidebarItem === 'Products / Items' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Products List */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-900">Products Catalog</h3>
                      <p className="text-xs text-slate-400 mt-1">Predefined line items and pricing matrix for standard quotes.</p>
                    </div>

                    <div className="overflow-x-auto border border-slate-150 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-150">
                            <th className="p-3">Item Details</th>
                            <th className="p-3">HSN Code</th>
                            <th className="p-3 text-right">Standard Rate</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {productsList.map((prod) => (
                            <tr key={prod.id} className="hover:bg-slate-50/50">
                              <td className="p-3">
                                <p className="font-semibold text-slate-850">{prod.item_name}</p>
                                {prod.description && <p className="text-[10px] text-slate-400 mt-0.5">{prod.description}</p>}
                              </td>
                              <td className="p-3 font-mono text-slate-500">{prod.hsn_sac_code || 'N/A'}</td>
                              <td className="p-3 text-right font-bold text-slate-700">{currencySymbol}{Number(prod.rate).toFixed(2)}</td>
                              <td className="p-3 text-center">
                                <button 
                                  onClick={async () => await db.products.delete(prod.id)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {productsList.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400">No items in database. Add standard items using form on the right.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Product Form */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
                    <div>
                      <h3 className="font-bold text-slate-900">Add Predefined Item</h3>
                      <p className="text-xs text-slate-400 mt-1">Saves standard rates to speed up manual quoting.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Product/Service Name *</label>
                        <input
                          type="text"
                          value={newProdName}
                          onChange={e => setNewProdName(e.target.value)}
                          placeholder="e.g. IT support tier 2"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Standard Rate ({currencySymbol}) *</label>
                        <input
                          type="number"
                          value={newProdRate}
                          onChange={e => setNewProdRate(e.target.value)}
                          placeholder="e.g. 1500"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">HSN / SAC Code</label>
                        <input
                          type="text"
                          value={newProdHsn}
                          onChange={e => setNewProdHsn(e.target.value)}
                          placeholder="e.g. 998313"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Description</label>
                        <textarea
                          rows={2}
                          value={newProdDesc}
                          onChange={e => setNewProdDesc(e.target.value)}
                          placeholder="Provide details about standard services or specs..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!newProdName || !newProdRate) {
                            alert('Please fill out product name and rate.');
                            return;
                          }
                          await db.products.add({
                            id: crypto.randomUUID(),
                            item_name: newProdName,
                            rate: Number(newProdRate),
                            hsn_sac_code: newProdHsn || undefined,
                            description: newProdDesc || undefined
                          });
                          setNewProdName('');
                          setNewProdRate('');
                          setNewProdHsn('');
                          setNewProdDesc('');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                      >
                        Add Product
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* E. REPORTS VIEW */}
              {activeSidebarItem === 'Reports' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Pipeline Value</span>
                      <h2 className="text-3xl font-black text-slate-900 mt-2">{currencySymbol}{(quotations.reduce((acc, q) => acc + Number(q.total_amount), 0)).toLocaleString('en-IN')}</h2>
                      <p className="text-[10px] text-slate-400 mt-1">Entire historical billing index</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Closed / Won Deals</span>
                      <h2 className="text-3xl font-black text-emerald-600 mt-2">{currencySymbol}{(quotations.filter(q => q.status === 'Accepted').reduce((acc, q) => acc + Number(q.total_amount), 0)).toLocaleString('en-IN')}</h2>
                      <p className="text-[10px] text-slate-400 mt-1">Accepted sales revenue</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Awaiting Client Response</span>
                      <h2 className="text-3xl font-black text-blue-600 mt-2">{currencySymbol}{(quotations.filter(q => q.status === 'Sent').reduce((acc, q) => acc + Number(q.total_amount), 0)).toLocaleString('en-IN')}</h2>
                      <p className="text-[10px] text-slate-400 mt-1">Pending approval offers</p>
                    </div>
                  </div>

                  {/* Month-wise Value bars */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">Quotation value projection</h3>
                      <span className="text-xs text-slate-400">Current calendar year</span>
                    </div>

                    <div className="flex items-end justify-between h-48 pt-6 border-b border-slate-100">
                      {[
                        { month: 'Jan', val: 120000 },
                        { month: 'Feb', val: 240000 },
                        { month: 'Mar', val: 310000 },
                        { month: 'Apr', val: 180000 },
                        { month: 'May', val: 290000 },
                        { month: 'Jun', val: 420000 },
                      ].map((item, i) => {
                        const heightPct = Math.round((item.val / 450000) * 100);
                        return (
                          <div key={i} className="flex flex-col items-center space-y-2 w-12 group cursor-pointer">
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-slate-800 text-white rounded px-1.5 py-0.5 transition-all">
                              {currencySymbol}{item.val.toLocaleString('en-IN')}
                            </span>
                            <div className="w-8 bg-blue-500 hover:bg-blue-600 rounded-t-lg transition-all duration-300" style={{ height: `${heightPct * 1.2}px` }} />
                            <span className="text-xs text-slate-450 font-bold">{item.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* F. TEMPLATES VIEW */}
              {activeSidebarItem === 'Templates' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Saved Templates */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-900">Commercial Terms Libraries</h3>
                      <p className="text-xs text-slate-400 mt-1">Predefined legal terms and SLA profiles saved in local workspace database.</p>
                    </div>

                    <div className="space-y-4">
                      {templatesList.map((tpl) => (
                        <div key={tpl.id} className="p-4 bg-slate-50 border border-slate-250 rounded-xl space-y-2 relative shadow-sm">
                          <h4 className="font-bold text-slate-800 text-xs">{tpl.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-normal">{tpl.content}</p>
                          
                          <button
                            onClick={async () => await db.templates.delete(tpl.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Delete Template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {templatesList.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-xs">No contract templates defined yet. Add standard layouts below.</div>
                      )}
                    </div>
                  </div>

                  {/* Add Template Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
                    <div>
                      <h3 className="font-bold text-slate-900">Define Legal Template</h3>
                      <p className="text-xs text-slate-400 mt-1">Specify payment constraints or warranty timelines.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Template Title *</label>
                        <input
                          type="text"
                          value={newTempTitle}
                          onChange={e => setNewTempTitle(e.target.value)}
                          placeholder="e.g. 50-50 Payment SLA"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Terms Content *</label>
                        <textarea
                          rows={4}
                          value={newTempContent}
                          onChange={e => setNewTempContent(e.target.value)}
                          placeholder="e.g. 50% advance invoice, balance post delivery..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!newTempTitle || !newTempContent) {
                            alert('Please fill out template title and content.');
                            return;
                          }
                          await db.templates.add({
                            id: crypto.randomUUID(),
                            title: newTempTitle,
                            content: newTempContent
                          });
                          setNewTempTitle('');
                          setNewTempContent('');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                      >
                        Save Contract Template
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* G. SETTINGS VIEW */}
              {activeSidebarItem === 'Settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Preferences Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-900">Quotation Preferences</h3>
                      <p className="text-xs text-slate-400 mt-1">Configure default constraints, currencies and taxation ratios.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Tax (GST) Rate (%)</label>
                          <input
                            type="number"
                            value={gstRate}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setGstRate(val);
                              localStorage.setItem('setting-gst', String(val));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Currency Symbol</label>
                          <input
                            type="text"
                            value={currencySymbol}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrencySymbol(val);
                              localStorage.setItem('setting-currency', val);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Default Validity Days</label>
                        <input
                          type="number"
                          value={defaultValidityDays}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setDefaultValidityDays(val);
                            localStorage.setItem('setting-validity', String(val));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-blue-400 focus:bg-white outline-none text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Database syncing Tools */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
                    <div>
                      <h3 className="font-bold text-slate-900">Database Tools</h3>
                      <p className="text-xs text-slate-400 mt-1">Actions to purge, repair, or manually sync local caches.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <span className="font-bold text-xs text-slate-800 block">Outbox Queue Status</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Unsynced offline quotations payload.</span>
                        </div>
                        <button
                          onClick={handleManualSync}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm"
                        >
                          Manual Sync
                        </button>
                      </div>

                      <div className="flex justify-between items-center p-4 bg-red-50/50 border border-red-200 rounded-xl">
                        <div>
                          <span className="font-bold text-xs text-red-800 block">Purge Local Cache</span>
                          <span className="text-[10px] text-red-400 mt-0.5">Clear all IndexedDB quotes (does not affect server).</span>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to clear your local cache? This will delete all offline data.')) {
                              await db.quotations.clear();
                              await db.outbox.clear();
                              alert('Local cache successfully cleared.');
                              window.location.reload();
                            }
                          }}
                          className="bg-red-650 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm"
                        >
                          Purge DB
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 2. CREATOR / EDITOR FORM */}
          {activeTab === 'form' && (
            <form onSubmit={handleSubmit(handleProceedToRevisionSave)} className="space-y-8 max-w-4xl mx-auto pb-12">
              
              {/* Creator Header with back arrow */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                <div className="flex items-center space-x-4.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 shadow-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                      {isRevisionMode ? `Revise Quotation: ${selectedQuote?.quotation_no}` : 'New Quotation'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {isRevisionMode ? `Creating revision ${selectedQuote?.revision_index + 1}` : 'Create a new quotation'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1: Client & Quote Details */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center space-x-3.5 border-b border-slate-100 pb-4">
                  <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-100">
                    1
                  </div>
                  <h3 className="font-bold text-slate-900">Client & Quote Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client Name *</label>
                    <input
                      type="text"
                      list="past-client-names"
                      {...register('client_name', {
                        onChange: (e) => {
                          const val = e.target.value;
                          const found = uniqueClients.find(c => c.client_name.toLowerCase() === val.toLowerCase());
                          if (found) {
                            setValue('client_address', found.client_address);
                            setValue('contact_person_name', found.contact_person_name);
                            setValue('contact_person_phone', found.contact_person_phone);
                          }
                        }
                      })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white outline-none text-slate-800 shadow-inner"
                      placeholder="Enter client name"
                    />
                    <datalist id="past-client-names">
                      {uniqueClients.map((c, i) => (
                        <option key={i} value={c.client_name} />
                      ))}
                    </datalist>
                    {errors.client_name && <p className="text-xs text-rose-500 mt-1">{errors.client_name.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Person Name *</label>
                    <input
                      type="text"
                      list="past-contact-names"
                      {...register('contact_person_name')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white outline-none text-slate-800 shadow-inner"
                      placeholder="Enter contact person name"
                    />
                    <datalist id="past-contact-names">
                      {Array.from(new Set(uniqueClients.map(c => c.contact_person_name).filter(Boolean))).map((name, i) => (
                        <option key={i} value={name} />
                      ))}
                    </datalist>
                    {errors.contact_person_name && <p className="text-xs text-rose-500 mt-1">{errors.contact_person_name.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Person Phone Number *</label>
                    <input
                      type="text"
                      list="past-contact-phones"
                      {...register('contact_person_phone')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white outline-none text-slate-800 shadow-inner"
                      placeholder="Enter contact phone number"
                    />
                    <datalist id="past-contact-phones">
                      {Array.from(new Set(uniqueClients.map(c => c.contact_person_phone).filter(Boolean))).map((phone, i) => (
                        <option key={i} value={phone} />
                      ))}
                    </datalist>
                    {errors.contact_person_phone && <p className="text-xs text-rose-500 mt-1">{errors.contact_person_phone.message as string}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client Address *</label>
                    <textarea
                      rows={2}
                      {...register('client_address')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white outline-none text-slate-800 shadow-inner"
                      placeholder="Enter client address"
                    />
                    {errors.client_address && <p className="text-xs text-rose-500 mt-1">{errors.client_address.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject / Reference</label>
                    <input
                      type="text"
                      list="past-subjects"
                      {...register('subject')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:bg-white outline-none text-slate-800 shadow-inner"
                      placeholder="e.g. Server Infrastructure Upgrade Proposal"
                    />
                    <datalist id="past-subjects">
                      {Array.from(new Set(quotations.map(q => q.subject).filter(Boolean))).map((sub, i) => (
                        <option key={i} value={sub} />
                      ))}
                    </datalist>
                    {errors.subject && <p className="text-xs text-rose-500 mt-1">{errors.subject.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Validity Date *</label>
                    <input
                      type="date"
                      min={getMinDate()}
                      max={getMaxDate()}
                      {...register('validity_date')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white outline-none text-slate-800 shadow-inner"
                    />
                    {errors.validity_date && <p className="text-xs text-rose-500 mt-1">{errors.validity_date.message as string}</p>}
                  </div>
                </div>
              </div>

              {/* Step 2: Line Items */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-100">
                      2
                    </div>
                    <h3 className="font-bold text-slate-900">Line Items</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => appendItem({ item_name: '', description: '', hsn_sac_code: '', quantity: 1, rate: 0, discount: 0 })}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 px-3.5 py-2 rounded-xl flex items-center space-x-1 font-semibold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-150">
                        <th className="p-3 w-1/3">Item Name & Description</th>
                        <th className="p-3 w-1/6">HSN/SAC</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Rate (₹)</th>
                        <th className="p-3 text-right">Discount (₹)</th>
                        <th className="p-3 text-right">Total (₹)</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {itemFields.map((field, idx) => {
                        const qty = watchedItems[idx]?.quantity || 0;
                        const rate = watchedItems[idx]?.rate || 0;
                        const disc = watchedItems[idx]?.discount || 0;
                        const lineTotal = qty * rate - disc;

                        return (
                          <tr key={field.id} className="hover:bg-slate-50/50">
                            <td className="p-3 space-y-2">
                              <input
                                type="text"
                                {...register(`items.${idx}.item_name`, {
                                  onChange: (e) => handleItemDescriptionChange(idx, e.target.value)
                                })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:border-blue-400 outline-none text-slate-800 font-semibold shadow-inner"
                                placeholder="Item name"
                              />
                              <textarea
                                rows={1}
                                {...register(`items.${idx}.description`, {
                                  onChange: (e) => handleItemDescriptionChange(idx, e.target.value)
                                })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 focus:border-blue-400 outline-none text-slate-400 text-[10px] shadow-inner"
                                placeholder="Description (optional)"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                {...register(`items.${idx}.hsn_sac_code`)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none text-slate-800 text-center font-mono shadow-inner"
                                placeholder="HSN/SAC"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                                className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none text-center text-slate-800 shadow-inner"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                {...register(`items.${idx}.rate`, { valueAsNumber: true })}
                                className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none text-right text-slate-800 shadow-inner"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                {...register(`items.${idx}.discount`, { valueAsNumber: true })}
                                className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none text-right text-slate-800 shadow-inner"
                              />
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800">
                              ₹{lineTotal.toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              {itemFields.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Taxable Amount</span>
                  <span className="text-base font-extrabold text-blue-600">₹{subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Step 3: Terms & Conditions Checklist */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-100">
                      3
                    </div>
                    <h3 className="font-bold text-slate-900">Terms & Conditions</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addTerm}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 px-3.5 py-2 rounded-xl flex items-center space-x-1 font-semibold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add T&C</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {termsList.map((clause, idx) => (
                    <div key={idx} className="flex items-start space-x-3 p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-xl transition-all shadow-sm">
                      <input
                        type="checkbox"
                        checked={clause.selected}
                        onChange={() => toggleTerm(idx)}
                        className="mt-1 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <textarea
                          rows={2}
                          value={clause.text}
                          onChange={(e) => updateTermText(idx, e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:ring-0 text-slate-700 text-xs resize-none py-0.5 leading-normal"
                          placeholder="Enter terms and conditions clause..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTerm(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete Clause"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  
                  {termsList.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No Terms & Conditions clauses. Click "Add T&C" to create one.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Form Actions */}
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-blue-600/10 flex items-center space-x-2 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Save & Continue</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. PREVIEW MODAL */}
          {showPreviewModal && selectedQuote && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-slate-900">{selectedQuote.quotation_no}</h2>
                      <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-md border border-blue-100">
                        Rev Index: {selectedQuote.revision_index} ({selectedQuote.revision_label})
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Created on {new Date(selectedQuote.created_at).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-250 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Client Details</h3>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold text-slate-900">{selectedQuote.client_name}</p>
                          <p className="text-xs text-slate-500">{selectedQuote.client_contact}</p>
                          <p className="text-xs text-slate-500">{selectedQuote.client_address}</p>
                        </div>
                      </div>

                      {selectedQuote.subject && (
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject / Reference</h3>
                          <p className="text-sm text-slate-700 bg-slate-55 p-3 rounded-xl border border-slate-200 font-medium">
                            {selectedQuote.subject}
                          </p>
                        </div>
                      )}

                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Line Items</h3>
                        <div className="overflow-x-auto border border-slate-150 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-150">
                                <th className="p-3">Item Name</th>
                                <th className="p-3">HSN/SAC</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-right">Rate</th>
                                <th className="p-3 text-right">Disc.</th>
                                <th className="p-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {(selectedQuote.items || []).map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-3">
                                    <p className="font-semibold text-slate-800">{item.item_name}</p>
                                    {item.description && <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>}
                                  </td>
                                  <td className="p-3 font-mono text-slate-500">{item.hsn_sac_code || '-'}</td>
                                  <td className="p-3 text-center text-slate-600">{Number(item.quantity)}</td>
                                  <td className="p-3 text-right text-slate-600">₹{Number(item.rate).toFixed(2)}</td>
                                  <td className="p-3 text-right text-slate-400">₹{Number(item.discount || 0).toFixed(2)}</td>
                                  <td className="p-3 text-right font-bold text-blue-600">
                                    ₹{(Number(item.quantity) * Number(item.rate) - Number(item.discount || 0)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">Quote Summary</h3>
                        
                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Quote Status</span>
                          <span className="inline-block text-xs font-bold mt-1 text-slate-800">
                            {selectedQuote.status}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Validity Date</span>
                          <span className="text-sm font-semibold text-slate-800">
                            {selectedQuote.validity_date ? new Date(selectedQuote.validity_date).toLocaleDateString() : 'No Limit'}
                          </span>
                        </div>

                        <div className="border-t border-slate-200 pt-3 space-y-2">
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Subtotal</span>
                            <span className="text-sm font-bold text-slate-850">₹{Number(selectedQuote.taxable_amount).toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Total rounded value</span>
                            <span className="text-xl font-black text-blue-600">₹{Number(selectedQuote.total_amount).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                  {selectedQuote.sync_status === 'pending' ? (
                    <button disabled className="bg-blue-600/50 text-white/80 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-not-allowed">
                      <Download className="h-4 w-4" />
                      <span>Download PDF</span>
                    </button>
                  ) : (
                    <a
                      href={`${API_BASE}/quotations/${selectedQuote.quotation_no}/${selectedQuote.revision_label}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download PDF</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowPreviewModal(false); handleEditRevisionClick(selectedQuote); }}
                    disabled={selectedQuote.sync_status === 'pending'}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 disabled:opacity-40"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Create Revision</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. REVISION HISTORY */}
          {activeTab === 'history' && selectedQuote && (
            <div className="max-w-5xl mx-auto space-y-8 pb-12">
              <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">Revision History: {selectedQuote.quotation_no}</h2>
                    <p className="text-xs text-slate-400 mt-1">Select another revision to compare side-by-side.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Archived Revisions</h3>
                  
                  <div className="space-y-3">
                    {history.map((rev, idx) => (
                      <button
                        key={rev.id}
                        onClick={() => { setSelectedQuote(rev); setDiffBaseIndex(idx + 1 < history.length ? idx + 1 : idx); }}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center ${
                          selectedQuote.id === rev.id
                            ? 'bg-blue-50/50 border-blue-500 text-blue-800'
                            : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900">Index {rev.revision_index}</span>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono font-bold">
                              {rev.revision_label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(rev.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-blue-600">₹{Number(rev.total_amount).toLocaleString('en-IN')}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{rev.status}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex justify-between items-center shadow-sm">
                    <div>
                      <h3 className="font-bold text-slate-900">Active Selection</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Rev Index {selectedQuote.revision_index} ({selectedQuote.revision_label})</p>
                    </div>
                    {selectedQuote.sync_status === 'pending' ? (
                      <button disabled className="bg-blue-600/50 text-white/80 text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-not-allowed">
                        <Download className="h-4.5 w-4.5" />
                        <span>Download PDF</span>
                      </button>
                    ) : (
                      <a 
                        href={`${API_BASE}/quotations/${selectedQuote.quotation_no}/${selectedQuote.revision_label}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-colors shadow-md shadow-blue-600/10 font-semibold"
                      >
                        <Download className="h-4.5 w-4.5" />
                        <span>Download PDF</span>
                      </a>
                    )}
                  </div>

                  {history.length > 1 && (
                    <QuotationDiffView 
                      baseRev={history[diffBaseIndex] || history[history.length - 1]} 
                      targetRev={selectedQuote} 
                    />
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
