/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Supplier, Customer, Warehouse, Item, WarehouseStock } from '../types';
import { BarChart3, TrendingUp, Calendar, Filter, FileSpreadsheet, RefreshCw, Download, Layers, Users, TrendingDown } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface ReportModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
}

type ReportTab = 'stock-matrix' | 'stock-ledger' | 'purchases' | 'sales';

export default function ReportModule({ authToken, showToast }: ReportModuleProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('stock-matrix');
  const [loading, setLoading] = useState(false);

  // Reference elements for search drop-downs
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Filtering form elements
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

  // Tabbed Report Datasets
  const [purchaseReport, setPurchaseReport] = useState<any>(null);
  const [salesReport, setSalesReport] = useState<any>(null);
  const [ledgerReport, setLedgerReport] = useState<any[]>([]);
  const [stockMatrixData, setStockMatrixData] = useState<{ warehouses: Warehouse[]; matrix: any[] } | null>(null);

  const fetchReferences = async () => {
    try {
      const [suppRes, custRes, whRes, itemsRes] = await Promise.all([
        fetch('/api/suppliers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/customers?limit=100', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/warehouses', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/items?limit=100', { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const sData = await suppRes.json();
      const cData = await custRes.json();
      const wData = await whRes.json();
      const iData = await itemsRes.json();

      setSuppliers(sData.data || []);
      setCustomers(cData.data || []);
      setWarehouses(wData || []);
      setItems(iData.data || []);
    } catch (e) {
      console.error('Critical: Error resolving analytical drops:', e);
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.set('startDate', startDate);
      if (endDate) queryParams.set('endDate', endDate);

      if (activeTab === 'stock-matrix') {
        const response = await fetch('/api/reports/warehouse-matrix', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Failed to query Warehouse Pivot Matrix');
        const data = await response.json();
        setStockMatrixData(data);
      }

      else if (activeTab === 'stock-ledger') {
        if (selectedItemId) queryParams.set('itemId', selectedItemId);
        if (selectedWarehouseId) queryParams.set('warehouseId', selectedWarehouseId);

        const response = await fetch(`/api/reports/stock-ledger?${queryParams}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Failed to load Stock Movement logs');
        const data = await response.json();
        setLedgerReport(data);
      }

      else if (activeTab === 'purchases') {
        if (selectedSupplierId) queryParams.set('supplierId', selectedSupplierId);

        const response = await fetch(`/api/reports/purchase?${queryParams}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Could not pull purchase balance sheets');
        const data = await response.json();
        setPurchaseReport(data);
      }

      else if (activeTab === 'sales') {
        if (selectedCustomerId) queryParams.set('customerId', selectedCustomerId);

        const response = await fetch(`/api/reports/sales?${queryParams}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Failed to pull outbound revenue balance sheets');
        const data = await response.json();
        setSalesReport(data);
      }
    } catch (err: any) {
      showToast(err?.message || 'Handshake failed during data calculation.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [activeTab, selectedCustomerId, selectedSupplierId, selectedWarehouseId, selectedItemId, startDate, endDate]);

  const triggerCSVDownload = () => {
    showToast('Analytical spreadsheet generated! Exporting CSV layout...', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 font-sans">Business Reporting Intelligence</h2>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile company ratios, track warehouse turnover vectors, monitor product movement ledger files, and review accounts aging schedules.
          </p>
        </div>
        <button
          onClick={triggerCSVDownload}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-205 border-slate-200 text-slate-700 bg-white hover:border-slate-300 rounded-lg text-xs font-semibold self-start shadow-xs transition-colors"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>EXPORT SPREADSHEETS (CSV)</span>
        </button>
      </div>

      {/* Selector controls tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('stock-matrix')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'stock-matrix' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Depot Warehouse Matrix</span>
        </button>
        <button
          onClick={() => setActiveTab('stock-ledger')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'stock-ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Stock Movement Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'purchases' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          <span>Purchases Outlay Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'sales' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Sales Revenue Streams</span>
        </button>
      </div>

      {/* FILTERING SHIELD DRAWER */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap gap-4 items-end text-xs leading-normal font-sans shadow-3xs">
        {/* Date Filters (applicable to Ledger, Purchases, Sales) */}
        {activeTab !== 'stock-matrix' && (
          <>
            <div className="w-36">
              <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                Start Date Calendar
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 pl-7 pr-2 py-1.5 rounded-lg text-xs font-mono text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="w-36">
              <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                End Date Calendar
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 pl-7 pr-2 py-1.5 rounded-lg text-xs font-mono text-slate-700 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Tab Specific Drops */}
        {activeTab === 'stock-ledger' && (
          <>
            <div className="w-44">
              <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                Depot Isolation Filter
              </label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Warehouses' },
                  ...warehouses.map(w => ({ value: w.id, label: w.name }))
                ]}
                value={selectedWarehouseId}
                onChange={(val) => setSelectedWarehouseId(val)}
                placeholder="All Warehouses"
              />
            </div>

            <div className="w-44">
              <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                Catalog Item Isolation
              </label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Catalog Products' },
                   ...items.map(i => ({ value: i.id, label: `[${i.code}] ${i.name}` }))
                ]}
                value={selectedItemId}
                onChange={(val) => setSelectedItemId(val)}
                placeholder="All Catalog Products"
              />
            </div>
          </>
        )}

        {activeTab === 'purchases' && (
          <div className="w-52">
            <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
              Supplier Filter
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'All Suppliers / Creditors' },
                ...suppliers.map(s => ({ value: s.id, label: s.name }))
              ]}
              value={selectedSupplierId}
              onChange={(val) => setSelectedSupplierId(val)}
              placeholder="All Suppliers / Creditors"
            />
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="w-52">
            <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
              Customer Filter
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'All Customers / Debtors' },
                ...customers.map(c => ({ value: c.id, label: c.name }))
              ]}
              value={selectedCustomerId}
              onChange={(val) => setSelectedCustomerId(val)}
              placeholder="All Customers / Debtors"
            />
          </div>
        )}

        <button
          onClick={loadReportData}
          className="px-3.5 py-2 hover:bg-slate-200 bg-slate-150 bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 font-mono transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>RECOMPUTE STATS</span>
        </button>
      </div>

      {/* CORE DISPLAY WINDOW COORD */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-400 uppercase">
          Calculating analytical cells...
        </div>
      ) : (
        <div className="animate-fade-in font-sans">
          
          {/* TAB 1: STOCK LEVELS PIVOT MATRIX */}
          {activeTab === 'stock-matrix' && stockMatrixData && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 bg-slate-50/20">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Multi-Warehouse Inventory Balance Sheets</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                  Slick pivot grid showing total available levels with separate column breakdowns for each physical depot storage terminal.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3.5 px-5">Sku Indicator</th>
                      <th className="py-3.5 px-5">Material Item Title</th>
                      {stockMatrixData.warehouses.map(wh => (
                        <th key={wh.id} className="py-3.5 px-5 text-right bg-slate-50/50">
                          {wh.name}
                        </th>
                      ))}
                      <th className="py-3.5 px-5 text-right font-extrabold text-slate-900 bg-slate-100/40">
                        Total Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockMatrixData.matrix.length === 0 ? (
                      <tr>
                        <td colSpan={3 + stockMatrixData.warehouses.length} className="text-center py-10 font-mono text-[10px] text-slate-400">
                          No logged warehouse stock sheets exist in database.
                        </td>
                      </tr>
                    ) : (
                      stockMatrixData.matrix.map((row) => {
                        const isLow = row.totalQty < 30;

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-5 font-mono font-bold text-slate-900">
                              <span className="bg-slate-100 p-1 px-1.5 rounded text-xs border border-slate-200/50">
                                {row.itemCode}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <div className="font-semibold text-slate-800">{row.itemName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono uppercase">Uom: {row.unit}</div>
                            </td>
                            {stockMatrixData.warehouses.map(wh => {
                              const qty = row[wh.id] || 0;
                              return (
                                <td key={wh.id} className="py-3 px-5 text-right font-mono text-slate-600">
                                  {qty}
                                </td>
                              );
                            })}
                            <td className="py-3 px-5 text-right bg-slate-50/30">
                              <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs leading-normal ${
                                isLow
                                  ? 'bg-rose-50 text-rose-700 font-extrabold border border-rose-100 animate-pulse'
                                  : 'bg-slate-100 text-slate-800 border'
                              }`}>
                                {row.totalQty}
                              </span>
                              {isLow && (
                                <span className="block text-[8px] text-rose-500 font-bold uppercase font-mono mt-1">
                                  Low quantity alert!
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: STOCK LEDGER TIME-SERIES */}
          {activeTab === 'stock-ledger' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 bg-slate-50/20">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Stock movements chronological records</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-normal font-sans">
                  Time-series transaction trace of every single inventory delta (Inwards from GR receipts, Outwards from DO shipments).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3.5 px-5">Timestamp</th>
                      <th className="py-3.5 px-5 text-center">In/out delta</th>
                      <th className="py-3.5 px-5">Sku Code</th>
                      <th className="py-3.5 px-5">Material details</th>
                      <th className="py-3.5 px-5">Depot Location</th>
                      <th className="py-3.5 px-5 text-right">delta Amount</th>
                      <th className="py-3.5 px-5">referenced Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerReport.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                          No stock movements fit filtered date range.
                        </td>
                      </tr>
                    ) : (
                      ledgerReport.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                          <td className="py-3.5 px-5 text-slate-400 font-mono">
                            {new Date(m.date).toLocaleString()}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wide ${
                              m.type === 'IN' || m.quantity > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {m.type === 'IN' || m.quantity > 0 ? 'STOCK-IN' : 'STOCK-OUT'}
                            </span>
                          </td>
                          <td className="py-3 px-5 font-mono font-bold text-slate-950">
                            {m.itemCode}
                          </td>
                          <td className="py-3 px-5 text-slate-800">
                            <div className="font-semibold">{m.itemName}</div>
                          </td>
                          <td className="py-3 px-5 font-semibold text-slate-700">{m.warehouseName}</td>
                          <td className={`py-3 px-5 text-right font-mono font-bold ${m.quantity > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                          </td>
                          <td className="py-3 px-5 text-slate-500 font-mono">
                            <span className="bg-slate-100 border p-0.5 rounded px-1.5 text-[11px] font-semibold tracking-wide">{m.reference}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PURCHASES INTEL */}
          {activeTab === 'purchases' && purchaseReport && (
            <div className="space-y-6">
              {/* Cards Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono">OUTLAY INVOICED SUMMARY</span>
                    <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                      ${purchaseReport.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {purchaseReport.supplierBreakdown && purchaseReport.supplierBreakdown.length > 0 && (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 col-span-2 shadow-3xs">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono mb-2">Vendor Outlay Allocation</span>
                    <div className="flex flex-wrap gap-4">
                      {purchaseReport.supplierBreakdown.map((row: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[11px] leading-relaxed">
                          <span className="font-semibold text-slate-805 block">{row.supplierName}</span>
                          <span className="text-slate-900 font-bold mt-0.5 block">${row.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions list */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 bg-slate-50/20">
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Supplier Bills Ratios</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                        <th className="py-3 px-5">Inbound Ticket</th>
                        <th className="py-3 px-5 font-mono">bill date</th>
                        <th className="py-3 px-5 font-mono">due date</th>
                        <th className="py-3 px-5">referencing Vendor</th>
                        <th className="py-3 px-5 text-right font-semibold">Tally Amount</th>
                        <th className="py-3 px-5 text-center">Settlement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {purchaseReport.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 font-sans text-slate-400">
                            No bills found matching parameters.
                          </td>
                        </tr>
                      ) : (
                        purchaseReport.transactions.map((tr: any) => (
                          <tr key={tr.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-5 font-mono font-bold text-slate-950">
                              {tr.piNumber}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-500">
                              {new Date(tr.invoiceDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-500">
                              {new Date(tr.dueDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-5 font-semibold text-slate-800">
                              {tr.supplierName}
                            </td>
                            <td className="py-3 px-5 text-right font-mono font-bold text-slate-900">
                              ${tr.totalAmount.toFixed(2)}
                            </td>
                            <td className="py-3 px-5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 text-[9px] font-bold tracking-wide rounded-full font-mono uppercase ${
                                  tr.status === 'Draft'
                                    ? 'bg-slate-100 text-slate-400'
                                    : tr.status === 'Unpaid'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                              >
                                {tr.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SALES REVENUE STREAM */}
          {activeTab === 'sales' && salesReport && (
            <div className="space-y-6">
              {/* Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in">
                <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono">REVENUE INVOICED SUMMARY</span>
                    <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                      ${salesReport.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {salesReport.customerBreakdown && salesReport.customerBreakdown.length > 0 && (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 col-span-2 shadow-3xs">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono mb-2">Customer Buyer Share Breakdown</span>
                    <div className="flex flex-wrap gap-4">
                      {salesReport.customerBreakdown.map((row: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[11px] leading-relaxed">
                          <span className="font-semibold text-slate-805 block">{row.customerName}</span>
                          <span className="text-slate-900 font-bold mt-0.5 block">${row.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions grid */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 bg-slate-50/20">
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Customer Billing Receivable ledgers</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                        <th className="py-3 px-5">Receivables invoice</th>
                        <th className="py-3 px-5 font-mono">statement date</th>
                        <th className="py-3 px-5 font-mono">due Date</th>
                        <th className="py-3 px-5">purchasing debtor</th>
                        <th className="py-3 px-5 text-right font-semibold">Tally Amount</th>
                        <th className="py-3 px-5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {salesReport.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 font-sans text-slate-400">
                            No invoices posted matching selected criteria.
                          </td>
                        </tr>
                      ) : (
                        salesReport.transactions.map((tr: any) => (
                          <tr key={tr.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-5 font-mono font-bold text-slate-950">
                              {tr.siNumber}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-500">
                              {new Date(tr.invoiceDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-500">
                              {new Date(tr.dueDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-5 font-semibold text-slate-800">
                              {tr.customerName}
                            </td>
                            <td className="py-3 px-5 text-right font-mono font-bold text-slate-900">
                              ${tr.totalAmount.toFixed(2)}
                            </td>
                            <td className="py-3 px-5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 text-[9px] font-bold tracking-wide rounded-full font-mono uppercase ${
                                  tr.status === 'Draft'
                                    ? 'bg-slate-100 text-slate-400'
                                    : tr.status === 'Unpaid'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                              >
                                {tr.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
