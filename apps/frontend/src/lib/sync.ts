import { db } from './db';

const host = typeof window !== 'undefined'
  ? window.location.hostname
  : '127.0.0.1';
const API_BASE = `http://${host}:5000/api`;

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const role = localStorage.getItem('user-role') || 'Admin';
  const name = localStorage.getItem('user-name') || 'System Admin';
  return {
    'X-User-Role': role,
    'X-User-Name': name,
  };
}

export async function syncOutbox() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return;
  }

  const entries = await db.outbox.toArray();
  if (entries.length === 0) return;

  for (const entry of entries) {
    try {
      let res;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      };

      if (entry.action === 'create') {
        res = await fetch(`${API_BASE}/quotations`, {
          method: 'POST',
          headers,
          body: JSON.stringify(entry.payload),
        });
      } else if (entry.action === 'create_revision' && entry.quotation_no) {
        res = await fetch(`${API_BASE}/quotations/${entry.quotation_no}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(entry.payload),
        });
      }

      if (res && res.ok) {
        const serverData = await res.json();
        
        // Remove the temporary local record
        await db.quotations.delete(entry.quotation_id);
        
        // Add the synced server record
        await db.quotations.add({
          id: serverData.id,
          quotation_no: serverData.quotation_no,
          revision_index: serverData.revision_index,
          revision_label: serverData.revision_label,
          client_name: serverData.client_name,
          client_address: serverData.client_address,
          client_contact: serverData.client_contact,
          validity_date: serverData.validity_date,
          subject: serverData.subject,
          taxable_amount: Number(serverData.taxable_amount),
          total_amount: Number(serverData.total_amount),
          status: serverData.status,
          created_at: serverData.created_at,
          items: serverData.items,
          content_blocks: serverData.content_blocks,
          sync_status: 'synced',
        });

        // Delete from outbox queue
        await db.outbox.delete(entry.id!);
      }
    } catch (err) {
      console.error('Failed to sync outbox entry:', entry, err);
      // Stop syncing subsequent entries if backend is down
      break;
    }
  }
}

export async function fetchLatestFromServer() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/quotations`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      
      // Clear current synced cache
      const syncedQuotes = await db.quotations.where('sync_status').equals('synced').toArray();
      await db.quotations.bulkDelete(syncedQuotes.map(q => q.id));

      // Load server data into Dexie
      for (const item of data) {
        await db.quotations.put({
          id: item.id,
          quotation_no: item.quotation_no,
          revision_index: item.revision_index,
          revision_label: item.revision_label,
          client_name: item.client_name,
          client_address: item.client_address,
          client_contact: item.client_contact,
          validity_date: item.validity_date,
          subject: item.subject,
          taxable_amount: Number(item.taxable_amount),
          total_amount: Number(item.total_amount),
          status: item.status,
          created_at: item.created_at,
          items: item.items,
          content_blocks: item.content_blocks,
          sync_status: 'synced',
        });
      }
    }
  } catch (err) {
    console.warn('Backend server is offline or unreachable. Running in offline/cached mode.');
  }
}

export async function syncHsnCodes() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/hsn-codes`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data) && data.length > 0) {
        await db.hsnCodes.clear();
        await db.hsnCodes.bulkAdd(data);
        console.log(`Synced ${data.length} HSN codes from server.`);
      }
    }
  } catch (err) {
    console.warn('Backend server is offline or unreachable. HSN codes sync skipped.');
  }
}
