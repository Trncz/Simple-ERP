/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { PayablePayment, Supplier, PurchaseInvoice } from '../types';
import { Search, Plus, X, Check, Trash2, DollarSign, ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface PayablePaymentModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
}

export default function PayablePaymentModule({
  authToken,
  showToast
}: PayablePaymentModuleProps) {
  const [payments, setPayments] = useState<PayablePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reference drops
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  
  // Drawer visibility
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PayablePayment | null>(null);

  // Form states
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formPaymentDate, setFormPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [formPaymentMethod, setFormPaymentMethod] = useState('Bank Transfer');
  const [formAmount, setFormAmount] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filtering invoices for selected supplier
  const filteredInvoices = purchaseInvoices.filter(
    pi => pi.supplierId === formSupplierId && (pi.status === 'Unpaid' || pi.status === 'Draft')
  );

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payable-payments', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const json = await res.json();
        setPayments(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers?limit=100', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPurchaseInvoices = async () => {
    try {
      const res = await fetch('/api/purchase-invoices?limit=200', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const json = await res.json();
        setPurchaseInvoices(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchSuppliers();
    fetchPurchaseInvoices();
  }, []);

  // When invoice selection changes, pre-fill its outstanding balance
  const handleInvoiceChange = (invId: string) => {
    setFormInvoiceId(invId);
    const selectedInv = filteredInvoices.find(pi => pi.id === invId);
    if (selectedInv) {
      setFormAmount(selectedInv.totalAmount.toString());
    } else {
      setFormAmount('');
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId || !formInvoiceId || !formPaymentDate || !formPaymentMethod || !formAmount) {
      setFormError('Please fill out all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const response = await fetch('/api/payable-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          supplierId: formSupplierId,
          invoiceId: formInvoiceId,
          paymentDate: formPaymentDate,
          paymentMethod: formPaymentMethod,
          amount: Number(formAmount),
          remarks: formRemarks
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected payment submission.');

      showToast(`Payable payment [${resData.paymentNumber}] for ${resData.amount.toLocaleString()} posted.`, 'success');
      setIsFormOpen(false);
      
      // Reset form
      setFormSupplierId('');
      setFormInvoiceId('');
      setFormAmount('');
      setFormRemarks('');
      
      // Reload
      fetchPayments();
      fetchPurchaseInvoices(); // Status changed to Paid
    } catch (err: any) {
      setFormError(err?.message || 'Error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, paymentNum: string) => {
    if (!confirm(`Are you sure you want to delete payment [${paymentNum}]? This will restore the Purchase Invoice to "Unpaid" status.`)) return;

    try {
      const response = await fetch(`/api/payable-payments/${paymentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.ok) {
        showToast(`Payment [${paymentNum}] deleted and invoice status reverted.`, 'success');
        fetchPayments();
        fetchPurchaseInvoices();
      } else {
        throw new Error('Server rejected deleting payment.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete payment.', 'error');
    }
  };

  const handleOpenDetail = (p: PayablePayment) => {
    setSelectedPayment(p);
    setIsDetailOpen(true);
  };

  // Filter payments list
  const filteredPayments = payments.filter(p => {
    const term = searchQuery.toLowerCase();
    return (
      p.paymentNumber.toLowerCase().includes(term) ||
      (p.supplierName || '').toLowerCase().includes(term) ||
      (p.invoiceNumber || '').toLowerCase().includes(term) ||
      (p.paymentMethod || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Module Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
              <DollarSign className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-950 font-sans tracking-tight">Payable Payments</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            Track and log payment settlement of vendor and purchase invoices.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>SETTLE PAYABLE</span>
        </button>
      </div>

      {/* Main List Interface */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Payment #, Supplier, Invoice #..."
              className="w-full bg-white border border-slate-250 pl-9 pr-4 py-2 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-mono text-[9px] uppercase tracking-wider select-none">
                <th className="py-2.5 px-4 font-bold">Payment #</th>
                <th className="py-2.5 px-4 font-bold">Supplier Vendor</th>
                <th className="py-2.5 px-4 font-bold">Ref Invoice</th>
                <th className="py-2.5 px-4 font-bold">Date Settled</th>
                <th className="py-2.5 px-4 font-bold">Method</th>
                <th className="py-2.5 px-4 font-bold text-right">Settled Amount</th>
                <th className="py-2.5 px-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                    Loading payments ledger...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                    No supplier settlements posted. Good credit rating with creditors.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-900 font-bold">{p.paymentNumber}</td>
                    <td className="py-3 px-4 truncate max-w-xs">{p.supplierName || 'Unknown Vendor'}</td>
                    <td className="py-3 px-4 font-bold font-mono text-[10px] text-blue-600">{p.invoiceNumber || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">{p.paymentDate}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-600 uppercase font-bold font-mono">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-slate-950 text-xs">
                      ${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenDetail(p)}
                          className="p-1 text-slate-500 hover:text-slate-950 hover:bg-slate-100 rounded transition-colors"
                          title="View Receipt"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(p.id, p.paymentNumber)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          title="Void Settlement"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE PAYMENT DRAWER */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-screen shadow-xl flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">POST SUPPLIER PAYMENT SETTLEMENT</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePayment} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Supplier Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  1. Creditor Supplier
                </label>
                <SearchableSelect
                  options={suppliers.map(s => ({ value: s.id, label: s.email ? `${s.name} (${s.email})` : s.name }))}
                  value={formSupplierId}
                  onChange={(val) => {
                    setFormSupplierId(val);
                    setFormInvoiceId('');
                  }}
                  placeholder="Select a supplier vendor..."
                />
              </div>

              {/* Outstanding Invoices Dropdown */}
              {formSupplierId && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    2. Unpaid Purchase Invoice
                  </label>
                  {filteredInvoices.length === 0 ? (
                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[11px] font-medium font-sans">
                      Done! You have 0 outstanding bills to this supplier.
                    </div>
                  ) : (
                    <select
                      value={formInvoiceId}
                      onChange={(e) => handleInvoiceChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-slate-400"
                    >
                      <option value="">-- Choose Purchase Invoice --</option>
                      {filteredInvoices.map(pi => (
                        <option key={pi.id} value={pi.id}>
                          {pi.piNumber} (${pi.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}) - Due {pi.dueDate}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Payment Details */}
              {formInvoiceId && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                        Settle Date
                      </label>
                      <input
                        type="date"
                        value={formPaymentDate}
                        onChange={(e) => setFormPaymentDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-slate-400"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                        Payment Method
                      </label>
                      <select
                        value={formPaymentMethod}
                        onChange={(e) => setFormPaymentMethod(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-slate-400"
                        required
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Settlement Amount Paid ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold focus:outline-none focus:border-slate-400 font-mono text-slate-900"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Remarks / Transit Info
                    </label>
                    <textarea
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Payment advice number, voucher receipt code, etc..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Bottom Submit controls */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formInvoiceId}
                  className="px-4 py-2 bg-slate-950 text-white rounded-lg hover:bg-slate-800 text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Submitting...' : 'SAVE & SUBMIT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL AUDIT DRAWER */}
      {isDetailOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" onClick={() => setIsDetailOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-screen shadow-xl flex flex-col animate-slide-in">
            {/* Header info */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="px-2 py-0.5 bg-indigo-100 border border-indigo-250 rounded text-[9px] uppercase tracking-wider font-mono text-indigo-700 font-bold block w-fit">
                  SETTLEMENT LOG
                </span>
                <h2 className="text-base font-extrabold text-slate-900 mt-1 font-sans">{selectedPayment.paymentNumber}</h2>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-3 font-mono text-[11px] text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-sans font-bold text-[9px]">Settle Date:</span>
                  <span className="text-slate-900 font-semibold">{selectedPayment.paymentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-sans font-bold text-[9px]">Method:</span>
                  <span className="text-slate-900 font-bold uppercase">{selectedPayment.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-sans font-bold text-[9px]">Ref Invoice:</span>
                  <span className="text-blue-600 font-bold">{selectedPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-sans font-bold text-[9px]">Supplier Vendor:</span>
                  <span className="text-slate-900 font-semibold truncate max-w-[200px]">{selectedPayment.supplierName}</span>
                </div>
                <div className="pt-2 border-t border-slate-200/50 flex justify-between items-baseline font-sans">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Settled Sum:</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    ${selectedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedPayment.remarks && (
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Remarks / Settlement details</span>
                  <p className="bg-slate-50 text-slate-700 p-3 rounded-lg border border-slate-150 text-xs font-semibold whitespace-pre-wrap">
                    {selectedPayment.remarks}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-150 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                CLOSE VIEW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
