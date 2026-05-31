/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import Sidebar, { ERPView } from './components/Sidebar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ItemModule from './components/ItemModule';
import WarehouseModule from './components/WarehouseModule';
import PartnerModule from './components/PartnerModule';
import PurchaseOrderModule from './components/PurchaseOrderModule';
import GoodsReceiptModule from './components/GoodsReceiptModule';
import PurchaseInvoiceModule from './components/PurchaseInvoiceModule';
import SalesOrderModule from './components/SalesOrderModule';
import DeliveryOrderModule from './components/DeliveryOrderModule';
import SalesInvoiceModule from './components/SalesInvoiceModule';
import ReceivablePaymentModule from './components/ReceivablePaymentModule';
import PayablePaymentModule from './components/PayablePaymentModule';
import ReportModule from './components/ReportModule';
import { X, CheckCircle, AlertTriangle, Menu } from 'lucide-react';

interface ToastMessage {
  id: string;
  text: string;
  status: 'success' | 'error';
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('apex_erp_token') || 'simple-erp-mock-jwt-session-token-2026';
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('apex_erp_username') || 'ERP Operator';
  });

  const [currentView, setCurrentView] = useState<ERPView>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Cross-Module Auto-Populations State Flow
  const [autopopulatePoIdForGr, setAutopopulatePoIdForGr] = useState<string | null>(null);
  const [autopopulatePoIdForPi, setAutopopulatePoIdForPi] = useState<string | null>(null);
  const [autopopulateSoIdForDo, setAutopopulateSoIdForDo] = useState<string | null>(null);
  const [autopopulateSoIdForSi, setAutopopulateSoIdForSi] = useState<string | null>(null);
  const [autopopulateDoIdForSi, setAutopopulateDoIdForSi] = useState<string | null>(null);
  const [autopopulateGrIdForPi, setAutopopulateGrIdForPi] = useState<string | null>(null);

  // Helper function to create sliding banners
  const showToast = (text: string, status: 'success' | 'error' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, text, status }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (token: string, name: string) => {
    localStorage.setItem('apex_erp_token', token);
    localStorage.setItem('apex_erp_username', name);
    setAuthToken(token);
    setUserName(name);
    setCurrentView('dashboard');
    showToast(`Welcome back, ${name}! Secure ERP terminal connection established.`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('apex_erp_token');
    localStorage.removeItem('apex_erp_username');
    setAuthToken('simple-erp-mock-jwt-session-token-2026');
    setUserName('ERP Operator');
    setCurrentView('dashboard');
    showToast('Secure terminal session refreshed.', 'success');
  };

  // Centralizes view navigating, especially workflows involving autoprefill pipes
  const handleNavigate = (view: ERPView) => {
    setCurrentView(view);
  };

  // Direct handlers for Cross-Module references
  const handleTriggerPOToGR = (poId: string) => {
    setAutopopulatePoIdForGr(poId);
    setCurrentView('gr');
  };

  const handleTriggerPOToPI = (poId: string) => {
    setAutopopulatePoIdForPi(poId);
    setCurrentView('pi');
  };

  const handleTriggerSOToDo = (soId: string) => {
    setAutopopulateSoIdForDo(soId);
    setCurrentView('do');
  };

  const handleTriggerSOToSI = (soId: string) => {
    setAutopopulateSoIdForSi(soId);
    setCurrentView('si');
  };

  const handleTriggerDOToSI = (doId: string) => {
    setAutopopulateDoIdForSi(doId);
    setCurrentView('si');
  };

  const handleTriggerGRToPI = (grId: string) => {
    setAutopopulateGrIdForPi(grId);
    setCurrentView('pi');
  };

  if (!authToken) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} />
        {/* Floating notifications */}
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 w-full animate-slide-in font-sans ${
                toast.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-205 border-rose-200 text-rose-800'
              }`}
            >
              {toast.status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <div className="flex-1 text-xs font-semibold leading-relaxed">
                {toast.text}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Sidebar navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          handleNavigate(view);
          setIsSidebarOpen(false);
        }}
        userName={userName}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Container workspace */}
      <div className="pl-0 lg:pl-60 flex flex-col min-h-screen transition-all duration-200">
        {/* Top bar header */}
        <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4 text-[10px] font-bold text-slate-500 font-mono">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <span className="flex items-center gap-1.5 matches-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              TERMINAL: ONLINE
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold uppercase hidden sm:inline-block">SECURE SHELL</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase select-none">ApexERP Console</span>
          </div>
        </header>

        {/* Dynamic Inner Router view */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <Dashboard authToken={authToken} onNavigate={handleNavigate} showToast={showToast} />
          )}

          {currentView === 'items' && (
            <ItemModule authToken={authToken} showToast={showToast} />
          )}

          {currentView === 'warehouses' && (
            <WarehouseModule authToken={authToken} showToast={showToast} />
          )}

          {currentView === 'customers' && (
            <PartnerModule authToken={authToken} initialType="customer" showToast={showToast} />
          )}

          {currentView === 'suppliers' && (
            <PartnerModule authToken={authToken} initialType="supplier" showToast={showToast} />
          )}

          {currentView === 'po' && (
            <PurchaseOrderModule
              authToken={authToken}
              showToast={showToast}
              onNavigateToGR={handleTriggerPOToGR}
              onNavigateToPI={handleTriggerPOToPI}
            />
          )}

          {currentView === 'gr' && (
            <GoodsReceiptModule
              authToken={authToken}
              showToast={showToast}
              autopopulatePoId={autopopulatePoIdForGr}
              resetAutopopulatedPoId={() => setAutopopulatePoIdForGr(null)}
              onNavigateToPI={handleTriggerGRToPI}
            />
          )}

          {currentView === 'pi' && (
            <PurchaseInvoiceModule
              authToken={authToken}
              showToast={showToast}
              autopopulatePoId={autopopulatePoIdForPi}
              resetAutopopulatedPoId={() => setAutopopulatePoIdForPi(null)}
              autopopulateGrId={autopopulateGrIdForPi}
              resetAutopopulatedGrId={() => setAutopopulateGrIdForPi(null)}
            />
          )}

          {currentView === 'so' && (
            <SalesOrderModule
              authToken={authToken}
              showToast={showToast}
              onNavigateToDO={handleTriggerSOToDo}
              onNavigateToSI={handleTriggerSOToSI}
            />
          )}

          {currentView === 'do' && (
            <DeliveryOrderModule
              authToken={authToken}
              showToast={showToast}
              autopopulateSoId={autopopulateSoIdForDo}
              resetAutopopulatedSoId={() => setAutopopulateSoIdForDo(null)}
              onNavigateToSI={handleTriggerDOToSI}
            />
          )}

          {currentView === 'si' && (
            <SalesInvoiceModule
              authToken={authToken}
              showToast={showToast}
              autopopulateSoId={autopopulateSoIdForSi}
              resetAutopopulatedSoId={() => setAutopopulateSoIdForSi(null)}
              autopopulateDoId={autopopulateDoIdForSi}
              resetAutopopulatedDoId={() => setAutopopulateDoIdForSi(null)}
            />
          )}

          {currentView === 'receivable_payments' && (
            <ReceivablePaymentModule authToken={authToken} showToast={showToast} />
          )}

          {currentView === 'payable_payments' && (
            <PayablePaymentModule authToken={authToken} showToast={showToast} />
          )}

          {currentView === 'reports' && (
            <ReportModule authToken={authToken} showToast={showToast} />
          )}
        </main>
      </div>

      {/* Slide Toast Notifications Overlay */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 w-full animate-slide-in font-sans ${
              toast.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-250 border-rose-200 text-rose-800'
            }`}
          >
            {toast.status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.text}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
