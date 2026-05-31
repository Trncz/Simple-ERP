/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { PurchaseOrder, Supplier, Item, PaginatedResponse, PurchaseOrderItem } from '../types';
import { Search, Plus, Eye, Edit, Trash2, ArrowLeft, ArrowRight, X, Check, FileDown, Layers } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface PurchaseOrderModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
  onNavigateToGR?: (poId: string) => void;
  onNavigateToPI?: (poId: string) => void;
}

export default function PurchaseOrderModule({
  authToken,
  showToast,
  onNavigateToGR,
  onNavigateToPI
}: PurchaseOrderModuleProps) {
  const [posData, setPosData] = useState<PaginatedResponse<PurchaseOrder> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Master options populated for forms
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Form & Viewer layout triggers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Core Form states
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formOrderDate, setFormOrderDate] = useState(new Date().toISOString().substring(0, 10));
  const [formExpectedDate, setFormExpectedDate] = useState(new Date().toISOString().substring(0, 10));
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState<{ itemId: string; quantity: number; unitPrice: number }[]>([
    { itemId: '', quantity: 1, unitPrice: 0 }
  ]);
  const [formError, setFormError] = useState('');

  // Fetch PO List
  const fetchPOs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const response = await fetch(`/api/purchase-orders?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Failed to query purchase orders');
      const data = await response.json();
      setPosData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling procurement records', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch references
  const fetchReferences = async () => {
    try {
      const [suppRes, itemsRes] = await Promise.all([
        fetch('/api/suppliers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/items?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const suppData = await suppRes.json();
      const itemsData = await itemsRes.json();
      setSuppliers(suppData.data || []);
      setItems(itemsData.data || []);
    } catch (error) {
      console.error('Error fetching PO reference master options:', error);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchReferences();
  }, []);

  // Form row events
  const handleAddRow = () => {
    setFormItems([...formItems, { itemId: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleRowChange = (idx: number, field: 'itemId' | 'quantity' | 'unitPrice', val: any) => {
    const updated = [...formItems];
    if (field === 'itemId') {
      updated[idx].itemId = val;
      // Propagate default cost from item master
      const match = items.find(i => i.id === val);
      if (match) {
        updated[idx].unitPrice = match.defaultCost;
      }
    } else if (field === 'quantity') {
      updated[idx].quantity = Math.max(0, Number(val) || 0);
    } else {
      updated[idx].unitPrice = Math.max(0, Number(val) || 0);
    }
    setFormItems(updated);
  };

  // Compute live drawing totals
  const computeFormTotal = () => {
    return formItems.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  };

  const handleOpenForm = (po: PurchaseOrder | null = null) => {
    if (po) {
      setEditingPO(po);
      setFormSupplierId(po.supplierId);
      setFormOrderDate(po.orderDate.substring(0, 10));
      setFormExpectedDate(po.expectedDate.substring(0, 10));
      setFormRemarks(po.remarks || '');
      setFormItems(po.items.map(it => ({
        itemId: it.itemId,
        quantity: it.quantity,
        unitPrice: it.unitPrice
      })));
    } else {
      setEditingPO(null);
      setFormSupplierId(suppliers[0]?.id || '');
      setFormOrderDate(new Date().toISOString().substring(0, 10));
      setFormExpectedDate(new Date().toISOString().substring(0, 10));
      setFormRemarks('');
      setFormItems([{ itemId: items[0]?.id || '', quantity: 10, unitPrice: items[0]?.defaultCost || 0 }]);
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenDetail = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsDetailOpen(true);
  };

  const handleSavePO = async (e: any, statusParam: 'Draft' | 'Submitted' = 'Draft') => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formSupplierId) {
      setFormError('Supplier account must be selected.');
      return;
    }
    const invalidRow = formItems.some(f => !f.itemId || f.quantity <= 0);
    if (invalidRow) {
      setFormError('Check lines: items must be selected and quantities must exceed 0.');
      return;
    }

    try {
      const url = editingPO ? `/api/purchase-orders/${editingPO.id}` : '/api/purchase-orders';
      const method = editingPO ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          supplierId: formSupplierId,
          orderDate: formOrderDate,
          expectedDate: formExpectedDate,
          remarks: formRemarks,
          status: statusParam,
          items: formItems
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected order compilation');

      showToast(`PO ${editingPO ? 'edited' : 'created'} with status [${statusParam}] successfully.`, 'success');
      setIsFormOpen(false);
      fetchPOs();
    } catch (err: any) {
      setFormError(err?.message || 'Handshake failed during order save.');
    }
  };

  const handleSubmitPO = async (id: string, poNum: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Submission command rejected.');
      showToast(`Purchase Order ${poNum} successfully committed to Active queue!`, 'success');
      fetchPOs();
      if (isDetailOpen && selectedPO?.id === id) {
        setIsDetailOpen(false);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error executing submit operation.', 'error');
    }
  };

  const handleDeletePO = async (id: string, poNum: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Command rejected.');
      showToast(`PO ${poNum} deleted.`, 'success');
      fetchPOs();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete PO.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 font-sans">Purchase Order Receipts</h2>
          <p className="text-xs text-slate-500 mt-1">
            Build, review, and issue inbound resource requisitions and track fulfillment logs.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold self-start shadow-xs transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>CREATE DRAFT ORDER</span>
        </button>
      </div>

      {/* Roster Toolbar */}
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
            placeholder="Search PO numbers, supplier accounts..."
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
          />
        </div>

        <SearchableSelect
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Submitted', label: 'Submitted (Active)' },
            { value: 'Completed', label: 'Completed (Fulfilled)' }
          ]}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          className="w-48 text-slate-600 font-semibold"
        />
      </div>

      {/* Roster Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Po Number</th>
                <th className="py-3 px-5">Vendor Account</th>
                <th className="py-3 px-5">Date Drafted</th>
                <th className="py-3 px-5">Target Shipment</th>
                <th className="py-3 px-5 text-right">Order Valuation</th>
                <th className="py-3 px-5 text-center">Receipt Status</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Loading procurement logs...
                  </td>
                </tr>
              ) : !posData || posData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-slate-400">
                    No matching Purchase Orders on file. Click &quot;Create Draft Order&quot; to prompt.
                  </td>
                </tr>
              ) : (
                posData.data.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {po.poNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="text-xs font-semibold text-slate-800">{po.supplierName}</div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-500 font-mono">
                      {new Date(po.orderDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-500 font-mono">
                      {new Date(po.expectedDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-900 text-right font-mono font-semibold">
                      ${po.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          po.status === 'Draft'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : po.status === 'Submitted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(po)}
                          className="p-1 px-2 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[10px] font-semibold flex items-center gap-1 font-mono transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>SPECTRUM</span>
                        </button>

                        {po.status === 'Draft' && (
                          <>
                            <button
                              onClick={() => handleOpenForm(po)}
                              className="p-1 px-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-950 text-[10px] font-semibold flex items-center gap-0.5 font-mono"
                            >
                              <Edit className="h-3 w-3" />
                              <span>EDT</span>
                            </button>
                            <button
                              onClick={() => handleSubmitPO(po.id, po.poNumber)}
                              className="p-1 px-1.5 rounded-md hover:bg-emerald-100 hover:text-emerald-800 text-emerald-600 text-[10px] font-bold flex items-center gap-0.5 font-mono"
                            >
                              <Check className="h-3 w-3" />
                              <span>SUBMIT</span>
                            </button>
                            <button
                              onClick={() => handleDeletePO(po.id, po.poNumber)}
                              className="p-1 px-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}

                        {(po.status === 'Submitted' || po.status === 'Partial') && onNavigateToGR && (
                          <button
                            onClick={() => onNavigateToGR(po.id)}
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-teal-50 text-teal-650 font-bold text-[10px] flex items-center gap-0.5 font-mono transition-colors"
                            title="Receive cargo deliverables"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            <span>RCV</span>
                          </button>
                        )}

                        {po.status === 'Completed' && onNavigateToPI && (
                          <button
                            onClick={() => onNavigateToPI(po.id)}
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-sky-50 text-sky-650 font-bold text-[10px] flex items-center gap-0.5 font-mono transition-colors"
                            title="Reconcile and bill supplier invoice"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            <span>BILL</span>
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

        {/* Paginated Footer */}
        {posData && posData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50">
            <span className="text-[10px] text-slate-500 font-mono">
              PAGE {posData.page} OF {posData.pages} ({posData.total} TOTAL)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={posData.page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2 text-[10px] font-mono font-bold bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>PREV</span>
              </button>
              <button
                disabled={posData.page >= posData.pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 px-2 text-[10px] font-mono font-bold bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <span>NEXT</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-2xl h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-950 font-sans tracking-tight uppercase">
                  {editingPO ? `EDIT PO TERMINAL: ${editingPO.poNumber}` : 'COMPILE DRAFT ORDER RESOURCE REQUISITION'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="rounded-md bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-mono">
                  {formError}
                </div>
              )}

              <form className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Supplier / Vendor Match
                    </label>
                    <SearchableSelect
                      options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                      value={formSupplierId}
                      onChange={(val) => setFormSupplierId(val)}
                      placeholder="Select Vendor..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Requisition Date
                    </label>
                    <input
                      type="date"
                      value={formOrderDate}
                      onChange={(e) => setFormOrderDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Target Delivery Receipt
                    </label>
                    <input
                      type="date"
                      value={formExpectedDate}
                      onChange={(e) => setFormExpectedDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Special Cargo / loading remarks
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="Enter special gate indicators, shipping instructions..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                {/* Items grid rows */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                      Item Purchase Lines
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      + ADD LINE
                    </button>
                  </div>

                  <div className="space-y-2 overflow-visible pb-16 pr-1">
                    {formItems.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1 min-w-[180px]">
                          <SearchableSelect
                            options={items.map(i => ({ value: i.id, label: `[${i.code}] ${i.name}` }))}
                            value={row.itemId}
                            onChange={(val) => handleRowChange(idx, 'itemId', val)}
                            placeholder="Select Catalog Item..."
                          />
                        </div>

                        <div className="w-24">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={row.quantity || ''}
                            onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono text-center"
                          />
                        </div>

                        <div className="w-28 relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-[11px] font-mono">$</span>
                          <input
                            type="number"
                            placeholder="Cost"
                            value={row.unitPrice || ''}
                            onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 pl-6 pr-2 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono text-right"
                          />
                        </div>

                        <div className="w-28 text-right font-mono text-xs font-semibold text-slate-700 select-none pr-1">
                          ${(row.quantity * row.unitPrice || 0).toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 px-2.5 hover:bg-rose-50 rounded text-rose-500 hover:text-rose-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-5 border-t border-slate-100 flex items-center justify-between pb-4">
              <div className="text-left font-sans">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Order Valuation Summary</span>
                <span className="text-lg font-bold text-slate-900 font-mono">${computeFormTotal().toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg font-mono"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSavePO(e, 'Draft')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <span>{editingPO ? 'UPDATE DRAFT' : 'SAVE DRAFT'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSavePO(e, 'Submitted')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>SAVE & POST</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Spectrum Modal */}
      {isDetailOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col justify-between max-h-[90vh]">
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[9px] text-slate-400 font-mono block">PURCHASE ORDER METRICS</span>
                  <h3 className="text-sm font-bold text-slate-950 font-sans tracking-tight uppercase flex items-center gap-2">
                    <span>{selectedPO.poNumber}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Master reference nodes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-lg font-mono text-[11px] leading-relaxed">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">SUPPLIER</span>
                  <span className="text-slate-900 font-bold">{selectedPO.supplierName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">ORDER DATE</span>
                  <span className="text-slate-700">{new Date(selectedPO.orderDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">EXPECTED REC</span>
                  <span className="text-slate-700">{new Date(selectedPO.expectedDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">STATUS PILL</span>
                  <span className={`inline-block px-2 text-[10px] font-bold rounded ${
                    selectedPO.status === 'Draft' ? 'bg-amber-100 text-amber-800' : selectedPO.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedPO.status}
                  </span>
                </div>
              </div>

              {selectedPO.remarks && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs leading-normal">
                  <span className="font-bold text-slate-400 block text-[9px] uppercase font-mono mb-1">Remarks</span>
                  <p className="text-slate-600 italic">&ldquo;{selectedPO.remarks}&rdquo;</p>
                </div>
              )}

              {/* Item Lines Display */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">Items roster</h4>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase font-mono border-b border-slate-100">
                        <th className="py-2.5 px-4">SKU / DESCRIPTION</th>
                        <th className="py-2.5 px-4 text-center">QUANTITY</th>
                        <th className="py-2.5 px-4 text-right">UNIT COST</th>
                        <th className="py-2.5 px-4 text-right">TOTAL NET</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedPO.items.map((it, index) => (
                        <tr key={index} className="hover:bg-slate-50/20 font-sans">
                          <td className="py-3 px-4 font-normal text-slate-800">
                            <span className="font-mono font-bold text-slate-950 bg-slate-100 p-0.5 rounded px-1 mr-1.5">{it.itemCode}</span>
                            <span>{it.itemName}</span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600 font-mono">{it.quantity}</td>
                          <td className="py-3 px-4 text-right text-slate-600 font-mono">${it.unitPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-slate-950 font-semibold font-mono">${it.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Actions Footer details */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="font-sans">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Order Valuation</span>
                <span className="text-xl font-bold text-slate-900 font-mono">${selectedPO.totalAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
                {selectedPO.status === 'Draft' && (
                  <button
                    onClick={() => handleSubmitPO(selectedPO.id, selectedPO.poNumber)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 font-bold tracking-wide transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>SUBMIT ACTIVE</span>
                  </button>
                )}

                {selectedPO.status === 'Submitted' && onNavigateToGR && (
                  <button
                    onClick={() => {
                      setIsDetailOpen(false);
                      onNavigateToGR(selectedPO.id);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-teal-400 hover:text-teal-300 border border-slate-800 rounded-lg flex items-center gap-1"
                  >
                    <Layers className="h-4 w-4" />
                    <span>LAUNCH GOODS RECEIPT</span>
                  </button>
                )}

                {selectedPO.status === 'Completed' && onNavigateToPI && (
                  <button
                    onClick={() => {
                      setIsDetailOpen(false);
                      onNavigateToPI(selectedPO.id);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 rounded-lg flex items-center gap-1"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>LAUNCH PROCUREMENT BILL</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:border-slate-400"
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
