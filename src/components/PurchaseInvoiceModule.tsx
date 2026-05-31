/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { PurchaseInvoice, GoodsReceipt, Supplier, Item, PaginatedResponse } from '../types';
import { Search, Plus, Eye, Check, X, CreditCard, Sparkles } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface PurchaseInvoiceModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
  autopopulatePoId?: string | null;
  resetAutopopulatedPoId?: () => void;
  autopopulateGrId?: string | null;
  resetAutopopulatedGrId?: () => void;
}

export default function PurchaseInvoiceModule({
  authToken,
  showToast,
  autopopulatePoId,
  resetAutopopulatedPoId,
  autopopulateGrId,
  resetAutopopulatedGrId
}: PurchaseInvoiceModuleProps) {
  const [pisData, setPisData] = useState<PaginatedResponse<PurchaseInvoice> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Reference elements loaded on demand
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPI, setSelectedPI] = useState<PurchaseInvoice | null>(null);

  // Creator Form fields
  const [formSupplierId, setFormSupplierId] = useState('');
  const [selectedGrIds, setSelectedGrIds] = useState<string[]>([]);
  const [formInvoiceDate, setFormInvoiceDate] = useState(new Date().toISOString().substring(0, 10));
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().substring(0, 10));
  const [formStatus, setFormStatus] = useState<string>('Unpaid');
  const [formRemarks, setFormRemarks] = useState('');

  // Consolidated Lines state
  const [formLines, setFormLines] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    receivedQty: number;
    previouslyInvoicedQty: number;
    quantity: number; // to invoice qty
    price: number;
    sourceGrId: string;
    sourceGrNumber: string;
    sourceGrItemId: string;
  }[]>([]);
  const [formError, setFormError] = useState('');
  const [referencesLoaded, setReferencesLoaded] = useState(false);

  const fetchPIs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const response = await fetch(`/api/purchase-invoices?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Could not pull purchase invoices');
      const data = await response.json();
      setPisData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling invoices list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferences = async () => {
    try {
      const [suppRes, grRes, itemsRes] = await Promise.all([
        fetch('/api/suppliers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/goods-receipts?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/items?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const sData = await suppRes.json();
      const gData = await grRes.json();
      const iData = await itemsRes.json();

      setSuppliers(sData.data || []);
      setGoodsReceipts(gData.data || []);
      setItems(iData.data || []);
      setReferencesLoaded(true);
    } catch (err) {
      console.error('Error fetching referential lists:', err);
    }
  };

  useEffect(() => {
    fetchPIs();
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchReferences();
  }, []);

  // Monitor autopopulation trigger (for PO directly, if fallback navigation occurs)
  // We can look up the latest GR for this PO and preselect it!
  useEffect(() => {
    if (autopopulatePoId && referencesLoaded) {
      const matchGr = goodsReceipts.find(g => g.poId === autopopulatePoId);
      if (matchGr) {
        setFormSupplierId(matchGr.supplierId);
        setSelectedGrIds([matchGr.id]);
        loadItemsFromGRs(matchGr.supplierId, [matchGr.id]);
        setIsFormOpen(true);
      } else {
        // Find if we have any PO to resolve Supplier first
        fetch(`/api/purchase-orders/${autopopulatePoId}`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(res => res.json())
          .then((poObj) => {
            setFormSupplierId(poObj.supplierId);
            setIsFormOpen(true);
          }).catch(console.error);
      }
      if (resetAutopopulatedPoId) resetAutopopulatedPoId();
    }
  }, [autopopulatePoId, referencesLoaded, goodsReceipts]);

  // Monitor prefilled Goods Receipt trigger
  useEffect(() => {
    if (autopopulateGrId && referencesLoaded) {
      const matchGr = goodsReceipts.find(g => g.id === autopopulateGrId);
      if (matchGr) {
        setFormSupplierId(matchGr.supplierId);
        setSelectedGrIds([matchGr.id]);
        loadItemsFromGRs(matchGr.supplierId, [matchGr.id]);
        setIsFormOpen(true);
      }
      if (resetAutopopulatedGrId) resetAutopopulatedGrId();
    }
  }, [autopopulateGrId, referencesLoaded, goodsReceipts]);

  const loadItemsFromGRs = (supplierId: string, grIds: string[], customGrPool?: GoodsReceipt[], customItemsPool?: Item[]) => {
    if (!supplierId || grIds.length === 0) {
      setFormLines([]);
      return;
    }

    const lines: typeof formLines = [];
    const gPool = customGrPool || goodsReceipts;
    const iPool = customItemsPool || items;
    grIds.forEach(id => {
      const grObj = gPool.find(g => g.id === id);
      if (grObj) {
        grObj.items.forEach(it => {
          const prevInvoiced = it.invoicedQty || 0;
          const remaining = Math.max(0, it.receivedQty - prevInvoiced);

          if (remaining > 0) {
            // Find default cost
            const catalogItem = items.find(cat => cat.id === it.itemId);
            const defaultCost = catalogItem ? catalogItem.defaultCost : 0;

            lines.push({
              itemId: it.itemId,
              itemCode: it.itemCode || 'SKU',
              itemName: it.itemName || 'Cargo description',
              receivedQty: it.receivedQty,
              previouslyInvoicedQty: prevInvoiced,
              quantity: remaining, // default invoice amount is remaining
              price: defaultCost,
              sourceGrId: grObj.id,
              sourceGrNumber: grObj.grNumber,
              sourceGrItemId: it.id
            });
          }
        });
      }
    });
    setFormLines(lines);
  };

  const handleSupplierChange = (suppId: string) => {
    setFormSupplierId(suppId);
    setSelectedGrIds([]);
    setFormLines([]);
  };

  const handleGrCheckboxToggle = (grId: string) => {
    let updated: string[];
    if (selectedGrIds.includes(grId)) {
      updated = selectedGrIds.filter(id => id !== grId);
    } else {
      updated = [...selectedGrIds, grId];
    }
    setSelectedGrIds(updated);
    loadItemsFromGRs(formSupplierId, updated);
  };

  const handleLineValueChange = (idx: number, field: 'quantity' | 'price', valueStr: string) => {
    const updated = [...formLines];
    const val = Math.max(0, Number(valueStr) || 0);
    updated[idx][field] = val;
    setFormLines(updated);
  };

  const computeFormTotal = () => {
    return formLines.reduce((sum, row) => sum + row.quantity * row.price, 0);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId) {
      setFormError('Supplier must be chosen.');
      return;
    }
    if (selectedGrIds.length === 0) {
      setFormError('At least one Goods Receipt must be checked.');
      return;
    }
    const invalidLine = formLines.some(f => f.quantity <= 0 || f.price <= 0);
    if (invalidLine) {
      setFormError('Make sure invoice quantities and prices are greater than 0 on all items.');
      return;
    }

    // Verify over-invoicing constraints
    for (const row of formLines) {
      const allowed = row.receivedQty - row.previouslyInvoicedQty;
      if (row.quantity > allowed) {
        setFormError(`Over-invoicing Alert: [${row.itemCode}] invoices ${row.quantity} against ${allowed} remaining in GR ${row.sourceGrNumber}.`);
        return;
      }
    }

    try {
      const response = await fetch('/api/purchase-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          supplierId: formSupplierId,
          invoiceDate: formInvoiceDate,
          dueDate: formDueDate,
          status: formStatus,
          remarks: formRemarks,
          items: formLines.map(l => ({
            itemId: l.itemId,
            quantity: l.quantity,
            price: l.price,
            sourceGrId: l.sourceGrId,
            sourceGrItemId: l.sourceGrItemId
          }))
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected invoice draft creation');

      showToast(`Supplier Invoice [${resData.piNumber}] generated from ${selectedGrIds.length} GR logs.`, 'success');
      setIsFormOpen(false);
      fetchPIs();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save Supplier Invoice.');
    }
  };

  const handleToggleStatus = async (id: string, newStat: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: newStat })
      });
      if (!response.ok) throw new Error('Status reconciler command rejected.');
      showToast('Billing status successfully adjusted!', 'success');
      fetchPIs();
      if (isDetailOpen && selectedPI) {
        setSelectedPI({ ...selectedPI, status: newStat as any });
      }
    } catch (error: any) {
      showToast(error?.message || 'Failed to reconcile status.', 'error');
    }
  };

  const handleOpenDetail = (pi: PurchaseInvoice) => {
    setSelectedPI(pi);
    setIsDetailOpen(true);
  };

  const availableGRsForSupplier = goodsReceipts.filter(g => g.supplierId === formSupplierId);

  return (
    <div className="space-y-6">
      {/* Module Title info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Purchase Invoices (Vendor Billing)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Verify and audit invoices issued by suppliers by compiling and reconciling statements against Goods Receipts.
          </p>
        </div>
        <button
          onClick={() => {
            fetchReferences();
            setFormSupplierId('');
            setSelectedGrIds([]);
            setFormInvoiceDate(new Date().toISOString().substring(0, 10));
            setFormDueDate(new Date().toISOString().substring(0, 10));
            setFormStatus('Unpaid');
            setFormRemarks('');
            setFormLines([]);
            setFormError('');
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold self-start shadow-3xs hover:shadow-xs uppercase tracking-wide transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>INVOICE MULTI-GR CARGO</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search PI numbers, suppliers..."
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-450"
          />
        </div>

        <SearchableSelect
          options={[
            { value: '', label: 'All Settlement Statuses' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Unpaid', label: 'Unpaid' },
            { value: 'Paid', label: 'Paid' }
          ]}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          className="w-56 text-slate-600 font-bold"
        />
      </div>

      {/* Invoice Grid Board */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-3xs font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Invoice Reference</th>
                <th className="py-3 px-5">Supplier Vendor</th>
                <th className="py-3 px-5">Related GR Numbers</th>
                <th className="py-3 px-5">Bill Date</th>
                <th className="py-3 px-5">Due Date</th>
                <th className="py-3 px-5 text-right">Invoice Sum</th>
                <th className="py-3 px-5 text-center">Settlement Status</th>
                <th className="py-3 px-5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Loading account bills...
                  </td>
                </tr>
              ) : !pisData || pisData.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-xs text-slate-400">
                    No matching Purchase Invoices found. Select &quot;Invoice Multi-GR Cargo&quot; to compile one.
                  </td>
                </tr>
              ) : (
                pisData.data.map((pi) => (
                  <tr key={pi.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {pi.piNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">{pi.supplierName}</td>
                    <td className="py-3.5 px-5 text-slate-500 font-mono">
                      <span className="bg-slate-50 border text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px] block max-w-xs truncate" title={pi.poNumber}>
                        {pi.poNumber || 'Direct Purchase'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-505 font-mono">{new Date(pi.invoiceDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-5 text-slate-505 font-mono">{new Date(pi.dueDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-5 text-right font-bold text-slate-900 font-mono">${pi.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          pi.status === 'Draft'
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : pi.status === 'Unpaid'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                            : 'bg-teal-50 text-teal-700 border border-teal-100'
                        }`}
                      >
                        {pi.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(pi)}
                          className="py-1 px-2 hover:bg-slate-100 text-slate-600 font-bold font-mono text-[10px] transition-colors"
                        >
                          AUDIT
                        </button>

                        {pi.status !== 'Paid' && (
                          <button
                            onClick={() => handleToggleStatus(pi.id, pi.status === 'Draft' ? 'Unpaid' : 'Paid')}
                            className="py-1 px-2 text-[10px] hover:bg-teal-50 rounded text-teal-600 font-black flex items-center gap-0.5 font-mono"
                          >
                            <span>{pi.status === 'Draft' ? 'POST' : 'SET SETTLED'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {pisData && pisData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50 font-mono text-[10px]">
            <span>PAGE {pisData.page} OF {pisData.pages} ({pisData.total} TOTAL)</span>
            <div className="flex gap-1.5">
              <button
                disabled={pisData.page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="bg-white px-2 py-1.5 border hover:border-slate-300 rounded text-slate-700 font-bold"
              >
                PREV
              </button>
              <button
                disabled={pisData.page >= pisData.pages}
                onClick={() => setPage(p => p + 1)}
                className="bg-white px-2 py-1.5 border hover:border-slate-300 rounded text-slate-705 font-bold"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity animate-fade-in">
          <div className="w-full max-w-2xl h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8 animate-slide-in">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-950 font-sans tracking-tight uppercase flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>Consolidated Vendor Billing compilation</span>
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="rounded bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-mono font-bold leading-normal">
                  {formError}
                </div>
              )}

              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Supplier First */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      1. Select Creditor Supplier
                    </label>
                    <SearchableSelect
                      options={suppliers.map(s => ({ value: s.id, label: s.email ? `${s.name} (${s.email})` : s.name }))}
                      value={formSupplierId}
                      onChange={(val) => handleSupplierChange(val)}
                      placeholder="Choose Supplier..."
                    />
                  </div>

                  {/* Date fields */}
                  <div>
                    <label className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      2. Statement date / invoice Issue
                    </label>
                    <input
                      type="date"
                      value={formInvoiceDate}
                      onChange={(e) => setFormInvoiceDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Available GRs checkboxes */}
                {formSupplierId && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2">
                    <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                      3. Check Goods Receipts to Invoice
                    </span>
                    {availableGRsForSupplier.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No received cargo tickets requiring invoicing are open on file.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {availableGRsForSupplier.map((gr) => {
                          const isChecked = selectedGrIds.includes(gr.id);
                          return (
                            <label key={gr.id} className={`flex items-start gap-2.5 p-2 bg-white rounded border cursor-pointer transition-colors shadow-3xs ${
                              isChecked ? 'border-blue-600 bg-blue-50/20' : 'border-slate-200 hover:bg-slate-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleGrCheckboxToggle(gr.id)}
                                className="mt-0.5 border-slate-300 rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 font-mono">[{gr.grNumber}]</span>
                                <div className="text-[9px] text-slate-500 font-sans mt-0.5 leading-normal">
                                  Items Count: {gr.items.length} | Arrived: {new Date(gr.receiptDate).toLocaleDateString()}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Due Date */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Statement Due Date Limit
                    </label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Billing posting ledger
                    </label>
                    <SearchableSelect
                      options={[
                        { value: 'Draft', label: 'Draft (Hold)' },
                        { value: 'Unpaid', label: 'Unpaid (Accounts Payable post)' },
                        { value: 'Paid', label: 'Paid (Reconciled settled)' }
                      ]}
                      value={formStatus}
                      onChange={(val) => setFormStatus(val)}
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    special ledger billing info
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="Wire details, payment terms, or reference numbers..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs"
                  />
                </div>

                {/* Consolidated Goods Receipts Items Table */}
                {selectedGrIds.length > 0 && formLines.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono flex items-center justify-between">
                      <span>4. Items Invoicing Manifest</span>
                      <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded uppercase font-mono">{formLines.length} consolidated items</span>
                    </h4>

                    <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto">
                      <table className="w-full text-left min-w-[650px]">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-extrabold text-slate-400 font-mono border-b border-slate-200 uppercase">
                            <th className="py-2.5 px-3">Catalog SKU / DETAILS</th>
                            <th className="py-2.5 px-3">Source Receipt</th>
                            <th className="py-2.5 px-3 text-center">arrived count</th>
                            <th className="py-2.5 px-3 text-center bg-blue-50/30 text-slate-800 font-extrabold">Invoice Quantity</th>
                            <th className="py-2.5 px-3 text-right bg-blue-50/30 text-slate-800 font-extrabold">Unit Price</th>
                            <th className="py-2.5 px-3 text-right font-bold">Line Sum</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 divide-slate-200 text-xs text-slate-705">
                          {formLines.map((row, idx) => {
                            const allowedInput = row.receivedQty - row.previouslyInvoicedQty;
                            const isExceeding = row.quantity > allowedInput;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/45">
                                <td className="py-3 px-3 pointer-events-none select-none">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">
                                    {row.itemCode}
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{row.itemName}</div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 border rounded">
                                    {row.sourceGrNumber}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono text-slate-500">{row.receivedQty}</td>

                                <td className="py-3 px-3 text-center bg-blue-50/10">
                                  <input
                                    type="number"
                                    value={row.quantity === 0 ? '0' : row.quantity}
                                    onChange={(e) => handleLineValueChange(idx, 'quantity', e.target.value)}
                                    className={`w-16 bg-white border px-1.5 py-1 rounded text-xs text-center font-mono font-bold ${
                                      isExceeding ? 'border-rose-450 text-rose-600 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'
                                    }`}
                                  />
                                  {isExceeding && (
                                    <span className="text-[8px] text-rose-600 block mt-1 font-mono uppercase font-black">
                                      Exceeds Receipt!
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right bg-blue-50/10 relative">
                                  <input
                                    type="number"
                                    value={row.price === 0 ? '0' : row.price}
                                    onChange={(e) => handleLineValueChange(idx, 'price', e.target.value)}
                                    className="w-20 bg-white border px-1.5 py-1 border-slate-300 rounded text-xs text-right font-mono font-bold focus:border-blue-500"
                                  />
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 select-none">
                                  ${(row.quantity * row.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between font-mono">
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase font-sans">BILLING VALUE</span>
                <span className="text-xl font-bold text-slate-900">${computeFormTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded shadow-sm flex items-center gap-1.5 uppercase font-mono tracking-wider"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>POST CREDIT INVOICE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Spectra popup */}
      {isDetailOpen && selectedPI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded shadow-2xl overflow-hidden border border-slate-105 flex flex-col justify-between max-h-[90vh]">
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[9px] text-slate-400 font-mono block">PURCHASE BILL AUDIT RECON</span>
                  <h3 className="text-sm font-extrabold text-slate-950 font-sans tracking-tight uppercase">
                    {selectedPI.piNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded border font-mono text-[11px] leading-relaxed">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">SUPPLIER CREDITOR</span>
                  <span className="text-slate-900 font-bold">{selectedPI.supplierName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Invoice dates</span>
                  <span className="text-slate-700 font-medium">Issue: {new Date(selectedPI.invoiceDate).toLocaleDateString()} | Due: {new Date(selectedPI.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="sm:col-span-2 border-t border-slate-200/50 pt-2.5 mt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">consolidated GR references</span>
                  <span className="text-blue-700 font-bold max-w-sm block break-all font-mono leading-normal">{selectedPI.poNumber || 'Direct Purchase'}</span>
                </div>
              </div>

              {selectedPI.remarks && (
                <div className="p-3 bg-slate-50 border rounded text-xs leading-normal">
                  <span className="font-bold text-slate-400 block text-[9px] uppercase font-mono">Remarks / wires</span>
                  <p className="text-slate-600 italic mt-0.5">&ldquo;{selectedPI.remarks}&rdquo;</p>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">Reconciled lines</h4>
                <div className="border border-slate-205 rounded overflow-hidden shadow-3xs overflow-x-auto font-sans">
                  <table className="w-full text-left min-w-[550px]">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 font-mono uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">SKU / ITEM DESCRIPTION</th>
                        <th className="py-2.5 px-3 uppercase">source receipt</th>
                        <th className="py-2.5 px-3 text-center">QUANTITY</th>
                        <th className="py-2.5 px-3 text-right">UNIT PRICE</th>
                        <th className="py-2.5 px-3 text-right">LINE TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-705">
                      {selectedPI.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-950 bg-slate-100 p-0.5 rounded px-1.5 mr-1.5">{it.itemCode}</span>
                            <span>{it.itemName}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] bg-slate-50 text-slate-700 px-1 px-1.5 border rounded">
                              {it.sourceGrNumber || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{it.quantity}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">${it.price.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-950">${it.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-[10px]">
              <div>
                <span className="text-[9px] text-slate-400 font-sans block uppercase font-bold">INVOICE VALUE TALLY</span>
                <span className="text-xl font-bold text-slate-900">${selectedPI.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex items-center gap-1.5 font-bold font-mono">
                {selectedPI.status === 'Draft' && (
                  <button
                    onClick={() => handleToggleStatus(selectedPI.id, 'Unpaid')}
                    className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
                  >
                    POST PAYABLE
                  </button>
                )}

                {selectedPI.status === 'Unpaid' && (
                  <button
                    onClick={() => handleToggleStatus(selectedPI.id, 'Paid')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 hover:bg-opacity-90 text-white rounded flex items-center gap-1 uppercase tracking-wide"
                  >
                    <Check className="h-4 w-4" />
                    <span>SET AS SETTLED</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-250 rounded text-slate-70"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
