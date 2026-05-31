/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutDashboard,
  Box,
  Users,
  Building,
  Truck,
  FileSpreadsheet,
  Receipt,
  Download,
  Upload,
  BarChart3,
  LogOut,
  FolderMinus,
  Briefcase,
  Coins,
  DollarSign
} from 'lucide-react';

export type ERPView =
  | 'dashboard'
  | 'items'
  | 'customers'
  | 'suppliers'
  | 'warehouses'
  | 'po'
  | 'gr'
  | 'pi'
  | 'so'
  | 'do'
  | 'si'
  | 'receivable_payments'
  | 'payable_payments'
  | 'reports';

interface SidebarProps {
  currentView: ERPView;
  onNavigate: (view: ERPView) => void;
  userName: string;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ currentView, onNavigate, userName, onLogout, isOpen, onClose }: SidebarProps) {
  const menuGroups = [
    {
      title: 'CORE PLATFORM',
      items: [
        { id: 'dashboard' as ERPView, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'items' as ERPView, label: 'Products / Items', icon: Box },
        { id: 'warehouses' as ERPView, label: 'Warehouses', icon: Building }
      ]
    },
    {
      title: 'PARTNERS',
      items: [
        { id: 'customers' as ERPView, label: 'Customers', icon: Users },
        { id: 'suppliers' as ERPView, label: 'Suppliers', icon: Truck }
      ]
    },
    {
      title: 'PURCHASING (INBOUND)',
      items: [
        { id: 'po' as ERPView, label: 'Purchase Order', icon: FileSpreadsheet },
        { id: 'gr' as ERPView, label: 'Goods Receipt', icon: Download },
        { id: 'pi' as ERPView, label: 'Purchase Invoice', icon: Receipt }
      ]
    },
    {
      title: 'SALES (OUTBOUND)',
      items: [
        { id: 'so' as ERPView, label: 'Sales Order', icon: Briefcase },
        { id: 'do' as ERPView, label: 'Delivery Order', icon: Upload },
        { id: 'si' as ERPView, label: 'Sales Invoice', icon: Receipt }
      ]
    },
    {
      title: 'FINANCE & PAYMENTS',
      items: [
        { id: 'receivable_payments' as ERPView, label: 'Receivable Payment', icon: Coins },
        { id: 'payable_payments' as ERPView, label: 'Payable Payment', icon: DollarSign }
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { id: 'reports' as ERPView, label: 'Reports & Auditing', icon: BarChart3 }
      ]
    }
  ];

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-15 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-slate-900 text-slate-200 border-r border-slate-800 select-none transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
      {/* Brand Header */}
      <div className="flex h-14 items-center px-4 border-b border-slate-850 border-slate-800 gap-3 bg-slate-950">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-blue-600 text-white font-extrabold text-sm shadow-sm shrink-0">
          A
        </div>
        <div>
          <h1 className="text-xs font-bold tracking-tight text-white leading-none">Apex ERP</h1>
          <p className="text-[9px] text-slate-500 mt-1 font-mono uppercase tracking-wider">Cloud Console</p>
        </div>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4">
        {menuGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <h3 className="text-[9px] font-bold tracking-wider text-slate-500 px-3 uppercase font-mono">
              {group.title}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const IconComp = item.icon;
                const isActive = currentView === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-450 text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <IconComp className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* User Footer Account Control */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-slate-850 bg-slate-800 flex items-center justify-center font-bold text-xs text-blue-400 font-mono border border-slate-700/55">
            {userName.substring(0, 2).toUpperCase()}
          </div>
          <div className="truncate flex-1">
            <div className="text-xs font-bold text-white truncate leading-tight">{userName}</div>
            <div className="text-[9px] font-mono text-slate-500 tracking-wider">OP: SECURE</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-[10px] font-bold text-slate-405 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded border border-slate-800 hover:border-rose-900/40 transition-all font-mono"
        >
          <LogOut className="h-3 w-3" />
          <span>EXIT TERMINAL</span>
        </button>
      </div>
    </aside>
    </>
  );
}
