/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

interface DashboardStats {
  totalPurchases: number;
  totalSales: number;
  totalStockItems: number;
  lowStockItems: number;
  chartsData: { month: string; purchases: number; sales: number }[];
}

interface DashboardProps {
  authToken: string;
  onNavigate: (view: any) => void;
  showToast?: (msg: string, status: 'success' | 'error') => void;
}

export default function Dashboard({ authToken, onNavigate, showToast }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('This Year');
  const [seeding, setSeeding] = useState(false);
  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchStats = async () => {
    try {
      setLoading(true);
      let url = `/api/dashboard/stats?dateFilter=${encodeURIComponent(dateFilter)}`;
      if (dateFilter === 'Custom') {
        url += `&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Could not pull business telemetry stats');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err?.message || 'Server connection lost. Try reloading.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm('Are you sure you want to seed pristine demo data? This will reset existing database transactions and create clean, unified records.')) return;
    try {
      setSeeding(true);
      const res = await fetch('/api/seed-dummy-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to seed dummy data.');
      
      if (showToast) {
        showToast(data.message || 'ERP master data and payments successfully seeded!', 'success');
      }
      // Reload stats
      fetchStats();
    } catch (err: any) {
      if (showToast) {
        showToast(err.message || 'Failed to populate dummy records.', 'error');
      }
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateFilter, startDateStr, endDateStr]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'Today': return 'Today';
      case 'This Week': return 'This Week';
      case 'This Month': return 'This Month';
      case 'This Year': return 'This Year';
      case 'Custom': return `${startDateStr} to ${endDateStr}`;
      default: return dateFilter;
    }
  };

  const maxVal = stats ? Math.max(...stats.chartsData.map(d => Math.max(d.purchases, d.sales)), 2000) : 2000;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header Block with Integrated Date Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">ERP Executive Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1 leading-normal">
            Real-time direct visual reports of buying/sales cycles and workflow action items.
          </p>
        </div>

        {/* Date Filter Widget */}
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white rounded font-mono font-bold text-[10px] uppercase shadow-2xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
            <span>{seeding ? 'Seeding...' : 'Seed Demo Data'}</span>
          </button>

          <div className="flex rounded border border-slate-200 p-0.5 bg-white shadow-3xs">
            {['Today', 'This Week', 'This Month', 'This Year', 'Custom'].map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-xs transition-colors tracking-wide ${
                  dateFilter === filter
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {filter === 'Custom' ? 'Custom Range' : filter}
              </button>
            ))}
          </div>

          {dateFilter === 'Custom' && (
            <div className="flex items-center gap-1.5 bg-white p-1 rounded border border-slate-200 shadow-3xs animate-fade-in">
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="text-[10px] font-bold font-mono px-1.5 py-0.5 border border-slate-200 rounded text-slate-700 bg-slate-50 focus:outline-blue-500 focus:bg-white"
              />
              <span className="text-[10px] text-slate-400 font-bold uppercase">-</span>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="text-[10px] font-bold font-mono px-1.5 py-0.5 border border-slate-200 rounded text-slate-700 bg-slate-50 focus:outline-blue-500 focus:bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 font-mono bg-white border border-slate-200 rounded p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Synchronising LEDGER FLOWs...</p>
        </div>
      ) : error || !stats ? (
        <div className="p-6 bg-rose-50 rounded border border-rose-200 flex items-center gap-3.5 text-xs text-rose-700 font-sans">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>Telemetric Pull Error: {error || 'No database reference found.'}</span>
        </div>
      ) : (
        <>
          {/* Executive Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Sales (Revenues) */}
            <div className="bg-white p-5 rounded border border-slate-200 shadow-3xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-500 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold tracking-wider text-slate-400 font-mono uppercase">Total Sales Revenue</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Approved customer billing ({getFilterLabel()})</p>
                </div>
                <div className="p-2 rounded bg-blue-50 text-blue-600">
                  <DollarSign className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {formatCurrency(stats.totalSales)}
                </h3>
                <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 font-bold uppercase tracking-wider">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Closed Clients Tallies</span>
                </p>
              </div>
            </div>

            {/* Total Purchases (Procurement) */}
            <div className="bg-white p-5 rounded border border-slate-200 shadow-3xs flex flex-col justify-between relative overflow-hidden group hover:border-slate-800 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold tracking-wider text-slate-400 font-mono uppercase">Total Purchase Commit</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Vendor procurement totals ({getFilterLabel()})</p>
                </div>
                <div className="p-2 rounded bg-slate-100 text-slate-700">
                  <ShoppingBag className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {formatCurrency(stats.totalPurchases)}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider font-mono">
                  Incoming Vendor Bills
                </p>
              </div>
            </div>
          </div>

          {/* Charts & Flows Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG Monthly Comparative Chart */}
            <div className="bg-white p-5 rounded border border-slate-200 shadow-3xs lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider font-mono">Invoicing Comparative Flows</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">Comparative summary of total actualized Purchase Invoices vs Sales Invoices</p>
                  </div>
                  {/* Chart Legend */}
                  <div className="flex items-center gap-3 text-[9px] font-bold font-mono uppercase">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-slate-300 rounded-2xs inline-block"></span>
                      <span className="text-slate-500">Purchases</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-blue-600 rounded-2xs inline-block"></span>
                      <span className="text-blue-600">Sales</span>
                    </div>
                  </div>
                </div>

                {/* Core SVG Bars Layout */}
                <div className="mt-6 relative">
                  <div className="h-56 w-full flex items-end gap-1 px-4 justify-between border-b border-slate-200 pb-1">
                    {stats.chartsData.map((d, index) => {
                      const purchPct = Math.max(3, Math.round((d.purchases / maxVal) * 100));
                      const salesPct = Math.max(3, Math.round((d.sales / maxVal) * 100));

                      return (
                        <div key={index} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                          {/* Tooltip on Hover */}
                          <div className="absolute bottom-20 bg-slate-900 text-white p-2 rounded text-[9px] font-mono shadow-md hidden group-hover:block transition-all z-10 w-32 border border-slate-800 leading-normal">
                            <span className="font-bold text-slate-300 block mb-1 uppercase tracking-wider font-sans">{d.month}</span>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Purchased:</span>
                              <span>${d.purchases.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-blue-400 font-bold mt-0.5">
                              <span>Sales:</span>
                              <span>${d.sales.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="w-full flex justify-center items-end gap-1 px-0.5 h-36">
                            {/* Purchase Column */}
                            <div
                              style={{ height: `${purchPct}%` }}
                              className="w-1/2 bg-slate-300 hover:bg-slate-400 rounded-sm transition-all duration-300 shadow-2xs"
                            />
                            {/* Sales Column */}
                            <div
                              style={{ height: `${salesPct}%` }}
                              className="w-1/2 bg-blue-600 hover:bg-blue-500 rounded-sm transition-all duration-300 shadow-2xs"
                            />
                          </div>
                          {/* Month Text */}
                          <span className="mt-2 text-[9px] font-bold text-slate-550 text-slate-500 uppercase tracking-wider font-mono">
                            {d.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Axis Labels */}
                  <div className="absolute -left-2 top-0 h-36 flex flex-col justify-between text-[8px] font-mono font-bold text-slate-400 pointer-events-none select-none">
                    <span>${Math.round(maxVal).toLocaleString()}</span>
                    <span>${Math.round(maxVal / 2).toLocaleString()}</span>
                    <span>$0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Workflows Navigation Card */}
            <div className="bg-slate-50 p-5 rounded border border-slate-200 flex flex-col justify-between">
              <div>
                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 pb-2 border-b border-slate-250">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <span>Direct Workflow Launch</span>
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-2.5">
                  Seamlessly trigger and track documents in sequence across modules:
                </p>
              </div>

              {/* Sequential Action Button Groups */}
              <div className="space-y-3.5 my-4">
                {/* Buy Flow */}
                <div>
                  <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5 font-mono">Purchasing Pipeline</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onNavigate('po')}
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 rounded text-center transition-all shadow-3xs group flex flex-col justify-center items-center"
                    >
                      <span className="text-[9px] font-black text-slate-800">1. PO</span>
                      <span className="text-[8px] text-slate-400 font-medium">Order</span>
                    </button>
                    <button
                      onClick={() => onNavigate('gr')}
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 rounded text-center transition-all shadow-3xs group flex flex-col justify-center items-center"
                    >
                      <span className="text-[9px] font-black text-slate-800">2. GR</span>
                      <span className="text-[8px] text-slate-400 font-medium">Receipt</span>
                    </button>
                    <button
                      onClick={() => onNavigate('pi')}
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 rounded text-center transition-all shadow-3xs group flex flex-col justify-center items-center"
                    >
                      <span className="text-[9px] font-black text-slate-800">3. PI</span>
                      <span className="text-[8px] text-slate-400 font-medium">Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Sell Flow */}
                <div>
                  <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5 font-mono">Sales Pipeline</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onNavigate('so')}
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 rounded text-center transition-all shadow-3xs group flex flex-col justify-center items-center"
                    >
                      <span className="text-[9px] font-black text-slate-800">1. SO</span>
                      <span className="text-[8px] text-slate-400 font-medium">Order</span>
                    </button>
                    <button
                      onClick={() => onNavigate('do')}
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 rounded text-center transition-all shadow-3xs group flex flex-col justify-center items-center"
                    >
                      <span className="text-[9px] font-black text-slate-800">2. DO</span>
                      <span className="text-[8px] text-slate-400 font-medium">Delivery</span>
                    </button>
                    <button
                      onClick={() => onNavigate('si')}
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-500 rounded text-center transition-all shadow-3xs group flex flex-col justify-center items-center"
                    >
                      <span className="text-[9px] font-black text-slate-800">3. SI</span>
                      <span className="text-[8px] text-slate-400 font-medium">Invoice</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Stock Reports Button */}
              <div className="border-t border-slate-200/60 pt-3">
                <button
                  onClick={() => onNavigate('reports')}
                  className="w-full py-1.5 bg-slate-900 text-white rounded text-[10px] font-bold hover:bg-slate-800 transition-colors block text-center shadow-xs uppercase tracking-wider font-mono"
                >
                  Open Stock Reports
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
