'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { syncOutbox, fetchLatestFromServer } from '../lib/sync';
import { HSN_SEED_DATA } from '../lib/hsnData';
import { 
  FileText, Plus, Edit, Eye, History, Trash2, Calendar, User, 
  MapPin, Phone, Tag, DollarSign, ChevronRight, X, ArrowLeft, RefreshCw, Save, CheckCircle, Wifi, WifiOff, Bold, Italic, List, ListOrdered, FileSpreadsheet, Download, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000/api';

// Zod validation schemas
const ItemSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  hsn_sac_code: z.string().optional(),
  quantity: z.number().min(1, 'Qty must be at least 1'),
  rate: z.number().min(0, 'Rate cannot be negative'),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
});

const ContentBlockSchema = z.object({
  block_type: z.string(),
  source: z.string(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category_tag: z.string().optional(),
  sort_order: z.number().optional(),
});

const QuotationFormSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_address: z.string().optional(),
  client_contact: z.string().optional(),
  validity_date: z.string().optional(),
  subject: z.string().optional(),
  status: z.string().default('Draft'),
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
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors ${editor.isActive('bold') ? 'bg-slate-800 text-indigo-400' : ''}`}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors ${editor.isActive('italic') ? 'bg-slate-800 text-indigo-400' : ''}`}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors ${editor.isActive('bulletList') ? 'bg-slate-800 text-indigo-400' : ''}`}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors ${editor.isActive('orderedList') ? 'bg-slate-800 text-indigo-400' : ''}`}
          title="Ordered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 py-3 min-h-[120px] text-sm text-slate-200 focus:outline-none">
        <EditorContent editor={editor} className="outline-none focus:outline-none max-w-none prose prose-invert prose-sm" />
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

  // Diff content blocks
  const baseBlocksMap = new Map(baseRev.content_blocks.map((b: any) => [b.block_type, b]));
  const targetBlocksMap = new Map(targetRev.content_blocks.map((b: any) => [b.block_type, b]));

  const allBlockTypes = Array.from(new Set([
    ...baseRev.content_blocks.map((b: any) => b.block_type),
    ...targetRev.content_blocks.map((b: any) => b.block_type)
  ]));

  const blockDiffs = allBlockTypes.map(type => {
    const baseBlock: any = baseBlocksMap.get(type);
    const targetBlock: any = targetBlocksMap.get(type);

    if (!baseBlock) {
      return { title: targetBlock.title, status: 'added', content: targetBlock.content };
    }
    if (!targetBlock) {
      return { title: baseBlock.title, status: 'removed', content: baseBlock.content };
    }

    const changed = baseBlock.content !== targetBlock.content || baseBlock.title !== targetBlock.title;

    return {
      title: targetBlock.title,
      status: changed ? 'changed' : 'unchanged',
      oldTitle: baseBlock.title,
      newTitle: targetBlock.title,
      oldContent: baseBlock.content,
      newContent: targetBlock.content,
    };
  });

  return (
    <div className="space-y-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div>
        <h3 className="font-semibold text-slate-200">Visual Revision Diff</h3>
        <p className="text-xs text-slate-400">Comparing Revision Index {baseRev.revision_index} (Left/Old) with Revision Index {targetRev.revision_index} (Right/New)</p>
      </div>

      {/* Items Diff */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items Changes</h4>
        <div className="space-y-2">
          {itemDiffs.map((diff, idx) => (
            <div key={idx} className={`p-4 rounded-xl border text-xs ${
              diff.status === 'added' ? 'bg-emerald-950/20 border-emerald-800/50' :
              diff.status === 'removed' ? 'bg-rose-955/20 border-rose-800/50' :
              diff.status === 'changed' ? 'bg-amber-955/20 border-amber-800/50' :
              'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-200">{diff.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                  diff.status === 'added' ? 'bg-emerald-900/60 text-emerald-300' :
                  diff.status === 'removed' ? 'bg-rose-900/60 text-rose-300' :
                  diff.status === 'changed' ? 'bg-amber-900/60 text-amber-300' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {diff.status}
                </span>
              </div>

              {diff.status === 'added' && (
                <p className="text-emerald-400">Added: {diff.qty} units x ₹{Number(diff.rate).toFixed(2)} (Disc: ₹{Number(diff.disc).toFixed(2)})</p>
              )}
              {diff.status === 'removed' && (
                <p className="text-rose-400 line-through">Removed: {diff.qty} units x ₹{Number(diff.rate).toFixed(2)}</p>
              )}
              {diff.status === 'changed' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-slate-400">
                    <p className="text-[10px] uppercase">Old Values</p>
                    <p>Qty: {diff.oldQty}</p>
                    <p>Rate: ₹{Number(diff.oldRate).toFixed(2)}</p>
                    <p>Disc: ₹{Number(diff.oldDisc).toFixed(2)}</p>
                  </div>
                  <div className="text-amber-400 font-semibold">
                    <p className="text-[10px] uppercase text-slate-400">New Values</p>
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

      {/* Content Blocks Diff */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Content Blocks Changes</h4>
        <div className="space-y-3">
          {blockDiffs.map((diff, idx) => (
            <div key={idx} className={`p-4 rounded-xl border text-xs ${
              diff.status === 'added' ? 'bg-emerald-950/20 border-emerald-800/50' :
              diff.status === 'removed' ? 'bg-rose-955/20 border-rose-800/50' :
              diff.status === 'changed' ? 'bg-amber-955/20 border-amber-800/50' :
              'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-200">{diff.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                  diff.status === 'added' ? 'bg-emerald-900/60 text-emerald-300' :
                  diff.status === 'removed' ? 'bg-rose-900/60 text-rose-300' :
                  diff.status === 'changed' ? 'bg-amber-900/60 text-amber-300' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {diff.status}
                </span>
              </div>

              {diff.status === 'added' && (
                <div className="prose prose-invert prose-sm text-emerald-400" dangerouslySetInnerHTML={{ __html: diff.content }} />
              )}
              {diff.status === 'removed' && (
                <div className="prose prose-invert prose-sm text-rose-400 line-through" dangerouslySetInnerHTML={{ __html: diff.content }} />
              )}
              {diff.status === 'changed' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r border-slate-800 pr-2">
                    <p className="text-[10px] uppercase text-slate-500 mb-1">Old Text</p>
                    <div className="prose prose-invert prose-sm text-slate-400" dangerouslySetInnerHTML={{ __html: diff.oldContent || '' }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-amber-500 mb-1">New Text</p>
                    <div className="prose prose-invert prose-sm text-amber-300 font-semibold" dangerouslySetInnerHTML={{ __html: diff.newContent || '' }} />
                  </div>
                </div>
              )}
              {diff.status === 'unchanged' && (
                <div className="prose prose-invert prose-sm text-slate-500" dangerouslySetInnerHTML={{ __html: diff.oldContent || '' }} />
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

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'view' | 'history'>('dashboard');
  const [isOnline, setIsOnline] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // Diff target selection
  const [diffBaseIndex, setDiffBaseIndex] = useState<number>(0);

  const [compilingId, setCompilingId] = useState<string | null>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters State
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMinVal, setFilterMinVal] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [userRole, setUserRole] = useState<'Admin' | 'SalesRep' | 'Viewer'>('Admin');
  const [userName, setUserName] = useState('System Admin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('user-role') as any;
      const savedName = localStorage.getItem('user-name');
      if (savedRole) setUserRole(savedRole);
      if (savedName) setUserName(savedName);
    }
  }, []);

  const handleRoleChange = (role: 'Admin' | 'SalesRep' | 'Viewer') => {
    setUserRole(role);
    localStorage.setItem('user-role', role);
    let name = 'System Admin';
    if (role === 'SalesRep') name = 'Sales Representative';
    if (role === 'Viewer') name = 'Guest Viewer';
    setUserName(name);
    localStorage.setItem('user-name', name);
  };

  const handleCreateNewClick = () => {
    setSelectedQuote(null);
    setIsRevisionMode(false);
    reset({
      client_name: '',
      client_address: '',
      client_contact: '',
      validity_date: '',
      subject: '',
      status: 'Draft',
      revision_label: '',
      items: [{ item_name: '', description: '', hsn_sac_code: '', quantity: 1, rate: 0, discount: 0 }],
      content_blocks: [
        { block_type: 'scope_of_work', source: 'manual', title: 'Scope of Work', content: '<p>Include technical proposal or delivery scopes here.</p>', sort_order: 0 },
        { block_type: 'terms_conditions', source: 'manual', title: 'Terms & Conditions', content: '<p>Payment: 100% advance along with Purchase Order.<br>Delivery: Within 2-3 weeks.</p>', sort_order: 1 }
      ]
    });
    setActiveTab('form');
  };

  const handleEditRevisionClick = (quote: any) => {
    setSelectedQuote(quote);
    setIsRevisionMode(true);
    reset({
      client_name: quote.client_name,
      client_address: quote.client_address || '',
      client_contact: quote.client_contact || '',
      validity_date: quote.validity_date ? new Date(quote.validity_date).toISOString().split('T')[0] : '',
      subject: quote.subject || '',
      status: quote.status || 'Draft',
      revision_label: String(quote.revision_index + 1),
      items: (quote.items || []).map((item: any) => ({
        item_name: item.item_name,
        description: item.description || '',
        hsn_sac_code: item.hsn_sac_code || '',
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        discount: Number(item.discount || 0),
      })),
      content_blocks: (quote.content_blocks || []).map((cb: any) => ({
        block_type: cb.block_type,
        source: cb.source,
        title: cb.title,
        content: cb.content,
        sort_order: cb.sort_order,
      }))
    });
    setActiveTab('form');
  };

  const handleViewClick = (quote: any) => {
    setSelectedQuote(quote);
    setShowPreviewModal(true);
  };

  const handleHistoryClick = async (quotationNo: string) => {
    const localHistory = await db.quotations
      .where('quotation_no')
      .equals(quotationNo)
      .toArray();

    localHistory.sort((a, b) => b.revision_index - a.revision_index);
    setHistory(localHistory);
    setSelectedQuote(localHistory[0] || null);
    setDiffBaseIndex(localHistory.length > 1 ? 1 : 0);
    setActiveTab('history');
  };

  // Filter local cached database quotations based on state inputs
  const filteredQuotes = quotations.filter(q => {
    if (filterClient && !q.client_name.toLowerCase().includes(filterClient.toLowerCase()) && !q.quotation_no.toLowerCase().includes(filterClient.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'pending') {
        if (q.sync_status !== 'pending') return false;
      } else {
        if (q.status !== filterStatus || q.sync_status === 'pending') return false;
      }
    }
    if (filterMinVal && Number(q.total_amount) < Number(filterMinVal)) {
      return false;
    }
    return true;
  });

  // Setup TanStack Table
  const columnHelper = createColumnHelper<any>();
  const columns = [
    columnHelper.accessor('quotation_no', {
      header: 'Quote No',
      cell: info => (
        <span className={`font-mono px-2 py-0.5 rounded-md border ${
          info.row.original.sync_status === 'pending'
            ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
            : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
        }`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('client_name', {
      header: 'Client Name',
      cell: info => <span className="font-semibold text-slate-200">{info.getValue()}</span>,
    }),
    columnHelper.accessor('revision_index', {
      header: 'Latest Rev',
      cell: info => (
        <span className="font-mono text-xs text-slate-400">
          Rev {info.getValue()} ({info.row.original.revision_label})
        </span>
      ),
    }),
    columnHelper.accessor('total_amount', {
      header: 'Total Value',
      cell: info => <span className="font-bold text-indigo-400">₹{Number(info.getValue()).toLocaleString('en-IN')}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => {
        const statusVal = info.row.original.sync_status === 'pending' ? 'Sync Pending' : info.getValue();
        return (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
            statusVal === 'Sync Pending' ? 'bg-amber-950/40 text-amber-400 border-amber-800' :
            statusVal === 'Draft' ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' :
            statusVal === 'Sent' ? 'bg-sky-950/40 text-sky-400 border-sky-800/40' :
            statusVal === 'Accepted' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' :
            'bg-slate-800/80 text-slate-400 border-slate-700'
          }`}>
            {statusVal}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="text-right block w-full pr-4">Actions</span>,
      cell: info => (
        <div className="text-right space-x-3 pr-2">
          <button onClick={() => handleViewClick(info.row.original)} className="text-slate-400 hover:text-indigo-400" title="View Details">
            <Eye className="h-4 w-4 inline" />
          </button>
          {info.row.original.sync_status === 'pending' ? (
            <button
              disabled
              className="text-slate-400 opacity-30 cursor-not-allowed"
              title="Download PDF (Sync Pending)"
            >
              <Download className="h-4 w-4 inline" />
            </button>
          ) : (
            <a
              href={`${API_BASE}/quotations/${info.row.original.quotation_no}/${info.row.original.revision_label}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-400 inline-block align-middle"
              title="View/Download PDF"
            >
              <Download className="h-4 w-4 inline" />
            </a>
          )}
          <button
            onClick={() => handleEditRevisionClick(info.row.original)}
            disabled={info.row.original.sync_status === 'pending'}
            className="text-slate-400 hover:text-emerald-400 disabled:opacity-30"
            title="Revise Quote"
          >
            <Edit className="h-4 w-4 inline" />
          </button>
          <button
            onClick={() => handleHistoryClick(info.row.original.quotation_no)}
            disabled={info.row.original.sync_status === 'pending'}
            className="text-slate-400 hover:text-indigo-400 disabled:opacity-30"
            title="Revision History"
          >
            <History className="h-4 w-4 inline" />
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
    resolver: zodResolver(QuotationFormSchema),
    defaultValues: {
      client_name: '',
      client_address: '',
      client_contact: '',
      validity_date: '',
      subject: '',
      status: 'Draft',
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

  useEffect(() => {
    const seedHsnData = async () => {
      const count = await db.hsnCodes.count();
      if (count === 0) {
        await db.hsnCodes.bulkAdd(HSN_SEED_DATA);
      }
    };
    seedHsnData();

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = async () => {
        setIsOnline(true);
        setLoading(true);
        await syncOutbox();
        await fetchLatestFromServer();
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
                  console.log('Unregistered active service worker in development');
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
    setLoading(false);
  };

  const handleItemDescriptionChange = (index: number, val: string) => {
    if (!val || hsnList.length === 0) return;
    const fuse = new Fuse(hsnList, { keys: ['description', 'code'], threshold: 0.4 });
    const results = fuse.search(val);
    if (results.length > 0) {
      setValue(`items.${index}.hsn_sac_code`, results[0].item.code);
    }
  };

  const handleCompilePdf = async (quote: any) => {
    setCompilingId(quote.id);
    try {
      const res = await fetch(`${API_BASE}/quotations/${quote.id}/compile`, {
        method: 'POST',
        headers: {
          'X-User-Role': userRole,
          'X-User-Name': userName,
        }
      });
      if (res.ok) {
        window.open(`${API_BASE}/quotations/${quote.quotation_no}/${quote.revision_label}/download`, '_blank');
      } else {
        alert('Failed to trigger PDF compilation.');
      }
    } catch (err) {
      console.error(err);
      alert('Error compiling document.');
    } finally {
      setCompilingId(null);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

      const validatedRows = json.map((row, idx) => {
        const errorsList: string[] = [];
        if (!row['Client Name']) errorsList.push('Missing Client Name');
        if (!row['Item Name']) errorsList.push('Missing Item Name');
        if (isNaN(Number(row['Quantity']))) errorsList.push('Invalid Quantity');
        if (isNaN(Number(row['Rate']))) errorsList.push('Invalid Rate');

        return {
          id: idx,
          clientName: row['Client Name'] || '',
          clientAddress: row['Client Address'] || '',
          clientContact: row['Client Contact'] || '',
          subject: row['Subject'] || '',
          validityDate: row['Validity Date'] || '',
          itemName: row['Item Name'] || '',
          description: row['Description'] || '',
          hsnCode: row['HSN Code'] || '',
          quantity: Number(row['Quantity']) || 1,
          rate: Number(row['Rate']) || 0,
          discount: Number(row['Discount']) || 0,
          errors: errorsList,
        };
      });

      setExcelPreviewData(validatedRows);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleProceedWithExcel = () => {
    if (!excelPreviewData) return;
    const validRows = excelPreviewData.filter(row => row.errors.length === 0);
    if (validRows.length === 0) {
      alert('No valid rows found.');
      return;
    }
    const mainRecord = validRows[0];
    reset({
      client_name: mainRecord.clientName,
      client_address: mainRecord.clientAddress,
      client_contact: mainRecord.clientContact,
      validity_date: mainRecord.validityDate ? new Date(mainRecord.validityDate).toISOString().split('T')[0] : '',
      subject: mainRecord.subject,
      status: 'Draft',
      revision_label: '0',
      items: validRows.map(row => ({
        item_name: row.itemName,
        description: row.description,
        hsn_sac_code: row.hsnCode,
        quantity: row.quantity,
        rate: row.rate,
        discount: row.discount,
      })),
      content_blocks: [
        { block_type: 'scope_of_work', source: 'excel', title: 'Scope of Work', content: '<p>Imported via bulk template file.</p>', sort_order: 0 },
        { block_type: 'terms_conditions', source: 'excel', title: 'Terms & Conditions', content: '<p>Standard terms apply.</p>', sort_order: 1 }
      ]
    });
    setExcelPreviewData(null);
    setActiveTab('form');
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

    const total_amount = Math.round(taxable_amount);

    const payload = {
      client_name: values.client_name,
      client_address: values.client_address,
      client_contact: values.client_contact,
      validity_date: values.validity_date || null,
      subject: values.subject,
      status: values.status,
      revision_label: values.revision_label || '0',
      items: itemsPayload,
      content_blocks: values.content_blocks,
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
      client_contact: values.client_contact,
      validity_date: values.validity_date || undefined,
      subject: values.subject,
      taxable_amount,
      total_amount,
      status: 'Draft — pending sync',
      created_at: new Date().toISOString(),
      items: itemsPayload,
      content_blocks: values.content_blocks,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Smart Quotation
              </h1>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold">
                TanStack Table Dashboard
              </p>
            </div>
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
                  className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-700"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span className="hidden sm:inline">Bulk Excel</span>
                </button>
              </div>
            )}

            <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isOnline 
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' 
                : 'bg-amber-950/40 text-amber-400 border-amber-800/40 animate-pulse'
            }`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
              <User className="h-3.5 w-3.5 text-indigo-400" />
              <select
                value={userRole}
                onChange={(e) => handleRoleChange(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-1"
                title="Switch active user role"
              >
                <option value="Admin" className="bg-slate-900 text-slate-200">Admin</option>
                <option value="SalesRep" className="bg-slate-900 text-slate-200">Sales Rep</option>
                <option value="Viewer" className="bg-slate-900 text-slate-200">Viewer</option>
              </select>
            </div>

            {isOnline && activeTab === 'dashboard' && (
              <button 
                onClick={handleManualSync}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                title="Sync database cache"
              >
                <RefreshCw className={`h-4 w-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}

            {activeTab === 'dashboard' && (
              <button
                onClick={handleCreateNewClick}
                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20"
              >
                <Plus className="h-4 w-4" />
                <span>New Quote</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Excel Import Preview Section */}
        {excelPreviewData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 mb-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold flex items-center space-x-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                  <span>Excel Import Validation Preview</span>
                </h2>
                <p className="text-xs text-slate-400">Review rows parsed from sheet template before loading to database.</p>
              </div>
              <div className="flex space-x-3">
                <button onClick={() => setExcelPreviewData(null)} className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs px-3.5 py-2 rounded-xl border border-slate-800">
                  Cancel
                </button>
                <button onClick={handleProceedWithExcel} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-semibold">
                  Proceed to Form
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-850">
                    <th className="p-3">Status</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Item Details</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {excelPreviewData.map((row) => (
                    <tr key={row.id} className={row.errors.length > 0 ? 'bg-rose-955/20' : 'hover:bg-slate-855/30'}>
                      <td className="p-3">{row.errors.length > 0 ? <span className="text-rose-400">Flagged</span> : <span className="text-emerald-400">OK</span>}</td>
                      <td className="p-3 font-semibold text-slate-200">{row.clientName || '-'}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-300">{row.itemName}</span>
                        {row.description && <p className="text-[10px] text-slate-500 mt-0.5">{row.description}</p>}
                      </td>
                      <td className="p-3 text-right text-slate-300">{row.quantity}</td>
                      <td className="p-3 text-right text-slate-300">${row.rate}</td>
                      <td className="p-3 text-right text-slate-300">${row.discount}</td>
                      <td className="p-3 text-rose-400">{row.errors.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 1. DASHBOARD VIEW */}
        {!loading && activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Active Quotations</h2>
                <p className="text-sm text-slate-400">Professional grid managed with TanStack Table and custom revision comparison diff views.</p>
              </div>
              
              {/* Mobile Filter Floating Toggle Button */}
              <button 
                onClick={() => setShowMobileFilters(true)}
                className="md:hidden bg-slate-900 border border-slate-800 hover:bg-slate-850 p-2 rounded-xl"
              >
                <SlidersHorizontal className="h-5 w-5 text-indigo-400" />
              </button>
            </div>

            {/* Layout Grid: Sidebar filters (Desktop) + Data table */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              {/* Sidebar Filters (Desktop) */}
              <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 h-fit sticky top-24">
                <h3 className="font-semibold text-sm text-slate-300 flex items-center space-x-1.5 border-b border-slate-800 pb-2">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
                  <span>Filters</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Search Query</label>
                    <input 
                      type="text"
                      value={filterClient}
                      onChange={e => setFilterClient(e.target.value)}
                      placeholder="Quote No or Client..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Quotation Status</label>
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Accepted">Accepted</option>
                      <option value="pending">Sync Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Min total amount (₹)</label>
                    <input 
                      type="number"
                      value={filterMinVal}
                      onChange={e => setFilterMinVal(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => { setFilterClient(''); setFilterStatus('ALL'); setFilterMinVal(''); }}
                  className="w-full bg-slate-850 hover:bg-slate-800 text-xs text-slate-300 py-2 rounded-xl transition-all border border-slate-800"
                >
                  Clear Filters
                </button>
              </div>

              {/* Data Table Grid (TanStack) */}
              <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">
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
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {table.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                            No matching quotations found.
                          </td>
                        </tr>
                      ) : (
                        table.getRowModel().rows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-850/50 transition-colors">
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
              </div>
            </div>

            {/* Mobile View Bottom-Sheet Filters Overlay */}
            {showMobileFilters && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center md:hidden">
                <div className="bg-slate-900 w-full max-w-md rounded-t-3xl border-t border-slate-800 p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="font-semibold text-slate-200">Filter Quotations</h3>
                    <button onClick={() => setShowMobileFilters(false)} className="p-1 bg-slate-800 rounded-lg">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Client</label>
                      <input 
                        type="text"
                        value={filterClient}
                        onChange={e => setFilterClient(e.target.value)}
                        placeholder="Quote No or Client..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                      <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none text-slate-200"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Accepted">Accepted</option>
                        <option value="pending">Sync Pending</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-slate-800">
                    <button 
                      onClick={() => { setFilterClient(''); setFilterStatus('ALL'); }}
                      className="flex-1 bg-slate-850 hover:bg-slate-800 py-3 rounded-xl border border-slate-800 text-sm font-semibold"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={() => setShowMobileFilters(false)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-sm font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. CREATOR / EDITOR FORM */}
        {activeTab === 'form' && (
          <form onSubmit={handleSubmit(handleProceedToRevisionSave)} className="space-y-8 max-w-4xl mx-auto">
            {/* Header section */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="p-2 bg-slate-900 rounded-xl hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-xl font-semibold">
                    {isRevisionMode ? `Revise Quotation: ${selectedQuote?.quotation_no}` : 'New Quotation'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isRevisionMode ? `Creating next revision. Previous index: ${selectedQuote?.revision_index}` : 'Fill quotation details below.'}
                  </p>
                </div>
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Offline & Queue</span>
              </button>
            </div>

            {/* General Info Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="font-medium text-slate-200 border-b border-slate-800 pb-3 flex items-center space-x-2">
                <User className="h-4 w-4 text-indigo-400" />
                <span>Client & Header Information</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Client Name *</label>
                  <input
                    type="text"
                    {...register('client_name')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200"
                    placeholder="Enter Client Name"
                  />
                  {errors.client_name && <p className="text-xs text-rose-500 mt-1">{errors.client_name.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contact Details</label>
                  <input
                    type="text"
                    {...register('client_contact')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200"
                    placeholder="Phone, email, or contact person"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Client Address</label>
                  <textarea
                    rows={2}
                    {...register('client_address')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200"
                    placeholder="Physical or Billing Address"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subject / Reference</label>
                  <input
                    type="text"
                    {...register('subject')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200"
                    placeholder="e.g. Server Infrastructure Upgrade Proposal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Validity Date</label>
                    <input
                      type="date"
                      {...register('validity_date')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                    <select
                      {...register('status')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Accepted">Accepted</option>
                    </select>
                  </div>
                </div>

                {isRevisionMode && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Revision Label / ID</label>
                    <input
                      type="text"
                      {...register('revision_label')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-indigo-400"
                      placeholder="e.g. 1B, 2, Draft_C"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-medium text-slate-200 flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span>Line Items</span>
                </h3>
                <button
                  type="button"
                  onClick={() => appendItem({ item_name: '', description: '', hsn_sac_code: '', quantity: 1, rate: 0, discount: 0 })}
                  className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-800 text-indigo-400 px-3 py-1.5 rounded-lg flex items-center space-x-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Item</span>
                </button>
              </div>

              {/* Mobile View: Stacked Cards */}
              <div className="space-y-4 md:hidden">
                {itemFields.map((field, idx) => {
                  const qty = watchedItems[idx]?.quantity || 0;
                  const rate = watchedItems[idx]?.rate || 0;
                  const disc = watchedItems[idx]?.discount || 0;
                  const lineTotal = qty * rate - disc;

                  return (
                    <div key={field.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-500">Item #{idx + 1}</span>
                        {itemFields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-slate-500 hover:text-rose-500 transition-colors p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Item Name *</label>
                          <input
                            type="text"
                            required
                            {...register(`items.${idx}.item_name`)}
                            onChange={(e) => handleItemDescriptionChange(idx, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-200"
                            placeholder="e.g. Consulting"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">HSN/SAC Code</label>
                          <input
                            type="text"
                            {...register(`items.${idx}.hsn_sac_code`)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                          <input
                            type="text"
                            {...register(`items.${idx}.description`)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-200"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Qty</label>
                            <input
                              type="number"
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Rate</label>
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${idx}.rate`, { valueAsNumber: true })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Discount</label>
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${idx}.discount`, { valueAsNumber: true })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500 text-slate-200"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Line Total</span>
                          <span className="text-xs font-semibold text-indigo-400">₹{lineTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Table Grid */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border border-slate-850">
                      <th className="p-3 w-1/3">Item Details</th>
                      <th className="p-3 w-1/6">HSN/SAC</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Rate (₹)</th>
                      <th className="p-3 text-right">Disc. (₹)</th>
                      <th className="p-3 text-right">Total (₹)</th>
                      <th className="p-3 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 border-x border-b border-slate-850">
                    {itemFields.map((field, idx) => {
                      const qty = watchedItems[idx]?.quantity || 0;
                      const rate = watchedItems[idx]?.rate || 0;
                      const disc = watchedItems[idx]?.discount || 0;
                      const lineTotal = qty * rate - disc;

                      return (
                        <tr key={field.id} className="hover:bg-slate-850/20">
                          <td className="p-3 space-y-1">
                            <input
                              type="text"
                              required
                              {...register(`items.${idx}.item_name`)}
                              onChange={(e) => handleItemDescriptionChange(idx, e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 focus:border-indigo-500 outline-none text-slate-200 font-semibold"
                              placeholder="Item Name"
                            />
                            <input
                              type="text"
                              {...register(`items.${idx}.description`)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-0.5 focus:border-indigo-500 outline-none text-slate-400 text-[10px]"
                              placeholder="Optional Description"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              {...register(`items.${idx}.hsn_sac_code`)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 focus:border-indigo-500 outline-none text-slate-200 text-center font-mono"
                              placeholder="Fuzzy Match"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                              className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right text-slate-200"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${idx}.rate`, { valueAsNumber: true })}
                              className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right text-slate-200"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${idx}.discount`, { valueAsNumber: true })}
                              className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right text-slate-200"
                            />
                          </td>
                          <td className="p-3 text-right font-semibold text-indigo-400">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {itemFields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-slate-500 hover:text-rose-500 transition-colors p-1"
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

              {/* Subtotal summary */}
              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-sm font-semibold text-slate-400">Total Taxable Amount</span>
                <span className="text-lg font-bold text-indigo-400">₹{subtotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Scope / specifications / terms block */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-medium text-slate-200 flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-indigo-400" />
                  <span>Document Content Blocks (TipTap Editor)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => appendBlock({ block_type: 'technical_spec', source: 'manual', title: 'New Specification', content: '<p>Content</p>', sort_order: blockFields.length })}
                  className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-800 text-indigo-400 px-3 py-1.5 rounded-lg flex items-center space-x-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Block</span>
                </button>
              </div>

              <div className="space-y-4">
                {blockFields.map((field, idx) => (
                  <div key={field.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <select
                          {...register(`content_blocks.${idx}.block_type`)}
                          className="bg-slate-900 border border-slate-800 rounded-md px-2 py-0.5 text-xs outline-none text-slate-300 font-semibold"
                        >
                          <option value="scope_of_work">Scope of Work</option>
                          <option value="technical_spec">Technical Specs</option>
                          <option value="terms_conditions">Terms & Conditions</option>
                        </select>
                        <span className="text-[10px] text-indigo-400 bg-indigo-950/40 border border-indigo-900/60 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">
                          {watchedBlocks[idx]?.source}
                        </span>
                      </div>
                      {blockFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBlock(idx)}
                          className="text-slate-500 hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        {...register(`content_blocks.${idx}.title`)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-500 text-slate-200"
                        placeholder="Block Title (e.g. Scope of Services)"
                      />

                      <Controller
                        name={`content_blocks.${idx}.content`}
                        control={control}
                        render={({ field: { value, onChange } }) => (
                          <TiptapEditor value={value} onChange={onChange} />
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end space-x-4 border-t border-slate-800 pt-6">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm px-5 py-2.5 rounded-xl border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Offline & Queue</span>
              </button>
            </div>
          </form>
        )}

        {/* 3. PREVIEW POPUP MODAL */}
        {showPreviewModal && selectedQuote && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-semibold text-white">{selectedQuote.quotation_no}</h2>
                      <span className="bg-indigo-950/60 text-indigo-300 text-xs font-mono px-2 py-0.5 rounded-md border border-indigo-800">
                        Revision Index: {selectedQuote.revision_index} ({selectedQuote.revision_label})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Created on {new Date(selectedQuote.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Client Details</h3>
                      <div className="space-y-1.5 text-sm text-slate-200">
                        <p className="font-semibold text-white">{selectedQuote.client_name}</p>
                        {selectedQuote.client_contact && (
                          <p className="flex items-center text-slate-400 text-xs">
                            <Phone className="h-3 w-3 mr-1.5" /> {selectedQuote.client_contact}
                          </p>
                        )}
                        {selectedQuote.client_address && (
                          <p className="flex items-start text-slate-400 text-xs">
                            <MapPin className="h-3 w-3 mr-1.5 mt-0.5" /> {selectedQuote.client_address}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedQuote.subject && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject / Reference</h3>
                        <p className="text-sm text-slate-200 bg-slate-950 p-3 rounded-xl border border-slate-800 font-medium">
                          {selectedQuote.subject}
                        </p>
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Line Items</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border border-slate-800">
                              <th className="p-3">Item Name</th>
                              <th className="p-3">HSN/SAC</th>
                              <th className="p-3 text-right">Qty</th>
                              <th className="p-3 text-right">Rate</th>
                              <th className="p-3 text-right">Disc.</th>
                              <th className="p-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 border-x border-b border-slate-800">
                            {(selectedQuote.items || []).map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-850/30">
                                <td className="p-3">
                                  <p className="font-semibold text-slate-200">{item.item_name}</p>
                                  {item.description && <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>}
                                </td>
                                <td className="p-3 font-mono text-slate-300">{item.hsn_sac_code || '-'}</td>
                                <td className="p-3 text-right text-slate-300">{Number(item.quantity)}</td>
                                <td className="p-3 text-right text-slate-300">₹{Number(item.rate).toFixed(2)}</td>
                                <td className="p-3 text-right text-slate-400">₹{Number(item.discount || 0).toFixed(2)}</td>
                                <td className="p-3 text-right font-semibold text-indigo-400">
                                  ₹{(Number(item.quantity) * Number(item.rate) - Number(item.discount || 0)).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Content Blocks */}
                    {selectedQuote.content_blocks && selectedQuote.content_blocks.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Scope & Terms Blocks</h3>
                        <div className="space-y-4">
                          {(selectedQuote.content_blocks || []).map((cb: any, idx: number) => (
                            <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-slate-300">{cb.title}</h4>
                                <span className="text-[9px] text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-900/60 uppercase font-mono font-bold">
                                  {cb.block_type.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 font-sans mt-2 leading-relaxed prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: cb.content }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Summary */}
                  <div className="space-y-6">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Quotation Status</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="block text-[10px] text-slate-400">Quote Status</span>
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-semibold border mt-1 ${
                            selectedQuote.sync_status === 'pending' ? 'bg-amber-950/40 text-amber-400 border-amber-800' :
                            selectedQuote.status === 'Draft' ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' :
                            selectedQuote.status === 'Sent' ? 'bg-sky-950/40 text-sky-400 border-sky-800/40' :
                            selectedQuote.status === 'Accepted' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' :
                            'bg-slate-800/80 text-slate-400 border-slate-700'
                          }`}>
                            {selectedQuote.sync_status === 'pending' ? 'Sync Pending' : selectedQuote.status}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400">Validity Date</span>
                          <span className="text-sm font-semibold text-slate-200">
                            {selectedQuote.validity_date ? new Date(selectedQuote.validity_date).toLocaleDateString() : 'No Limit'}
                          </span>
                        </div>

                        <div className="border-t border-slate-800 pt-4 space-y-3">
                          <div>
                            <span className="block text-[10px] text-slate-400">Subtotal Taxable</span>
                            <span className="text-sm font-semibold text-slate-200">₹{Number(selectedQuote.taxable_amount).toLocaleString('en-IN')}</span>
                          </div>
      
                          <div>
                            <span className="block text-[10px] text-indigo-400 font-semibold">Total Rounded Value</span>
                            <span className="text-2xl font-bold text-white">₹{Number(selectedQuote.total_amount).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
                {selectedQuote.sync_status === 'pending' ? (
                  <button
                    disabled
                    className="bg-indigo-600/40 text-white/60 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-not-allowed"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PDF</span>
                  </button>
                ) : (
                  <a
                    href={`${API_BASE}/quotations/${selectedQuote.quotation_no}/${selectedQuote.revision_label}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>View/Download PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { setShowPreviewModal(false); handleEditRevisionClick(selectedQuote); }}
                  disabled={selectedQuote.sync_status === 'pending'}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 disabled:opacity-40"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Create Revision</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPreviewModal(false); handleHistoryClick(selectedQuote.quotation_no); }}
                  disabled={selectedQuote.sync_status === 'pending'}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-850 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 disabled:opacity-40"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>All Revisions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. REVISION HISTORY & DIFF COMPARISON VIEW */}
        {activeTab === 'history' && selectedQuote && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-6">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="p-2 bg-slate-900 rounded-xl hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-xl font-semibold">Revision History: {selectedQuote.quotation_no}</h2>
                  <p className="text-xs text-slate-400">Select another revision to compare side-by-side.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Revision Sidebar List */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">Archived Revisions</h3>
                
                <div className="space-y-3">
                  {history.map((rev, idx) => (
                    <button
                      key={rev.id}
                      onClick={() => { setSelectedQuote(rev); setDiffBaseIndex(idx + 1 < history.length ? idx + 1 : idx); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center ${
                        selectedQuote.id === rev.id
                          ? 'bg-indigo-950/40 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm">Index {rev.revision_index}</span>
                          <span className="text-[10px] bg-slate-800 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold">
                            {rev.revision_label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(rev.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-indigo-400">₹{Number(rev.total_amount).toLocaleString('en-IN')}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{rev.status}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Revision Diff View Panel */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Active Revision Header Info */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-200">Active Selection</h3>
                    <p className="text-xs text-slate-400">Rev Index {selectedQuote.revision_index} ({selectedQuote.revision_label})</p>
                  </div>
                  {selectedQuote.sync_status === 'pending' ? (
                    <button 
                      disabled
                      className="bg-indigo-600/40 text-white/60 text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-not-allowed"
                    >
                      <Download className="h-4.5 w-4.5" />
                      <span>Download Untouched PDF</span>
                    </button>
                  ) : (
                    <a 
                      href={`${API_BASE}/quotations/${selectedQuote.quotation_no}/${selectedQuote.revision_label}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-colors"
                    >
                      <Download className="h-4.5 w-4.5" />
                      <span>View/Download Untouched PDF</span>
                    </a>
                  )}
                </div>

                {/* Diff View Comparison Panel */}
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
  );
}
