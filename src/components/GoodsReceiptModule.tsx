/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { GoodsReceipt, PurchaseOrder, Warehouse, PaginatedResponse, Supplier } from '../types';
import { Search, Plus, Layers, ArrowLeft, ArrowRight, X, Check, Warehouse as WhIcon, Sparkles, FileDown } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface GoodsReceiptModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
  autopopulatePoId?: string | null;
  resetAutopopulatedPoId?: () => void;
  onNavigateToPI?: (grId: string) => void;
}

export default function GoodsReceiptModule({
  authToken,
  showToast,
  autopopulatePoId,
  resetAutopopulatedPoId,
  onNavigateToPI
}: GoodsReceiptModuleProps) {
  const [grsData, setGrsData] = useState<PaginatedResponse<GoodsReceipt> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Reference drops loaded on demand
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Drawer Creator Trigger
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);

  // Core creator form values
  const [formSupplierId, setFormSupplierId] = useState('');
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formReceiptDate, setFormReceiptDate] = useState(new Date().toISOString().substring(0, 10));
  const [formRemarks, setFormRemarks] = useState('');
  
  // High fidelity composite list for multiple POs
  const [formLines, setFormLines] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantityOrdered: number;
    quantityReceivedPreviously: number;
    receivedQty: number;
    sourcePoId: string;
    sourcePoNumber: string;
    sourcePoItemId: string;
  }[]>([]);
  const [formError, setFormError] = useState('');
  const [referencesLoaded, setReferencesLoaded] = useState(false);

  const fetchGrs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search
      });
      const response = await fetch(`/api/goods-receipts?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Could not pull goods receipts list');
      const data = await response.json();
      setGrsData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling Goods Receipts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferences = async () => {
    try {
      const [poRes, whRes, suppRes] = await Promise.all([
        fetch('/api/purchase-orders?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/warehouses', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/suppliers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const poData = await poRes.json();
      const whData = await whRes.json();
      const suppData = await suppRes.json();

      // Filter POs that are Submitted or Partial (open for receive)
      const openPOs = (poData.data || []).filter((p: PurchaseOrder) => p.status === 'Submitted' || p.status === 'Partial');

      setPurchaseOrders(openPOs);
      setWarehouses(whData || []);
      setSuppliers(suppData.data || []);
      setReferencesLoaded(true);
    } catch (err) {
      console.error('Error fetching GR reference elements:', err);
    }
  };

  useEffect(() => {
    fetchGrs();
  }, [page, search]);

  useEffect(() => {
    fetchReferences();
  }, []);

  // Monitor pre-populated incoming PO trigger
  useEffect(() => {
    if (autopopulatePoId && referencesLoaded) {
      const matchPo = purchaseOrders.find(p => p.id === autopopulatePoId);
      if (matchPo) {
        setFormSupplierId(matchPo.supplierId);
        setSelectedPoIds([autopopulatePoId]);
        loadItemsFromPOs(matchPo.supplierId, [autopopulatePoId]);
        setIsFormOpen(true);
      } else {
        // Fallback fetch in case it is Completed or not initially loaded
        handleOpenFormForSinglePOFallback(autopopulatePoId);
      }
      if (resetAutopopulatedPoId) resetAutopopulatedPoId();
    }
  }, [autopopulatePoId, referencesLoaded]);

  const handleOpenFormForSinglePOFallback = async (poIdStr: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchase-orders/${poIdStr}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const poObj: PurchaseOrder = await res.json();
        setFormSupplierId(poObj.supplierId);
        setSelectedPoIds([poIdStr]);
        
        // Temporarily include it in PO cache for item parsing
        setPurchaseOrders(prev => {
          if (prev.some(p => p.id === poObj.id)) return prev;
          return [...prev, poObj];
        });

        loadItemsFromPOs(poObj.supplierId, [poObj.id], [poObj]);
        setIsFormOpen(true);
      }
    } catch (err) {
      console.error('Fallback fetch for PO err', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamically group items across checked POs
  const loadItemsFromPOs = (supplierId: string, poIds: string[], customPool?: PurchaseOrder[]) => {
    if (!supplierId || poIds.length === 0) {
      setFormLines([]);
      return;
    }

    const lines: typeof formLines = [];
    const pool = customPool || purchaseOrders;
    poIds.forEach(id => {
      const poObj = pool.find(p => p.id === id);
      if (poObj) {
        poObj.items.forEach(it => {
          // Calculate already received quantity based on database PO-Item stats
          const alreadyReceived = it.receivedQty || 0;
          const remaining = Math.max(0, it.quantity - alreadyReceived);
          
          if (remaining > 0) {
            lines.push({
              itemId: it.itemId,
              itemCode: it.itemCode || 'CODE',
              itemName: it.itemName || 'Item Description',
              quantityOrdered: it.quantity,
              quantityReceivedPreviously: alreadyReceived,
              receivedQty: remaining, // default prefill to remaining
              sourcePoId: poObj.id,
              sourcePoNumber: poObj.poNumber,
              sourcePoItemId: it.id
            });
          }
        });
      }
    });
    setFormLines(lines);
  };

  const handleSupplierChange = (suppId: string) => {
    setFormSupplierId(suppId);
    setSelectedPoIds([]);
    setFormLines([]);
  };

  const handlePoCheckboxToggle = (poId: string) => {
    let updated: string[];
    if (selectedPoIds.includes(poId)) {
      updated = selectedPoIds.filter(id => id !== poId);
    } else {
      updated = [...selectedPoIds, poId];
    }
    setSelectedPoIds(updated);
    loadItemsFromPOs(formSupplierId, updated);
  };

  const handleRowQtyChange = (idx: number, fieldVal: string) => {
    const updated = [...formLines];
    const userVal = Math.max(0, Number(fieldVal) || 0);
    updated[idx].receivedQty = userVal;
    setFormLines(updated);
  };

  const handleSaveGR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId) {
      setFormError('Supplier must be selected.');
      return;
    }
    if (selectedPoIds.length === 0) {
      setFormError('At least one Purchase Order must be checked.');
      return;
    }
    if (!formWarehouseId) {
      setFormError('Destination warehouse location is required.');
      return;
    }
    const nonZeroLine = formLines.some(f => f.receivedQty > 0);
    if (!nonZeroLine) {
      setFormError('All lines are 0: please supply a received qty on at least one item.');
      return;
    }

    // Check for over-receiving errors
    for (const row of formLines) {
      const remainingAllowed = row.quantityOrdered - row.quantityReceivedPreviously;
      if (row.receivedQty > remainingAllowed) {
        setFormError(`Over-receiving Alert: [${row.itemCode}] receives ${row.receivedQty} against ${remainingAllowed} remaining in PO ${row.sourcePoNumber}.`);
        return;
      }
    }

    try {
      const payload = {
        supplierId: formSupplierId,
        warehouseId: formWarehouseId,
        receiptDate: formReceiptDate,
        remarks: formRemarks,
        items: formLines
          .filter(l => l.receivedQty > 0)
          .map(l => ({
            itemId: l.itemId,
            receivedQty: l.receivedQty,
            sourcePoId: l.sourcePoId,
            sourcePoItemId: l.sourcePoItemId
          }))
      };

      const response = await fetch('/api/goods-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected receipt ledger update');

      showToast(`Goods Receipt [${resData.grNumber}] created from ${selectedPoIds.length} POs. Stock updated.`, 'success');
      setIsFormOpen(false);
      fetchGrs();
    } catch (error: any) {
      setFormError(error?.message || 'Handshake failed during receiving save.');
    }
  };

  const handleOpenDetail = (gr: GoodsReceipt) => {
    setSelectedGR(gr);
    setIsDetailOpen(true);
  };

  // Filter purchase orders based on current selected supplier in creator form
  const availablePOsForSupplier = purchaseOrders.filter(p => p.supplierId === formSupplierId);

  return (
    <div className="space-y-6">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Goods Receipts (Receiving Log)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Receive and reconcile physical merchandise into warehouses from one or multiple POs (same supplier).
          </p>
        </div>
        <button
          onClick={() => {
            fetchReferences();
            setFormSupplierId('');
            setSelectedPoIds([]);
            setFormWarehouseId(warehouses[0]?.id || '');
            setFormLines([]);
            setFormRemarks('');
            setFormError('');
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-750 hover:bg-blue-700 text-white rounded text-xs font-bold self-start shadow-3xs hover:shadow-xs uppercase tracking-wide transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>RECEIVE MULTI-PO CARGO</span>
        </button>
      </div>

      {/* Toolbar Search Grid */}
      <div className="relative max-w-sm">
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
          placeholder="Search goods receipt numbers, PO links..."
          className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400"
        />
      </div>

      {/* Goods Receipts Log Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-3xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Receipt Ticket</th>
                <th className="py-3 px-5">Supplier</th>
                <th className="py-3 px-5">Source PO Numbers</th>
                <th className="py-3 px-5">Depot Location</th>
                <th className="py-3 px-5">Receipt Date</th>
                <th className="py-3 px-5">Remarks</th>
                <th className="py-3 px-5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Querying arrival manifests...
                  </td>
                </tr>
              ) : !grsData || grsData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-slate-400">
                    No Goods Receipts recorded on file. Reconcile an arrival by choosing &quot;Receive Multi-PO Cargo&quot;.
                  </td>
                </tr>
              ) : (
                grsData.data.map((gr) => (
                  <tr key={gr.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {gr.grNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">
                      {gr.supplierName || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-[10px] text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-bold block max-w-xs truncate" title={gr.poNumber}>
                        {gr.poNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-800">
                      {gr.warehouseName}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 font-mono">
                      {new Date(gr.receiptDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-slate-550 italic max-w-xs truncate">
                      {gr.remarks || <span className="text-slate-300">No instructions keyed</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(gr)}
                          className="py-1 px-2.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[10px] font-bold font-mono transition-colors"
                        >
                          SPECTRUM
                        </button>
                        {onNavigateToPI && gr.items.some(it => (it.receivedQty || 0) > (it.invoicedQty || 0)) && (
                          <button
                            onClick={() => onNavigateToPI(gr.id)}
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-sky-50 text-sky-600 hover:text-sky-800 font-bold text-[10px] flex items-center gap-0.5 font-mono transition-colors"
                            title="Invoice remaining received goods"
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
        {grsData && grsData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50 font-mono text-[10px]">
            <span>PAGE {grsData.page} OF {grsData.pages} ({grsData.total} TOTAL)</span>
            <div className="flex gap-1.5">
              <button
                disabled={grsData.page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="bg-white px-2.5 py-1.5 border hover:border-slate-300 rounded text-slate-700 font-bold"
              >
                PREV
              </button>
              <button
                disabled={grsData.page >= grsData.pages}
                onClick={() => setPage(p => p + 1)}
                className="bg-white px-2.5 py-1.5 border hover:border-slate-300 rounded text-slate-700 font-bold"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Creator Form Drawer (Multi-PO Linker) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-2xl h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8 animate-slide-in">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-950 font-sans tracking-tight uppercase flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>Receive Multi-document Cargo Arrivals</span>
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
                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Supplier First */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      1. Select Supplier
                    </label>
                    <SearchableSelect
                      options={suppliers.map(s => ({ value: s.id, label: s.email ? `${s.name} (${s.email})` : s.name }))}
                      value={formSupplierId}
                      onChange={(val) => handleSupplierChange(val)}
                      placeholder="Select a vendor..."
                    />
                  </div>

                  {/* Select Destination Depot */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      2. Destination Depot Location
                    </label>
                    <SearchableSelect
                      options={warehouses.map(wh => ({ value: wh.id, label: wh.name }))}
                      value={formWarehouseId}
                      onChange={(val) => setFormWarehouseId(val)}
                      placeholder="Select Warehouse..."
                    />
                  </div>
                </div>

                {/* Open POs For Selection Checkboxes */}
                {formSupplierId && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2">
                    <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                      3. Check Source Purchase Orders to Receive
                    </span>
                    {availablePOsForSupplier.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No open, submitted POs are recordable for this supplier.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {availablePOsForSupplier.map((po) => {
                          const isChecked = selectedPoIds.includes(po.id);
                          return (
                            <label key={po.id} className={`flex items-start gap-2.5 p-2 bg-white rounded border cursor-pointer transition-colors shadow-3xs ${
                              isChecked ? 'border-blue-600 bg-blue-50/20' : 'border-slate-200 hover:bg-slate-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handlePoCheckboxToggle(po.id)}
                                className="mt-0.5 border-slate-300 rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 font-mono">[{po.poNumber}]</span>
                                <div className="text-[9px] text-slate-500 font-sans mt-0.5 leading-normal">
                                  Order Date: {new Date(po.orderDate).toLocaleDateString()}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Inbound Fields */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Verification Date
                    </label>
                    <input
                      type="date"
                      value={formReceiptDate}
                      onChange={(e) => setFormReceiptDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Gate / Cargo notes
                    </label>
                    <input
                      type="text"
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Write terminal cargo info, gate ticket numbers..."
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs"
                    />
                  </div>
                </div>

                {/* Items Line verification */}
                {selectedPoIds.length > 0 && formLines.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono flex items-center justify-between">
                      <span>4. Items Consolidation Manifest</span>
                      <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded uppercase font-mono">{formLines.length} Consolidated items</span>
                    </h4>

                    <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-extrabold text-slate-400 font-mono border-b border-slate-200 uppercase">
                            <th className="py-2.5 px-3">Catalog Details / SKU</th>
                            <th className="py-2.5 px-3">PO Reference</th>
                            <th className="py-2.5 px-3 text-center">ordered</th>
                            <th className="py-2.5 px-3 text-center">already received</th>
                            <th className="py-2.5 px-3 text-center bg-teal-50 text-teal-800 font-extrabold">Arrival Recv Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 divide-slate-200 text-xs text-slate-700">
                          {formLines.map((row, idx) => {
                            const remainingAllowed = row.quantityOrdered - row.quantityReceivedPreviously;
                            const isExceeding = row.receivedQty > remainingAllowed;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/45">
                                <td className="py-3 px-3 pointer-events-none select-none">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">
                                    {row.itemCode}
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{row.itemName}</div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="text-[10px] text-slate-700 font-bold font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-150">
                                    {row.sourcePoNumber}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold">{row.quantityOrdered}</td>
                                <td className="py-3 px-3 text-center font-mono text-slate-400">{row.quantityReceivedPreviously}</td>
                                <td className="py-3 px-3 text-center bg-teal-50/20">
                                  <input
                                    type="number"
                                    value={row.receivedQty === 0 ? '0' : row.receivedQty}
                                    onChange={(e) => handleRowQtyChange(idx, e.target.value)}
                                    className={`w-20 bg-white border px-2 py-1 rounded text-xs text-center font-mono font-bold ${
                                      isExceeding
                                        ? 'border-rose-400 text-rose-600 focus:ring-rose-500 focus:border-rose-500'
                                        : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                                    }`}
                                  />
                                  {isExceeding && (
                                    <span className="text-[8px] text-rose-600 block mt-1 font-mono uppercase font-black">
                                      Exceeds Order!
                                    </span>
                                  )}
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

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5 font-mono">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-2 hover:bg-slate-105 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSaveGR}
                className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded shadow-sm flex items-center gap-1.5 uppercase font-mono tracking-wider"
              >
                <Check className="h-4 w-4" />
                <span>COMMIT STOCK INBOUND</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Spectrum Dialog */}
      {isDetailOpen && selectedGR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded shadow-2xl overflow-hidden border border-slate-105 flex flex-col justify-between max-h-[90vh]">
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[9px] text-slate-400 font-mono block uppercase">QUANTITIES VERIFICATION MANIFEST</span>
                  <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight uppercase">
                    Invoice Ticket: {selectedGR.grNumber}
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
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Supplier Name</span>
                  <span className="text-slate-900 font-bold">{selectedGR.supplierName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Destination Depot</span>
                  <span className="text-slate-700 font-semibold">{selectedGR.warehouseName}</span>
                </div>
                <div className="sm:col-span-2 border-t border-slate-200/50 pt-2.5 mt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Consolidated PO References</span>
                  <span className="text-blue-700 font-bold max-w-sm block break-all font-mono leading-normal">{selectedGR.poNumber}</span>
                </div>
                <div className="border-t border-slate-200/50 pt-2.5 mt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">RECEIPT DATE</span>
                  <span className="text-slate-700">{new Date(selectedGR.receiptDate).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedGR.remarks && (
                <div className="p-3 bg-slate-50 border rounded text-xs leading-normal">
                  <span className="font-bold text-slate-400 block text-[9px] uppercase font-mono">Remarks / Instructions</span>
                  <p className="text-slate-600 italic mt-0.5">&ldquo;{selectedGR.remarks}&rdquo;</p>
                </div>
              )}

              {/* Verified Items lists */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">Consolidated Arrival Items</h4>
                <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 font-mono uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">SKU / ITEM DESCRIPTION</th>
                        <th className="py-2.5 px-3">SOURCE PO</th>
                        <th className="py-2.5 px-3 text-center">RECEIVED COUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedGR.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-950 bg-slate-100 p-0.5 rounded px-1.5 mr-1.5">{it.itemCode}</span>
                            <span>{it.itemName}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] bg-slate-50 text-slate-700 px-1.5 py-0.5 border rounded">
                              {it.sourcePoNumber || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{it.receivedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 font-mono text-[11px]">
              {onNavigateToPI && selectedGR.items.some(it => (it.receivedQty || 0) > (it.invoicedQty || 0)) && (
                <button
                  onClick={() => {
                    setIsDetailOpen(false);
                    onNavigateToPI(selectedGR.id);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-sky-400 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <FileDown className="h-4 w-4" />
                  <span>LAUNCH SUPPLIER BILL</span>
                </button>
              )}
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-white border border-slate-250 rounded text-slate-705 font-bold hover:border-slate-400"
              >
                CLOSE MEMO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
