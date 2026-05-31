/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SalesInvoice, DeliveryOrder, Customer, Item, PaginatedResponse } from '../types';
import { Search, Plus, X, Check, CreditCard, Sparkles } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface SalesInvoiceModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
  autopopulateSoId?: string | null;
  resetAutopopulatedSoId?: () => void;
  autopopulateDoId?: string | null;
  resetAutopopulatedDoId?: () => void;
}

export default function SalesInvoiceModule({
  authToken,
  showToast,
  autopopulateSoId,
  resetAutopopulatedSoId,
  autopopulateDoId,
  resetAutopopulatedDoId
}: SalesInvoiceModuleProps) {
  const [sisData, setSisData] = useState<PaginatedResponse<SalesInvoice> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // References
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Toggle flags
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSI, setSelectedSI] = useState<SalesInvoice | null>(null);

  // Form elements
  const [formCustomerId, setFormCustomerId] = useState('');
  const [selectedDoIds, setSelectedDoIds] = useState<string[]>([]);
  const [formInvoiceDate, setFormInvoiceDate] = useState(new Date().toISOString().substring(0, 10));
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().substring(0, 10));
  const [formStatus, setFormStatus] = useState<string>('Unpaid');
  const [formRemarks, setFormRemarks] = useState('');

  // Consolidated lines
  const [formLines, setFormLines] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    deliveredQty: number; // reference dispatched qty
    previouslyInvoicedQty: number;
    quantity: number; // invoiced qty
    price: number;
    sourceDoId: string;
    sourceDoNumber: string;
    sourceDoItemId: string;
  }[]>([]);
  const [formError, setFormError] = useState('');
  const [referencesLoaded, setReferencesLoaded] = useState(false);

  const fetchSIs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const response = await fetch(`/api/sales-invoices?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Could not pull sales invoices');
      const data = await response.json();
      setSisData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling client billing ledgers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferences = async () => {
    try {
      const [custRes, doRes, itemsRes] = await Promise.all([
        fetch('/api/customers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/delivery-orders?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/items?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const cData = await custRes.json();
      const dData = await doRes.json();
      const iData = await itemsRes.json();

      setCustomers(cData.data || []);
      setDeliveryOrders(dData.data || []);
      setItems(iData.data || []);
      setReferencesLoaded(true);
    } catch (err) {
      console.error('Error fetching referential options:', err);
    }
  };

  useEffect(() => {
    fetchSIs();
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchReferences();
  }, []);

  // Monitor prefilled Sales Order trigger (fallback)
  useEffect(() => {
    if (autopopulateSoId && referencesLoaded) {
      const matchDo = deliveryOrders.find(d => d.soId === autopopulateSoId);
      if (matchDo) {
        setFormCustomerId(matchDo.customerId);
        setSelectedDoIds([matchDo.id]);
        loadItemsFromDOs(matchDo.customerId, [matchDo.id]);
        setIsFormOpen(true);
      } else {
        fetch(`/api/sales-orders/${autopopulateSoId}`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(res => res.json())
          .then((soObj) => {
            setFormCustomerId(soObj.customerId);
            setIsFormOpen(true);
          }).catch(console.error);
      }
      if (resetAutopopulatedSoId) resetAutopopulatedSoId();
    }
  }, [autopopulateSoId, referencesLoaded, deliveryOrders]);

  // Monitor prefilled Delivery Order trigger
  useEffect(() => {
    if (autopopulateDoId && referencesLoaded) {
      const matchDo = deliveryOrders.find(d => d.id === autopopulateDoId);
      if (matchDo) {
        setFormCustomerId(matchDo.customerId);
        setSelectedDoIds([matchDo.id]);
        loadItemsFromDOs(matchDo.customerId, [matchDo.id]);
        setIsFormOpen(true);
      }
      if (resetAutopopulatedDoId) resetAutopopulatedDoId();
    }
  }, [autopopulateDoId, referencesLoaded, deliveryOrders]);

  const loadItemsFromDOs = (customerId: string, doIds: string[], customDoPool?: DeliveryOrder[], customItemsPool?: Item[]) => {
    if (!customerId || doIds.length === 0) {
      setFormLines([]);
      return;
    }

    const lines: typeof formLines = [];
    const dPool = customDoPool || deliveryOrders;
    const iPool = customItemsPool || items;
    doIds.forEach(id => {
      const doObj = dPool.find(d => d.id === id);
      if (doObj) {
        doObj.items.forEach(it => {
          const previouslyInvoiced = it.invoicedQty || 0;
          const remaining = Math.max(0, it.deliveredQty - previouslyInvoiced);

          if (remaining > 0) {
            // Find default sell price
            const catalogItem = iPool.find(cat => cat.id === it.itemId);
            const defaultPrice = catalogItem ? catalogItem.defaultPrice : 0;

            lines.push({
              itemId: it.itemId,
              itemCode: it.itemCode || 'SKU',
              itemName: it.itemName || 'Cargo description',
              deliveredQty: it.deliveredQty,
              previouslyInvoicedQty: previouslyInvoiced,
              quantity: remaining, // default invoiced qty is remaining
              price: defaultPrice,
              sourceDoId: doObj.id,
              sourceDoNumber: doObj.doNumber,
              sourceDoItemId: it.id
            });
          }
        });
      }
    });
    setFormLines(lines);
  };

  const handleCustomerChange = (custId: string) => {
    setFormCustomerId(custId);
    setSelectedDoIds([]);
    setFormLines([]);
  };

  const handleDoCheckboxToggle = (doId: string) => {
    let updated: string[];
    if (selectedDoIds.includes(doId)) {
      updated = selectedDoIds.filter(id => id !== doId);
    } else {
      updated = [...selectedDoIds, doId];
    }
    setSelectedDoIds(updated);
    loadItemsFromDOs(formCustomerId, updated);
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
    if (!formCustomerId) {
      setFormError('Customer must be chosen.');
      return;
    }
    if (selectedDoIds.length === 0) {
      setFormError('At least one Delivery Order must be checked.');
      return;
    }
    const invalidLine = formLines.some(f => f.quantity <= 0 || f.price <= 0);
    if (invalidLine) {
      setFormError('Make sure invoice quantities and prices are greater than 0 on all items.');
      return;
    }

    // Verify over-invoicing constraints
    for (const row of formLines) {
      const allowed = row.deliveredQty - row.previouslyInvoicedQty;
      if (row.quantity > allowed) {
        setFormError(`Over-invoicing Alert: [${row.itemCode}] bills ${row.quantity} units against ${allowed} remaining in DO ${row.sourceDoNumber}.`);
        return;
      }
    }

    try {
      const response = await fetch('/api/sales-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          customerId: formCustomerId,
          invoiceDate: formInvoiceDate,
          dueDate: formDueDate,
          status: formStatus,
          remarks: formRemarks,
          items: formLines.map(l => ({
            itemId: l.itemId,
            quantity: l.quantity,
            price: l.price,
            sourceDoId: l.sourceDoId,
            sourceDoItemId: l.sourceDoItemId
          }))
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected invoice draft creation');

      showToast(`Sales Invoice [${resData.siNumber}] generated from ${selectedDoIds.length} dispatches.`, 'success');
      setIsFormOpen(false);
      fetchSIs();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save Customer Invoice.');
    }
  };

  const handleToggleStatus = async (id: string, newStat: string) => {
    try {
      const response = await fetch(`/api/sales-invoices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: newStat })
      });
      if (!response.ok) throw new Error('Status reconciler command rejected.');
      showToast('Receivables status successfully adjusted!', 'success');
      fetchSIs();
      if (isDetailOpen && selectedSI) {
        setSelectedSI({ ...selectedSI, status: newStat as any });
      }
    } catch (error: any) {
      showToast(error?.message || 'Failed to reconcile status.', 'error');
    }
  };

  const handleOpenDetail = (si: SalesInvoice) => {
    setSelectedSI(si);
    setIsDetailOpen(true);
  };

  const availableDOsForCustomer = deliveryOrders.filter(d => d.customerId === formCustomerId);

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Sales Invoices (Receivables)</h2>
          <p className="text-xs text-slate-505 text-slate-500 mt-1">
            Bill clients and manage statements of accounts by compiling consolidated logs against Delivery Orders.
          </p>
        </div>
        <button
          onClick={() => {
            fetchReferences();
            setFormCustomerId('');
            setSelectedDoIds([]);
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
          <span>INVOICE MULTI-DO DISPATCHES</span>
        </button>
      </div>

      {/* Toolbar Search / Filter */}
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
            placeholder="Search invoice numbers, customer names..."
            className="w-full bg-white border border-slate-205 pl-9 pr-4 py-2 rounded text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-450"
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

      {/* Grid Board data */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-3xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Invoice Reference</th>
                <th className="py-3 px-5">Customer Account</th>
                <th className="py-3 px-5">Source DO Numbers</th>
                <th className="py-3 px-5 text-center font-mono">Bill date</th>
                <th className="py-3 px-5 font-mono">Due date</th>
                <th className="py-3 px-10 text-right">Invoice Sum</th>
                <th className="py-3 px-5 text-center font-bold">Settlement Status</th>
                <th className="py-3 px-5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Loading account receivables...
                  </td>
                </tr>
              ) : !sisData || sisData.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-xs text-slate-400 animate-fade-in">
                    No matching Customer Invoices found. Select &quot;Invoice Multi-DO Dispatches&quot; to compile one.
                  </td>
                </tr>
              ) : (
                sisData.data.map((si) => (
                  <tr key={si.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border">
                        {si.siNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">{si.customerName}</td>
                    <td className="py-3.5 px-5 text-slate-505 font-mono">
                      <span className="bg-slate-50 border text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px] block max-w-xs truncate" title={si.soNumber}>
                        {si.soNumber || 'Direct Retail'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center text-slate-505 font-mono">{new Date(si.invoiceDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-5 text-slate-505 font-mono">{new Date(si.dueDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-10 text-right font-extrabold text-slate-900 font-mono">${si.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          si.status === 'Draft'
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : si.status === 'Unpaid'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                            : 'bg-emerald-55 bg-teal-50 text-emerald-800 text-teal-700 border border-teal-100'
                        }`}
                      >
                        {si.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(si)}
                          className="py-1 px-2.5 hover:bg-slate-100 text-slate-600 font-bold font-mono text-[10px]"
                        >
                          AUDIT
                        </button>

                        {si.status !== 'Paid' && (
                          <button
                            onClick={() => handleToggleStatus(si.id, si.status === 'Draft' ? 'Unpaid' : 'Paid')}
                            className="py-1 px-2 text-[10px] hover:bg-teal-50 rounded text-teal-600 font-black flex items-center gap-0.5"
                          >
                            <span>{si.status === 'Draft' ? 'POST' : 'RECV CASH'}</span>
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
        {sisData && sisData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50 font-mono text-[10px]">
            <span>PAGE {sisData.page} OF {sisData.pages} ({sisData.total} TOTAL)</span>
            <div className="flex gap-1.5">
              <button
                disabled={sisData.page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="bg-white px-2.5 py-1.5 border hover:border-slate-300 rounded text-slate-705 font-bold"
              >
                PREV
              </button>
              <button
                disabled={sisData.page >= sisData.pages}
                onClick={() => setPage(p => p + 1)}
                className="bg-white px-2.5 py-1.5 border hover:border-slate-300 rounded text-slate-705 font-bold"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Drawer (Multi-DO Linker) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-2xl h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8 animate-slide-in">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-950 font-sans tracking-tight uppercase flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>Consolidated client invoicing compilation</span>
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
                  {/* Select Customer Account */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      1. Select Client Customer
                    </label>
                    <SearchableSelect
                      options={customers.map(c => ({ value: c.id, label: c.email ? `${c.name} (${c.email})` : c.name }))}
                      value={formCustomerId}
                      onChange={(val) => handleCustomerChange(val)}
                      placeholder="Choose Customer..."
                    />
                  </div>

                  {/* Statement invoice date */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      2. Statement Invoice Date Issue
                    </label>
                    <input
                      type="date"
                      value={formInvoiceDate}
                      onChange={(e) => setFormInvoiceDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Open DOs checklist */}
                {formCustomerId && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2">
                    <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                      3. Check Cargo Delivery Slips to Invoice
                    </span>
                    {availableDOsForCustomer.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No delivered cargo items require billing compiled on file.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono animate-fade-in">
                        {availableDOsForCustomer.map((doRec) => {
                          const isChecked = selectedDoIds.includes(doRec.id);
                          return (
                            <label key={doRec.id} className={`flex items-start gap-2.5 p-2 bg-white rounded border cursor-pointer transition-colors shadow-3xs ${
                              isChecked ? 'border-blue-600 bg-blue-50/20' : 'border-slate-200 hover:bg-slate-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleDoCheckboxToggle(doRec.id)}
                                className="mt-0.5 border-slate-300 rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 font-mono">[{doRec.doNumber}]</span>
                                <div className="text-[9px] text-slate-500 font-sans mt-0.5 leading-normal">
                                  Items: {doRec.items.length} | Shipped: {new Date(doRec.deliveryDate).toLocaleDateString()}
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
                  {/* Due date */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      receivable Payment Due date Limit
                    </label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>

                  {/* Account entry status */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Billing posting ledger
                    </label>
                    <SearchableSelect
                      options={[
                        { value: 'Draft', label: 'Draft (Hold)' },
                        { value: 'Unpaid', label: 'Unpaid (Accounts Receivable post)' },
                        { value: 'Paid', label: 'Paid (Cash settled receiver)' }
                      ]}
                      value={formStatus}
                      onChange={(val) => setFormStatus(val)}
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    special accounts receivables remarks
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="Provide routing codes, bank wire details..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs focus:bg-white"
                  />
                </div>

                {/* Consolidated Delivery Slips Items Table */}
                {selectedDoIds.length > 0 && formLines.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono flex items-center justify-between">
                      <span>4. Items Invoicing breakdown</span>
                      <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded uppercase font-mono">{formLines.length} consolidated items</span>
                    </h4>

                    <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto hover:border-slate-350 transition-colors">
                      <table className="w-full text-left min-w-[650px] font-sans">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-extrabold text-slate-400 font-mono border-b border-slate-200 uppercase">
                            <th className="py-2.5 px-3">Catalog SKU / DETAILS</th>
                            <th className="py-2.5 px-3 uppercase">source receipt</th>
                            <th className="py-2.5 px-3 text-center">shipped count</th>
                            <th className="py-2.5 px-3 text-center bg-blue-50/30 text-slate-805 font-extrabold font-mono">Invoice Qty</th>
                            <th className="py-2.5 px-3 text-right bg-blue-50/30 text-slate-805 font-extrabold font-mono font-bold">Price Unit</th>
                            <th className="py-2.5 px-3 text-right font-mono font-bold">Line Sum</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 divide-slate-200 text-xs text-slate-705 font-sans">
                          {formLines.map((row, idx) => {
                            const allowedInput = row.deliveredQty - row.previouslyInvoicedQty;
                            const isExceeding = row.quantity > allowedInput;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/45">
                                <td className="py-3 px-3 pointer-events-none select-none">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">
                                    {row.itemCode}
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{row.itemName}</div>
                                </td>
                                <td className="py-3 px-3 col-span-1">
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-705 px-1.5 py-0.5 border rounded">
                                    {row.sourceDoNumber}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">{row.deliveredQty}</td>

                                <td className="py-3 px-3 text-center bg-blue-50/10">
                                  <input
                                    type="number"
                                    value={row.quantity === 0 ? '0' : row.quantity}
                                    onChange={(e) => handleLineValueChange(idx, 'quantity', e.target.value)}
                                    className={`w-16 bg-white border px-1.5 py-1 rounded text-xs text-center font-mono font-bold ${
                                      isExceeding ? 'border-rose-450 text-rose-600 focus:border-rose-500 bg-rose-50/10' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
                                    }`}
                                  />
                                  {isExceeding && (
                                    <span className="text-[8px] text-rose-600 block mt-1 font-mono uppercase font-black">
                                      Exceeds DO!
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right bg-blue-50/10 relative">
                                  <input
                                    type="number"
                                    value={row.price === 0 ? '0' : row.price}
                                    onChange={(e) => handleLineValueChange(idx, 'price', e.target.value)}
                                    className="w-20 bg-white border px-1.5 py-1 border-slate-303 rounded text-xs text-right font-mono font-bold focus:border-blue-500"
                                  />
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-905 select-none text-slate-900">
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

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between font-mono pb-4">
              <div>
                <span className="text-[9px] text-slate-400 font-sans font-bold block uppercase">Invoice Value Tally</span>
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

      {/* Details Spectra popup view */}
      {isDetailOpen && selectedSI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded shadow-2xl overflow-hidden border border-slate-105 flex flex-col justify-between max-h-[90vh]">
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[9px] text-slate-400 font-mono block uppercase">CLIENT INVOICE AUDIT RECON</span>
                  <h3 className="text-sm font-extrabold text-slate-950 font-sans tracking-tight uppercase">
                    {selectedSI.siNumber}
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
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">CLIENT CUSTOMER</span>
                  <span className="text-slate-900 font-bold">{selectedSI.customerName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Invoice Dates</span>
                  <span className="text-slate-700 font-medium">Issue: {new Date(selectedSI.invoiceDate).toLocaleDateString()} | Due: {new Date(selectedSI.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="sm:col-span-2 border-t border-slate-200/50 pt-2.5 mt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">consolidated DO references</span>
                  <span className="text-blue-700 font-bold max-w-sm block break-all font-mono leading-normal">{selectedSI.soNumber}</span>
                </div>
              </div>

              {selectedSI.remarks && (
                <div className="p-3 bg-slate-50 border rounded text-xs leading-normal">
                  <span className="font-bold text-slate-400 block text-[9px] uppercase font-mono">Remarks / invoices memo</span>
                  <p className="text-slate-600 italic mt-0.5">&ldquo;{selectedSI.remarks}&rdquo;</p>
                </div>
              )}

              {/* Items Table details */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">Reconciled bill items</h4>
                <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto">
                  <table className="w-full text-left min-w-[550px]">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 font-mono uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">SKU / ITEM DESCRIPTION</th>
                        <th className="py-2.5 px-3 uppercase">source receipt</th>
                        <th className="py-2.5 px-3 text-center">QUANTITY</th>
                        <th className="py-2.5 px-3 text-right font-sans">BILL RATE UNIT</th>
                        <th className="py-2.5 px-3 text-right">TOTAL CHARGED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedSI.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-950 bg-slate-101 bg-slate-100 p-0.5 rounded px-1.5 mr-1.5">{it.itemCode}</span>
                            <span>{it.itemName}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] bg-slate-50 text-slate-700 px-1.5 py-0.5 border rounded">
                              {it.sourceDoNumber || 'N/A'}
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
                <span className="text-[9px] text-slate-400 font-sans block uppercase font-bold">CLIENT INVOICED REVENUE</span>
                <span className="text-xl font-bold text-slate-900">${selectedSI.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex items-center gap-1.5 font-bold font-mono">
                {selectedSI.status === 'Draft' && (
                  <button
                    onClick={() => handleToggleStatus(selectedSI.id, 'Unpaid')}
                    className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
                  >
                    POST PAYABLE
                  </button>
                )}

                {selectedSI.status === 'Unpaid' && (
                  <button
                    onClick={() => handleToggleStatus(selectedSI.id, 'Paid')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 hover:bg-opacity-90 text-white rounded flex items-center gap-1 uppercase tracking-wide shadow-xs"
                  >
                    <Check className="h-4 w-4" />
                    <span>RECORD SETTLEMENT RECV</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-250 rounded text-slate-705"
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
