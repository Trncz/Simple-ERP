/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { DeliveryOrder, SalesOrder, Warehouse, PaginatedResponse, WarehouseStock, Customer } from '../types';
import { Search, Plus, X, Check, Sparkles, FileDown, Layers } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface DeliveryOrderModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
  autopopulateSoId?: string | null;
  resetAutopopulatedSoId?: () => void;
  onNavigateToSI?: (doId: string) => void;
}

export default function DeliveryOrderModule({
  authToken,
  showToast,
  autopopulateSoId,
  resetAutopopulatedSoId,
  onNavigateToSI
}: DeliveryOrderModuleProps) {
  const [dosData, setDosData] = useState<PaginatedResponse<DeliveryOrder> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // References
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilityStockMap, setFacilityStockMap] = useState<Map<string, number>>(new Map());

  // Viewer / Drawer gates
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDO, setSelectedDO] = useState<DeliveryOrder | null>(null);

  // Form states
  const [formCustomerId, setFormCustomerId] = useState('');
  const [selectedSoIds, setSelectedSoIds] = useState<string[]>([]);
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formDeliveryDate, setFormDeliveryDate] = useState(new Date().toISOString().substring(0, 10));
  const [formRemarks, setFormRemarks] = useState('');

  // Main input lines
  const [formLines, setFormLines] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantityOrdered: number;
    quantityDeliveredPreviously: number;
    deliverQty: number; // custom input qty
    sourceSoId: string;
    sourceSoNumber: string;
    sourceSoItemId: string;
  }[]>([]);
  const [formError, setFormError] = useState('');
  const [referencesLoaded, setReferencesLoaded] = useState(false);

  const fetchDos = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search
      });
      const response = await fetch(`/api/delivery-orders?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Could not retrieve Delivery Orders list');
      const data = await response.json();
      setDosData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling Delivery Orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferences = async () => {
    try {
      const [soRes, whRes, custRes] = await Promise.all([
        fetch('/api/sales-orders?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/warehouses', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/customers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const soData = await soRes.json();
      const whData = await whRes.json();
      const custData = await custRes.json();

      // Filter open sales orders (Submitted or Partial)
      const openSOs = (soData.data || []).filter((s: SalesOrder) => s.status === 'Submitted' || s.status === 'Partial');

      setSalesOrders(openSOs);
      setWarehouses(whData || []);
      setCustomers(custData.data || []);
      setReferencesLoaded(true);
    } catch (err) {
      console.error('Error fetching DO reference items:', err);
    }
  };

  const fetchDepotStocks = async (warehouseId: string) => {
    if (!warehouseId) {
      setFacilityStockMap(new Map());
      return;
    }
    try {
      const response = await fetch(`/api/reports/stock-level?warehouseId=${warehouseId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Stock check command failed');
      const stocks: WarehouseStock[] = await response.json();
      
      const newMap = new Map<string, number>();
      stocks.forEach(s => {
        newMap.set(s.itemId, s.currentQty);
      });
      setFacilityStockMap(newMap);
    } catch (e) {
      console.error('Failed to pre-verify depot stock rates:', e);
    }
  };

  useEffect(() => {
    fetchDos();
  }, [page, search]);

  useEffect(() => {
    fetchReferences();
  }, []);

  // Monitor pre-populated incoming SO trigger
  useEffect(() => {
    if (autopopulateSoId && referencesLoaded) {
      const matchSo = salesOrders.find(s => s.id === autopopulateSoId);
      if (matchSo) {
        setFormCustomerId(matchSo.customerId);
        setSelectedSoIds([autopopulateSoId]);
        loadItemsFromSOs(matchSo.customerId, [autopopulateSoId]);
        setIsFormOpen(true);
      } else {
        fetch(`/api/sales-orders/${autopopulateSoId}`, { headers: { Authorization: `Bearer ${authToken}` } })
          .then(res => res.json())
          .then((soObj: SalesOrder) => {
            setFormCustomerId(soObj.customerId);
            setSelectedSoIds([autopopulateSoId]);
            setSalesOrders(prev => {
              if (prev.some(p => p.id === soObj.id)) return prev;
              return [...prev, soObj];
            });
            loadItemsFromSOs(soObj.customerId, [soObj.id], [soObj]);
            setIsFormOpen(true);
          }).catch(console.error);
      }
      if (resetAutopopulatedSoId) resetAutopopulatedSoId();
    }
  }, [autopopulateSoId, referencesLoaded]);

  const loadItemsFromSOs = (customerId: string, soIds: string[], customPool?: SalesOrder[]) => {
    if (!customerId || soIds.length === 0) {
      setFormLines([]);
      return;
    }

    const lines: typeof formLines = [];
    const pool = customPool || salesOrders;
    soIds.forEach(id => {
      const soObj = pool.find(s => s.id === id);
      if (soObj) {
        soObj.items.forEach(it => {
          const dispatched = it.deliveredQty || 0;
          const remaining = Math.max(0, it.quantity - dispatched);

          if (remaining > 0) {
            lines.push({
              itemId: it.itemId,
              itemCode: it.itemCode || 'SKU',
              itemName: it.itemName || 'Cargo Description',
              quantityOrdered: it.quantity,
              quantityDeliveredPreviously: dispatched,
              deliverQty: remaining, // default prefill to remaining
              sourceSoId: soObj.id,
              sourceSoNumber: soObj.soNumber,
              sourceSoItemId: it.id
            });
          }
        });
      }
    });
    setFormLines(lines);
  };

  const handleCustomerChange = (custId: string) => {
    setFormCustomerId(custId);
    setSelectedSoIds([]);
    setFormLines([]);
  };

  const handleSoCheckboxToggle = (soId: string) => {
    let updated: string[];
    if (selectedSoIds.includes(soId)) {
      updated = selectedSoIds.filter(id => id !== soId);
    } else {
      updated = [...selectedSoIds, soId];
    }
    setSelectedSoIds(updated);
    loadItemsFromSOs(formCustomerId, updated);
  };

  const handleWarehouseChange = async (whId: string) => {
    setFormWarehouseId(whId);
    await fetchDepotStocks(whId);
  };

  const handleRowQtyChange = (idx: number, fieldVal: string) => {
    const updated = [...formLines];
    const userVal = Math.max(0, Number(fieldVal) || 0);
    updated[idx].deliverQty = userVal;
    setFormLines(updated);
  };

  const handleSaveDO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      setFormError('Customer/Client must be selected first.');
      return;
    }
    if (selectedSoIds.length === 0) {
      setFormError('At least one open Sales Order must be checked.');
      return;
    }
    if (!formWarehouseId) {
      setFormError('Source warehouse storage to pull stock from is required.');
      return;
    }
    const nonZeroLine = formLines.some(f => f.deliverQty > 0);
    if (!nonZeroLine) {
      setFormError('Check lines: you must supply a dispatch quantity greater than 0 on at least one row.');
      return;
    }

    // Verify stock availability and order remaining constraints
    for (const row of formLines) {
      const remainingAllowed = row.quantityOrdered - row.quantityDeliveredPreviously;
      if (row.deliverQty > remainingAllowed) {
        setFormError(`Over-delivery Alert: [${row.itemCode}] dispatches ${row.deliverQty} against ${remainingAllowed} remaining in SO ${row.sourceSoNumber}.`);
        return;
      }

      const depotQty = facilityStockMap.get(row.itemId) || 0;
      if (row.deliverQty > depotQty) {
        setFormError(`Stock Deficit: [${row.itemCode}] requires ${row.deliverQty} in depot but only ${depotQty} is available in stock.`);
        return;
      }
    }

    try {
      const payload = {
        customerId: formCustomerId,
        warehouseId: formWarehouseId,
        deliveryDate: formDeliveryDate,
        remarks: formRemarks,
        items: formLines
          .filter(l => l.deliverQty > 0)
          .map(l => ({
            itemId: l.itemId,
            deliverQty: l.deliverQty,
            sourceSoId: l.sourceSoId,
            sourceSoItemId: l.sourceSoItemId
          }))
      };

      const response = await fetch('/api/delivery-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected dispatch ledger entry');

      showToast(`Delivery Order [${resData.doNumber}] committed successfully. Stocks dispatch logged.`, 'success');
      setIsFormOpen(false);
      fetchDos();
    } catch (error: any) {
      setFormError(error?.message || 'Handshake failed during dispatch save.');
    }
  };

  const handleOpenDetail = (doRecord: DeliveryOrder) => {
    setSelectedDO(doRecord);
    setIsDetailOpen(true);
  };

  const availableSOsForCustomer = salesOrders.filter(s => s.customerId === formCustomerId);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Delivery Orders (Dispatches)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch items from warehouses to clients, verifying real-time stock balances across multiple Sales Orders.
          </p>
        </div>
        <button
          onClick={() => {
            fetchReferences();
            setFormCustomerId('');
            setSelectedSoIds([]);
            setFormWarehouseId(warehouses[0]?.id || '');
            setFormLines([]);
            setFormRemarks('');
            setFormError('');
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold self-start shadow-3xs hover:shadow-xs uppercase tracking-wide transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>DISPATCH MULTI-SO PACKAGE</span>
        </button>
      </div>

      {/* Toolbar */}
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
          placeholder="Search DO numbers, sales order references..."
          className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
        />
      </div>

      {/* Dispatches List table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-3xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Delivery Ticket</th>
                <th className="py-3 px-5">Client Name</th>
                <th className="py-3 px-5">Source SO links</th>
                <th className="py-3 px-5">Source Depot</th>
                <th className="py-3 px-5">Dispatch Date</th>
                <th className="py-3 px-5">Remarks</th>
                <th className="py-3 px-5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Querying cargo transfers...
                  </td>
                </tr>
              ) : !dosData || dosData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-slate-400">
                    No matching Outbound Delivery Records located.
                  </td>
                </tr>
              ) : (
                dosData.data.map((doRec) => (
                  <tr key={doRec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {doRec.doNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-900">{doRec.customerName || 'N/A'}</td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-[10px] text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-bold block max-w-xs truncate" title={doRec.soNumber}>
                        {doRec.soNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-800">{doRec.warehouseName}</td>
                    <td className="py-3.5 px-5 text-slate-500 font-mono">
                      {new Date(doRec.deliveryDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 italic max-w-xs truncate">
                      {doRec.remarks || <span className="text-slate-300">No instructions keyed</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(doRec)}
                          className="py-1 px-2.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[10px] font-bold font-mono transition-colors"
                        >
                          SPECTRUM
                        </button>
                        {onNavigateToSI && doRec.items.some(it => (it.deliveredQty || 0) > (it.invoicedQty || 0)) && (
                          <button
                            onClick={() => onNavigateToSI(doRec.id)}
                            className="p-1 px-1.5 rounded-md bg-slate-50 hover:bg-sky-50 text-sky-600 hover:text-sky-800 font-bold text-[10px] flex items-center gap-0.5 font-mono transition-colors"
                            title="Invoice remaining dispatch cargo"
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
        {dosData && dosData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50 font-mono text-[10px]">
            <span>PAGE {dosData.page} OF {dosData.pages} ({dosData.total} TOTAL)</span>
            <div className="flex gap-1.5">
              <button
                disabled={dosData.page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="bg-white px-2.5 py-1.5 border hover:border-slate-300 rounded text-slate-705 font-bold"
              >
                PREV
              </button>
              <button
                disabled={dosData.page >= dosData.pages}
                onClick={() => setPage(p => p + 1)}
                className="bg-white px-2.5 py-1.5 border hover:border-slate-300 rounded text-slate-705 font-bold"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-2xl h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8 animate-slide-in">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-950 font-sans tracking-tight uppercase flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>Ship Logistics Multi-SO Dispatches</span>
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
                  {/* Customer Selection First */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      1. Select Client Customer
                    </label>
                    <SearchableSelect
                      options={customers.map(c => ({ value: c.id, label: c.email ? `${c.name} (${c.email})` : c.name }))}
                      value={formCustomerId}
                      onChange={(val) => handleCustomerChange(val)}
                      placeholder="Select Customer..."
                    />
                  </div>

                  {/* Extraction Depot warehouse */}
                  <div>
                    <label className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      2. Extraction Source Depot
                    </label>
                    <SearchableSelect
                      options={warehouses.map(wh => ({ value: wh.id, label: wh.name }))}
                      value={formWarehouseId}
                      onChange={(val) => handleWarehouseChange(val)}
                      placeholder="Select Warehouse..."
                    />
                  </div>
                </div>

                {/* Open SO select check */}
                {formCustomerId && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-205 space-y-2 font-mono">
                    <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                      3. Check sales orders to deliver
                    </span>
                    {availableSOsForCustomer.length === 0 ? (
                      <p className="text-[10px] text-slate-500 font-sans italic">No open, submitted SOs are outstanding for this customer.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {availableSOsForCustomer.map((so) => {
                          const isChecked = selectedSoIds.includes(so.id);
                          return (
                            <label key={so.id} className={`flex items-start gap-2.5 p-2 bg-white rounded border cursor-pointer transition-colors shadow-3xs ${
                              isChecked ? 'border-blue-600 bg-blue-50/20' : 'border-slate-200 hover:bg-slate-55'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSoCheckboxToggle(so.id)}
                                className="mt-0.5 border-slate-300 rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 font-mono">[{so.soNumber}]</span>
                                <div className="text-[9px] text-slate-400 font-sans mt-0.5 leading-normal">
                                  Items: {so.items.length} | Date: {new Date(so.orderDate).toLocaleDateString()}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Package Dispatch Date
                    </label>
                    <input
                      type="date"
                      value={formDeliveryDate}
                      onChange={(e) => setFormDeliveryDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      dispatch vehicle slip / instructions
                    </label>
                    <input
                      type="text"
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Write packing carrier references, vehicle license plates..."
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs focus:bg-white"
                    />
                  </div>
                </div>

                {/* Dispatch Items table list */}
                {selectedSoIds.length > 0 && formLines.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono flex items-center justify-between">
                      <span>4. Dispatch items manifest</span>
                      <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded font-mono">{formLines.length} consolidated items</span>
                    </h4>

                    <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] font-extrabold text-slate-400 font-mono border-b border-slate-200 uppercase">
                            <th className="py-2.5 px-3">SKU / ITEM DETAILS</th>
                            <th className="py-2.5 px-3">SOURCE SO</th>
                            <th className="py-2.5 px-3 text-center">depot stock</th>
                            <th className="py-2.5 px-3 text-center">SO remaining</th>
                            <th className="py-2.5 px-3 text-center bg-teal-50 text-teal-800 font-extrabold">Dispatch Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 divide-slate-200 text-xs text-slate-705">
                          {formLines.map((row, idx) => {
                            const allowedInput = row.quantityOrdered - row.quantityDeliveredPreviously;
                            const depotStock = facilityStockMap.get(row.itemId) || 0;
                            const levelDeficit = row.deliverQty > depotStock;
                            const orderOverflow = row.deliverQty > allowedInput;

                            return (
                              <tr key={idx} className="hover:bg-slate-55">
                                <td className="py-3 px-3 pointer-events-none select-none">
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">
                                    {row.itemCode}
                                  </span>
                                  <div className="text-[10px] text-slate-505 font-semibold mt-0.5">{row.itemName}</div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded border">
                                    {row.sourceSoNumber}
                                  </span>
                                </td>
                                <td className={`py-3 px-3 text-center font-mono font-bold ${depotStock <= 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                                  {depotStock} units
                                </td>
                                <td className="py-3 px-3 text-center font-mono text-slate-500">{allowedInput}</td>

                                <td className="py-3 px-3 text-center bg-teal-50/10">
                                  <input
                                    type="number"
                                    value={row.deliverQty === 0 ? '0' : row.deliverQty}
                                    onChange={(e) => handleRowQtyChange(idx, e.target.value)}
                                    className={`w-16 bg-white border px-1.5 py-1 rounded text-xs text-center font-mono font-bold ${
                                      levelDeficit || orderOverflow
                                        ? 'border-rose-450 text-rose-600 focus:border-rose-500 font-black bg-rose-50/20'
                                        : 'border-slate-300 focus:border-blue-500'
                                    }`}
                                  />
                                  {orderOverflow && (
                                    <span className="text-[8px] text-rose-600 block mt-1 font-mono uppercase font-black">
                                      Exceeds Order!
                                    </span>
                                  )}
                                  {!orderOverflow && levelDeficit && (
                                    <span className="text-[8px] text-rose-500 block mt-1 font-mono uppercase font-black">
                                      Stock Deficit!
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
                className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSaveDO}
                className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded shadow-sm flex items-center gap-1.5 uppercase font-mono tracking-wider"
              >
                <Check className="h-4 w-4" />
                <span>COMMIT STOCK DISPATCH</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Spectrum */}
      {isDetailOpen && selectedDO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded shadow-2xl overflow-hidden border border-slate-100 flex flex-col justify-between max-h-[90vh]">
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[9px] text-slate-400 font-mono block uppercase">QUANTITIES DISPATCH SLIP</span>
                  <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight uppercase">
                    {selectedDO.doNumber}
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
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Client Customer</span>
                  <span className="text-slate-900 font-bold">{selectedDO.customerName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Source Depot Location</span>
                  <span className="text-slate-705 font-semibold">{selectedDO.warehouseName}</span>
                </div>
                <div className="sm:col-span-2 border-t border-slate-200/50 pt-2.5 mt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase font-sans font-semibold">Consolidated Sales Orders</span>
                  <span className="text-blue-700 font-bold max-w-sm block break-all font-mono leading-normal">{selectedDO.soNumber}</span>
                </div>
                <div className="border-t border-slate-200/50 pt-2.5 mt-1.5">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">DISPATCH DATE</span>
                  <span className="text-slate-700">{new Date(selectedDO.deliveryDate).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedDO.remarks && (
                <div className="p-3 bg-slate-50 border rounded text-xs leading-normal">
                  <span className="font-bold text-slate-400 block text-[9px] uppercase font-mono">Remarks / Slip Details</span>
                  <p className="text-slate-650 italic mt-0.5">&ldquo;{selectedDO.remarks}&rdquo;</p>
                </div>
              )}

              {/* Items Table details */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">Dispatched Items Lines</h4>
                <div className="border border-slate-200 rounded overflow-hidden shadow-3xs overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 font-mono uppercase border-b border-slate-250">
                        <th className="py-2.5 px-3">SKU / ITEM DESCRIPTION</th>
                        <th className="py-2.5 px-3">SOURCE SO</th>
                        <th className="py-2.5 px-3 text-center">DISPATCHED UNITS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedDO.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-950 bg-slate-100 p-0.5 rounded px-1.5 mr-1.5">{it.itemCode}</span>
                            <span>{it.itemName}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] bg-slate-50 text-slate-700 px-1.5 py-0.5 border rounded">
                              {it.sourceSoNumber || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{it.deliveredQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 font-mono text-[11px]">
              {onNavigateToSI && selectedDO.items.some(it => (it.deliveredQty || 0) > (it.invoicedQty || 0)) && (
                <button
                  onClick={() => {
                    setIsDetailOpen(false);
                    onNavigateToSI(selectedDO.id);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-sky-450 text-sky-400 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <FileDown className="h-4 w-4" />
                  <span>LAUNCH SALES BILL</span>
                </button>
              )}
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-white border border-slate-250 rounded text-slate-705 font-bold hover:border-slate-400"
              >
                CLOSE DISPATCH VIEW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
