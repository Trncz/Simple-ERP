/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Warehouse } from '../types';
import { Building, Plus, Edit, Trash2, X, Check } from 'lucide-react';

interface WarehouseModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
}

export default function WarehouseModule({ authToken, showToast }: WarehouseModuleProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [formError, setFormError] = useState('');

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/warehouses', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve warehouse locations');
      const data = await res.json();
      setWarehouses(data);
    } catch (err: any) {
      showToast(err?.message || 'Error pulling warehouse list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleOpenForm = (wh: Warehouse | null = null) => {
    if (wh) {
      setEditingWarehouse(wh);
      setName(wh.name);
      setLocation(wh.location || '');
    } else {
      setEditingWarehouse(null);
      setName('');
      setLocation('');
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setFormError('Warehouse Name is required.');
      return;
    }

    try {
      const isEdit = !!editingWarehouse;
      const url = isEdit ? `/api/warehouses/${editingWarehouse.id}` : '/api/warehouses';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ name, location })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Server rejected warehouse update');

      showToast(`Warehouse "${name}" successfully ${isEdit ? 'updated' : 'provisioned'}!`, 'success');
      setIsFormOpen(false);
      fetchWarehouses();
    } catch (error: any) {
      setFormError(error?.message || 'Connection lost during save.');
    }
  };

  const handleDeleteWarehouse = async (id: string, whName: string) => {
    try {
      const response = await fetch(`/api/warehouses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Warehouse holds stock metrics or has reference history.');
      showToast(`Warehouse facility "${whName}" deleted.`, 'success');
      fetchWarehouses();
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove warehouse location.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 font-sans">Warehouse Facilities</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure physical inventory depots, storage racks, and logistics distribution hubs.
          </p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold self-start shadow-xs transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>PROVISION SITE</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-10 text-center text-xs font-mono text-slate-400 uppercase">
            Loading terminal depots...
          </div>
        ) : warehouses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-slate-50 border border-dashed rounded-xl border-slate-200">
            No warehouses registered yet. Click &quot;Provision Site&quot; above to setup.
          </div>
        ) : (
          warehouses.map((wh) => (
            <div
              key={wh.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-3xs hover:border-slate-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <Building className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 ">{wh.name}</h3>
                </div>
                {wh.location && (
                  <p className="text-xs text-slate-500 mt-3 leading-normal pl-0.5">
                    {wh.location}
                  </p>
                )}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3/5 flex items-center justify-end gap-1.5 font-mono text-[10px]">
                <button
                  onClick={() => handleOpenForm(wh)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                >
                  EDIT
                </button>
                <button
                  onClick={() => handleDeleteWarehouse(wh.id, wh.name)}
                  className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                >
                  DELETE
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Side Form Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-sm h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 pb-8 animate-slide-in">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-950 font-sans tracking-tight uppercase">
                  {editingWarehouse ? 'Edit Facility File' : 'Establish Depot'}
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
                    Warehouse Facility Title
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Northern Regional Dock"
                    className="w-full bg-slate-50 border border-slate-200 px-3/5 py-2 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    facility location descriptors
                  </label>
                  <textarea
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    rows={4}
                    placeholder="Provide warehouse street names, box coordinates, zip levels..."
                    className="w-full bg-slate-50 border border-slate-200 px-3/5 py-2 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400"
                  />
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5 font-mono">
              <button
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-2 hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveWarehouse}
                className="px-4 py-2 bg-slate-950 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>ESTABLISH DEPOT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
