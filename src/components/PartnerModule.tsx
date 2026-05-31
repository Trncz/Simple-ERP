/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Customer, Supplier, PaginatedResponse } from '../types';
import { Users, Truck, Plus, Search, Edit, Trash2, ArrowLeft, ArrowRight, X, Check } from 'lucide-react';

interface PartnerModuleProps {
  authToken: string;
  initialType: 'customer' | 'supplier';
  showToast: (msg: string, status: 'success' | 'error') => void;
}

export default function PartnerModule({ authToken, initialType, showToast }: PartnerModuleProps) {
  const [partnerType, setPartnerType] = useState<'customer' | 'supplier'>(initialType);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Unified Data States
  const [customerData, setCustomerData] = useState<PaginatedResponse<Customer> | null>(null);
  const [supplierData, setSupplierData] = useState<PaginatedResponse<Supplier> | null>(null);

  // Form Drawer States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Customer | Supplier | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState('');

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search
      });

      const endpoint = partnerType === 'customer' ? '/api/customers' : '/api/suppliers';
      const response = await fetch(`${endpoint}?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error(`Could not access ${partnerType} records`);
      const data = await response.json();

      if (partnerType === 'customer') {
        setCustomerData(data);
      } else {
        setSupplierData(data);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error pulling directory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [partnerType, page, search]);

  const handleTabChange = (type: 'customer' | 'supplier') => {
    setPartnerType(type);
    setSearch('');
    setPage(1);
  };

  const handleOpenForm = (partner: Customer | Supplier | null = null) => {
    if (partner) {
      setEditingPartner(partner);
      setName(partner.name);
      setEmail(partner.email || '');
      setPhone(partner.phone || '');
      setAddress(partner.address || '');
    } else {
      setEditingPartner(null);
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setFormError('Partner Name is required.');
      return;
    }

    try {
      const isEdit = !!editingPartner;
      const baseEndpoint = partnerType === 'customer' ? '/api/customers' : '/api/suppliers';
      const url = isEdit ? `${baseEndpoint}/${editingPartner.id}` : baseEndpoint;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ name, email, phone, address })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Server rejected directory updates');
      }

      showToast(
        `${partnerType === 'customer' ? 'Customer' : 'Supplier'} [${name}] has been ${isEdit ? 'updated' : 'registered'}!`,
        'success'
      );
      setIsFormOpen(false);
      fetchPartners();
    } catch (err: any) {
      setFormError(err?.message || 'Handshake failed during data entry.');
    }
  };

  const handleDeletePartner = async (id: string, partnerName: string) => {
    try {
      const baseEndpoint = partnerType === 'customer' ? '/api/customers' : '/api/suppliers';
      const response = await fetch(`${baseEndpoint}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Deletion rejected: Partner is associated with active invoices/orders');
      
      showToast(`Partner "${partnerName}" successfully decommissioned.`, 'success');
      fetchPartners();
    } catch (err: any) {
      showToast(err?.message || 'Error executing deletion command.', 'error');
    }
  };

  const currentDataset = partnerType === 'customer' ? customerData : supplierData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 font-sans">Corporate Directory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain active partnerships, contact records, accounts, and primary shipping/billing destination terminals.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold self-start shadow-xs transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>REGISTER NEW {partnerType.toUpperCase()}</span>
        </button>
      </div>

      {/* Selector Tabs Toggle */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start w-fit">
        <button
          onClick={() => handleTabChange('customer')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            partnerType === 'customer'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Customers</span>
        </button>
        <button
          onClick={() => handleTabChange('supplier')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            partnerType === 'supplier'
              ? 'bg-white text-slate-900 shadow-sm font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>Suppliers / Vendors</span>
        </button>
      </div>

      {/* Directory Searches */}
      <div className="relative max-w-md">
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
          placeholder={`Search ${partnerType} names, contact emails, lines...`}
          className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
        />
      </div>

      {/* Directory Tables */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Partner Name</th>
                <th className="py-3 px-5">Contact Email</th>
                <th className="py-3 px-5">Phone Line</th>
                <th className="py-3 px-5">Physical Address / Terminal</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Loading database profiles...
                  </td>
                </tr>
              ) : !currentDataset || currentDataset.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-xs text-slate-400">
                    No registered {partnerType === 'customer' ? 'customers' : 'suppliers'} found.
                  </td>
                </tr>
              ) : (
                currentDataset.data.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-900">
                      {partner.name}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600 font-mono">
                      {partner.email || <span className="text-slate-300">N/A</span>}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600 font-mono">
                      {partner.phone || <span className="text-slate-300">N/A</span>}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-500 max-w-sm truncate">
                      {partner.address || <span className="text-slate-300">N/A</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenForm(partner)}
                          className="p-1 px-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-[10px] font-semibold flex items-center gap-1 font-mono transition-colors"
                        >
                          <Edit className="h-3 w-3" />
                          <span>EDIT</span>
                        </button>
                        <button
                          onClick={() => handleDeletePartner(partner.id, partner.name)}
                          className="p-1 px-2 rounded-md hover:bg-rose-50 text-rose-500 hover:text-rose-700 text-[10px] font-semibold flex items-center gap-1 font-mono transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>DEL</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {currentDataset && currentDataset.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50">
            <span className="text-[10px] text-slate-500 font-mono">
              PAGE {currentDataset.page} OF {currentDataset.pages} ({currentDataset.total} TOTAL)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentDataset.page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2 text-[10px] font-mono font-bold bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>PREV</span>
              </button>
              <button
                disabled={currentDataset.page >= currentDataset.pages}
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

      {/* Side-Drawer form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-sm h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-950 font-sans tracking-tight uppercase">
                  {editingPartner ? `Modify ${partnerType}` : `Register ${partnerType}`}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="rounded-md bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600">
                  {formError}
                </div>
              )}

              <form className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Corporate Account Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Components LLC"
                    className="w-full bg-slate-50 border border-slate-200 px-3/5 py-2 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@acme.com"
                    className="w-full bg-slate-50 border border-slate-200 px-3/5 py-2 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Contact Telephone / Dial Line
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 782-9900"
                    className="w-full bg-slate-50 border border-slate-200 px-3/5 py-2 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Physical Delivery Address / Terminal
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={4}
                    placeholder="Provide full loading dock addresses, building numbers, and postal indicators..."
                    className="w-full bg-slate-50 border border-slate-200 px-3/5 py-2 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400"
                  />
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg font-mono transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSavePartner}
                className="px-4 py-2 bg-slate-950 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>SAVE CHANGES</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
