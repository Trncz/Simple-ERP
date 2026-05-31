/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SalesOrder, Customer, Item, PaginatedResponse, SalesOrderItem } from '../types';
import { Search, Plus, Eye, Edit, Trash2, ArrowLeft, ArrowRight, X, Check, FileDown, Layers } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface SalesOrderModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
  onNavigateToDO?: (soId: string) => void;
  onNavigateToSI?: (soId: string) => void;
}

export default function SalesOrderModule({
  authToken,
  showToast,
  onNavigateToDO,
  onNavigateToSI
}: SalesOrderModuleProps) {
  const [sosData, setSosData] = useState<PaginatedResponse<SalesOrder> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Reference elements populated on init
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Trigger doors
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);

  // Unified form elements
  const [editingSO, setEditingSO] = useState<SalesOrder | null>(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formOrderDate, setFormOrderDate] = useState(new Date().toISOString().substring(0, 10));
  const [formDeliveryDate, setFormDeliveryDate] = useState(new Date().toISOString().substring(0, 10));
  const [formRemarks, setFormRemarks] = useState('');
  const [formLines, setFormLines] = useState<{ itemId: string; quantity: number; unitPrice: number }[]>([
    { itemId: '', quantity: 1, unitPrice: 0 }
  ]);
  const [formError, setFormError] = useState('');

  const fetchSOs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const response = await fetch(`/api/sales-orders?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Failed to query sales orders');
      const data = await response.json();
      setSosData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling client sales logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferences = async () => {
    try {
      const [custRes, itemsRes] = await Promise.all([
        fetch('/api/customers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/items?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const cData = await custRes.json();
      const iData = await itemsRes.json();
      setCustomers(cData.data || []);
      setItems(iData.data || []);
    } catch (error) {
      console.error('Error fetching SO reference elements:', error);
    }
  };

  useEffect(() => {
    fetchSOs();
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchReferences();
  }, []);

  // Form lines event
  const handleAddRow = () => {
    setFormLines([...formLines, { itemId: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveRow = (idx: number) => {
    if (formLines.length === 1) return;
    setFormLines(formLines.filter((_, i) => i !== idx));
  };

  const handleRowChange = (idx: number, field: 'itemId' | 'quantity' | 'unitPrice', val: any) => {
    const updated = [...formLines];
    if (field === 'itemId') {
      updated[idx].itemId = val;
      const match = items.find(i => i.id === val);
      if (match) {
        updated[idx].unitPrice = match.defaultPrice;
      }
    } else if (field === 'quantity') {
      updated[idx].quantity = Math.max(0, Number(val) || 0);
    } else {
      updated[idx].unitPrice = Math.max(0, Number(val) || 0);
    }
    setFormLines(updated);
  };

  const computeFormTotal = () => {
    return formLines.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  };

  const handleOpenForm = (so: SalesOrder | null = null) => {
    if (so) {
      setEditingSO(so);
      setFormCustomerId(so.customerId);
      setFormOrderDate(so.orderDate.substring(0, 10));
      setFormDeliveryDate(so.deliveryDate.substring(0, 10));
      setFormRemarks(so.remarks || '');
      setFormLines(so.items.map(it => ({
        itemId: it.itemId,
        quantity: it.quantity,
        unitPrice: it.unitPrice
      })));
    } else {
      setEditingSO(null);
      setFormCustomerId(customers[0]?.id || '');
      setFormOrderDate(new Date().toISOString().substring(0, 10));
      setFormDeliveryDate(new Date().toISOString().substring(0, 10));
      setFormRemarks('');
      setFormLines([{ itemId: items[0]?.id || '', quantity: 5, unitPrice: items[0]?.defaultPrice || 0 }]);
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveSO = async (e: any, statusParam: 'Draft' | 'Submitted' = 'Draft') => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formCustomerId) {
      setFormError('Customer profile must be chosen.');
      return;
    }
    const invalid = formLines.some(f => !f.itemId || f.quantity <= 0);
    if (invalid) {
      setFormError('Check lines: make sure catalog items are chosen and quantities exceed 0.');
      return;
    }

    try {
      const url = editingSO ? `/api/sales-orders/${editingSO.id}` : '/api/sales-orders';
      const method = editingSO ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          customerId: formCustomerId,
          orderDate: formOrderDate,
          deliveryDate: formDeliveryDate,
          remarks: formRemarks,
          status: statusParam,
          items: formLines
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected sales order payload');

      showToast(`Sales Order ${editingSO ? 'edited' : 'created'} with status [${statusParam}] successfully.`, 'success');
      setIsFormOpen(false);
      fetchSOs();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save Sales Order.');
    }
  };

  const handleSubmitSO = async (id: string, soNum: string) => {
    try {
      const res = await fetch(`/api/sales-orders/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Command rejected.');
      showToast(`Sales Order ${soNum} committed to backlog! Ready for fulfillment.`, 'success');
      fetchSOs();
      if (isDetailOpen && selectedSO?.id === id) {
        setIsDetailOpen(false);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error occurred during submission.', 'error');
    }
  };

  const handleDeleteSO = async (id: string, soNum: string) => {
    try {
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Command rejected.');
      showToast(`SO ${soNum} removed from system.`, 'success');
      fetchSOs();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete Sales Order.', 'error');
    }
  };

  const handleOpenDetail = (so: SalesOrder) => {
    setSelectedSO(so);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 font-sans">Customer Sales Orders</h2>
          <p className="text-xs text-slate-500 mt-1">
            Build outward sales commitments, track backlog fulfillment metrics, and manage customer credit entries.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold self-start shadow-xs transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>COMPILE SALES COMMITTAL</span>
        </button>
      </div>

      {/* Backlog selectors */}
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
            placeholder="Search SO numbers, customer buyers..."
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
          />
        </div>

        <SearchableSelect
          options={[
            { value: '', label: 'All Backlog States' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Submitted', label: 'Submitted (Active Backlog)' },
            { value: 'Completed', label: 'Completed (Dispatched)' }
          ]}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          className="w-48 text-slate-600 font-semibold"
        />
      </div>

      {/* Roster Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">So Number</th>
                <th className="py-3 px-5">Customer Account</th>
                <th className="py-3 px-5">Order Date</th>
                <th className="py-3 px-5">Target Dispatch</th>
                <th className="py-3 px-10 text-right">Selling Total</th>
                <th className="py-3 px-5 text-center">Fulfillment</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-750">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Loading customer accounts...
                  </td>
                </tr>
              ) : !sosData || sosData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-slate-400">
                    No matching Sales Orders on file. Start a dispatch by choosing &quot;Compile Sales Committal&quot;.
                  </td>
                </tr>
              ) : (
                sosData.data.map((so) => (
                  <tr key={so.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {so.soNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-800">{so.customerName}</td>
                    <td className="py-3.5 px-5 text-slate-500 font-mono">
                      {new Date(so.orderDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-slate-505 font-mono">
                      {new Date(so.deliveryDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-10 text-right font-bold text-slate-900 font-mono">
                      ${so.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          so.status === 'Draft'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : so.status === 'Submitted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}
                      >
                        {so.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenDetail(so)}
                          className="p-1 px-2 hover:bg-slate-100 text-slate-600 font-bold font-mono rounded"
                        >
                          SPECTRUM
                        </button>

                        {so.status === 'Draft' && (
                          <>
                            <button
                              onClick={() => handleOpenForm(so)}
                              className="p-1 px-1.5 hover:bg-slate-100 text-slate-500 font-bold font-mono rounded"
                            >
                              EDT
                            </button>
                            <button
                              onClick={() => handleSubmitSO(so.id, so.soNumber)}
                              className="p-1 px-1.5 hover:bg-emerald-100 text-emerald-600 font-bold font-mono rounded flex items-center gap-0.5"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>POST</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSO(so.id, so.soNumber)}
                              className="p-1 px-1 hover:bg-rose-50 rounded text-rose-500 hover:text-rose-700 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}

                        {(so.status === 'Submitted' || so.status === 'Partial') && onNavigateToDO && (
                          <button
                            onClick={() => onNavigateToDO(so.id)}
                            className="p-1 px-1.5 rounded-md hover:bg-teal-100 text-teal-600 hover:text-teal-800 text-[10px] font-bold flex items-center gap-0.5 font-mono"
                            title="Create Delivery Order (Dispatch)"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            <span>SHIP</span>
                          </button>
                        )}

                        {so.status === 'Completed' && onNavigateToSI && (
                          <button
                            onClick={() => onNavigateToSI(so.id)}
                            className="p-1 px-1.5 rounded-md hover:bg-sky-100 text-sky-600 hover:text-sky-800 text-[10px] font-bold flex items-center gap-0.5 font-mono"
                            title="Create Sales Invoice (Bill)"
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

        {/* Pagination */}
        {sosData && sosData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50 font-mono text-[10px]">
            <span>PAGE {sosData.page} OF {sosData.pages} ({sosData.total} TOTAL)</span>
            <div className="flex gap-1.5">
              <button
                disabled={sosData.page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="bg-white px-2 py-1.5 border hover:border-slate-300 rounded text-slate-700 font-bold"
              >
                PREV
              </button>
              <button
                disabled={sosData.page >= sosData.pages}
                onClick={() => setPage(p => p + 1)}
                className="bg-white px-2 py-1.5 border hover:border-slate-300 rounded text-slate-705 font-bold"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Editor */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-2xl h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8 animate-slide-in">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-950 font-sans tracking-tight uppercase">
                  {editingSO ? `Edit SO Terminal: ${editingSO.soNumber}` : 'Draft Customer Outbound Committal'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="rounded-md bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600 font-mono">
                  {formError}
                </div>
              )}

              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Customer Selector */}
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Customer Buyer Account
                    </label>
                    <SearchableSelect
                      options={customers.map(c => ({ value: c.id, label: c.name }))}
                      value={formCustomerId}
                      onChange={(val) => setFormCustomerId(val)}
                      placeholder="Select Customer Buyer..."
                    />
                  </div>

                  {/* Order date */}
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Agreement Date
                    </label>
                    <input
                      type="date"
                      value={formOrderDate}
                      onChange={(e) => setFormOrderDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 font-mono"
                    />
                  </div>

                  {/* Target Deliver */}
                  <div>
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Target Dispatch Date
                    </label>
                    <input
                      type="date"
                      value={formDeliveryDate}
                      onChange={(e) => setFormDeliveryDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Special Cargo loading guidelines / loading terms
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="Enter truck details, shipping constraints..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-lg text-xs"
                  />
                </div>

                {/* Lines */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">Sales Lines</h4>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      + ADD LINE
                    </button>
                  </div>

                  <div className="space-y-2 overflow-visible pb-16 pr-1">
                    {formLines.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1 min-w-[180px]">
                          <SearchableSelect
                            options={items.map(i => ({ value: i.id, label: `[${i.code}] ${i.name}` }))}
                            value={row.itemId}
                            onChange={(val) => handleRowChange(idx, 'itemId', val)}
                            placeholder="Select Catalog Item..."
                          />
                        </div>

                        <div className="w-20">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={row.quantity || ''}
                            onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-center"
                          />
                        </div>

                        <div className="w-24 relative">
                          <span className="absolute left-2.5 top-2.5 text-slate-400 text-[11px] font-mono">$</span>
                          <input
                            type="number"
                            placeholder="Price"
                            value={row.unitPrice || ''}
                            onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 pl-5 pr-1.5 py-2 rounded-lg text-xs font-mono text-right"
                          />
                        </div>

                        <div className="w-24 text-right font-mono text-xs font-semibold text-slate-700 select-none pr-1.5">
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

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between font-mono pb-4">
              <div className="text-left font-sans">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Sales Agreement valuation</span>
                <span className="text-lg font-bold text-slate-900 font-mono">${computeFormTotal().toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveSO(e, 'Draft')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg"
                >
                  SAVE DRAFT
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveSO(e, 'Submitted')}
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-lg shadow-sm"
                >
                  SAVE & POST
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details spectrum panel */}
      {isDetailOpen && selectedSO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col justify-between max-h-[90vh]">
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[9px] text-slate-400 font-mono block">SALES BACKLOG COMMITTAL METRICS</span>
                  <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight uppercase">
                    {selectedSO.soNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg font-mono text-[11px] leading-relaxed">
                <div className="col-span-2">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">CUSTOMER BUYER</span>
                  <span className="text-slate-900 font-bold">{selectedSO.customerName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">AGREEMENT DATE</span>
                  <span className="text-slate-705">{new Date(selectedSO.orderDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">DISPATCH DATE</span>
                  <span className="text-slate-705">{new Date(selectedSO.deliveryDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg pt-0 text-[11px] font-mono leading-normal">
                <span className="text-[9px] text-slate-400 font-bold block uppercase">BACKLOG STATE</span>
                <span className={`inline-block px-1.5 text-[10px] font-bold rounded ${
                  selectedSO.status === 'Draft' ? 'bg-amber-100 text-amber-800' : selectedSO.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {selectedSO.status}
                </span>
              </div>

              {selectedSO.remarks && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs leading-normal">
                  <span className="font-bold text-slate-400 block text-[9px] uppercase font-mono">Remarks</span>
                  <p className="text-slate-600 italic">&ldquo;{selectedSO.remarks}&rdquo;</p>
                </div>
              )}

              {/* Items listing */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">backlog allocation</h4>
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 font-mono uppercase border-b border-slate-100">
                        <th className="py-2.5 px-3">SKU / ITEM DESCRIPTION</th>
                        <th className="py-2.5 px-3 text-center">QUANTITY</th>
                        <th className="py-2.5 px-3 text-right">DISPATCH PRICE</th>
                        <th className="py-2.5 px-3 text-right">LINE SUB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedSO.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-950 bg-slate-100 p-0.5 rounded px-1.5 mr-1.5">{it.itemCode}</span>
                            <span>{it.itemName}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{it.quantity}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500">${it.unitPrice.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">${it.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-[10px]">
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase font-sans">AGREED VALUATION</span>
                <span className="text-xl font-bold text-slate-900 font-mono">${selectedSO.totalAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-1.5 font-bold">
                {selectedSO.status === 'Draft' && (
                  <button
                    onClick={() => handleSubmitSO(selectedSO.id, selectedSO.soNumber)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                  >
                    SUBMIT BACKLOG
                  </button>
                )}

                {selectedSO.status === 'Submitted' && onNavigateToDO && (
                  <button
                    onClick={() => {
                      setIsDetailOpen(false);
                      onNavigateToDO(selectedSO.id);
                    }}
                    className="px-4 py-2 bg-slate-950 text-teal-400 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Layers className="h-4 w-4" />
                    <span>LAUNCH DELIVERY DISPATCH</span>
                  </button>
                )}

                {selectedSO.status === 'Completed' && onNavigateToSI && (
                  <button
                    onClick={() => {
                      setIsDetailOpen(false);
                      onNavigateToSI(selectedSO.id);
                    }}
                    className="px-4 py-2 bg-slate-950 text-sky-450 text-sky-400 border border-slate-800 rounded-lg flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>LAUNCH SALES BILL</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-white border rounded text-slate-700 hover:border-slate-400"
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
