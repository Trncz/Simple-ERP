/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Item, PaginatedResponse } from '../types';
import { Search, Plus, Edit, Trash2, ArrowLeft, ArrowRight, X, Sparkles, Check, Scale } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface ItemModuleProps {
  authToken: string;
  showToast: (msg: string, status: 'success' | 'error') => void;
}

export default function ItemModule({ authToken, showToast }: ItemModuleProps) {
  const [itemsData, setItemsData] = useState<PaginatedResponse<Item> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Master Item Units States
  const [masterUnits, setMasterUnits] = useState<{ value: string; label: string }[]>(() => {
    const saved = localStorage.getItem('apex_erp_master_units');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'set', label: 'Set (set)' },
      { value: 'kg', label: 'Kilograms (kg)' },
      { value: 'box', label: 'Box (box)' },
      { value: 'ltr', label: 'Liters (ltr)' },
      { value: 'meter', label: 'Meters (m)' },
      { value: 'pack', label: 'Pack (pack)' },
      { value: 'roll', label: 'Roll (roll)' }
    ];
  });

  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [unitFormError, setUnitFormError] = useState('');

  const saveMasterUnits = (unitsList: { value: string; label: string }[]) => {
    setMasterUnits(unitsList);
    localStorage.setItem('apex_erp_master_units', JSON.stringify(unitsList));
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newUnitCode.trim().toLowerCase();
    const cleanLabel = newUnitLabel.trim();

    if (!cleanCode || !cleanLabel) {
      setUnitFormError('Both Unit Code and Unit Name are required.');
      return;
    }

    if (masterUnits.some(u => u.value === cleanCode)) {
      setUnitFormError(`Unit with abbreviation "${cleanCode}" already exists.`);
      return;
    }

    const updated = [...masterUnits, { value: cleanCode, label: `${cleanLabel} (${cleanCode})` }];
    saveMasterUnits(updated);
    setNewUnitCode('');
    setNewUnitLabel('');
    setUnitFormError('');
    showToast(`Master Unit "${cleanLabel}" added successfully!`, 'success');
  };

  const handleDeleteUnit = (valueToDelete: string) => {
    const updated = masterUnits.filter(u => u.value !== valueToDelete);
    saveMasterUnits(updated);
    showToast(`Master Unit removed.`, 'success');
  };

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [defaultPrice, setDefaultPrice] = useState('0');
  const [defaultCost, setDefaultCost] = useState('0');
  const [formError, setFormError] = useState('');

  const fetchItems = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search
      });
      const response = await fetch(`/api/items?${queryParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve items database');
      const data = await response.json();
      setItemsData(data);
    } catch (err: any) {
      showToast(err?.message || 'Error loading items roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [page, search]);

  const handleOpenForm = (item: Item | null = null) => {
    if (item) {
      setEditingItem(item);
      setCode(item.code);
      setName(item.name);
      setDescription(item.description || '');
      setUnit(item.unit);
      setDefaultPrice(item.defaultPrice.toString());
      setDefaultCost(item.defaultCost.toString());
    } else {
      setEditingItem(null);
      setCode(dbNextCodeSuggestion());
      setName('');
      setDescription('');
      setUnit('pcs');
      setDefaultPrice('0');
      setDefaultCost('0');
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const dbNextCodeSuggestion = () => {
    if (!itemsData || itemsData.data.length === 0) return 'PROD-006';
    const nums = itemsData.data
      .map(i => parseInt(i.code.replace('PROD-', ''), 10))
      .filter(n => !isNaN(n));
    if (nums.length === 0) return 'PROD-006';
    const max = Math.max(...nums);
    return `PROD-${(max + 1).toString().padStart(3, '0')}`;
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      setFormError('Item Code and Name are mandatory.');
      return;
    }

    try {
      const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          code,
          name,
          description,
          unit,
          defaultPrice: Number(defaultPrice) || 0,
          defaultCost: Number(defaultCost) || 0
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Server rejected item payload');
      }

      showToast(`Product [${code}] ${editingItem ? 'modified' : 'integrated'} successfully!`, 'success');
      setIsFormOpen(false);
      fetchItems();
    } catch (error: any) {
      setFormError(error?.message || 'Execution error during operations');
    }
  };

  const handleDeleteItem = async (id: string, codeStr: string) => {
    try {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Deletion failed (linked to orders or invoices)');
      showToast(`Product ${codeStr} removed from roster.`, 'success');
      fetchItems();
    } catch (error: any) {
      showToast(error?.message || 'Failed to remove product from master data.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 font-sans">Item & Product Registry</h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain catalog names, units of measure, default market sale rates, and internal cost profiles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsUnitsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold self-start tracking-wide shadow-2xs transition-colors"
          >
            <Scale className="h-4 w-4 text-slate-500" />
            <span>MANAGE MASTER UNITS</span>
          </button>
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold self-start tracking-wide shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>ADD NEW PRODUCT</span>
          </button>
        </div>
      </div>

      {/* Roster Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative flex-1 max-w-md">
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
            placeholder="Search item code, catalog descriptors, tags..."
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
          />
        </div>
      </div>

      {/* Master Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                <th className="py-3 px-5">Item Code</th>
                <th className="py-3 px-5">Product Details</th>
                <th className="py-3 px-5">Unit</th>
                <th className="py-3 px-5 text-right">Default Cost</th>
                <th className="py-3 px-5 text-right">Selling Price</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 font-mono text-[10px] text-slate-400 uppercase">
                    Loading telemetry records...
                  </td>
                </tr>
              ) : !itemsData || itemsData.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs text-slate-400">
                    No items match search parameters. Create one to begin.
                  </td>
                </tr>
              ) : (
                itemsData.data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {item.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{item.name}</div>
                        {item.description && (
                          <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate leading-normal">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-500 font-mono">{item.unit}</td>
                    <td className="py-3.5 px-5 text-xs text-slate-700 text-right font-mono">${item.defaultCost.toFixed(2)}</td>
                    <td className="py-3.5 px-5 text-xs text-slate-700 text-right font-mono">${item.defaultPrice.toFixed(2)}</td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="p-1 px-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-[10px] font-semibold flex items-center gap-1 font-mono transition-colors"
                        >
                          <Edit className="h-3 w-3" />
                          <span>EDIT</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id, item.code)}
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

        {/* Pagination Controls */}
        {itemsData && itemsData.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 bg-slate-50">
            <span className="text-[10px] text-slate-500 font-mono">
              PAGE {itemsData.page} OF {itemsData.pages} ({itemsData.total} TOTAL)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={itemsData.page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 px-2 text-[10px] font-mono font-bold bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>PREV</span>
              </button>
              <button
                disabled={itemsData.page >= itemsData.pages}
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

      {/* Side-Drawer Modal for item creation and changes */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity">
          <div className="w-full max-w-md h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-950 font-sans tracking-tight uppercase">
                  {editingItem ? 'Edit Product File' : 'Catalogue Integration'}
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
                    Item / SKU Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PROD-109"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Product / Brand Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pneumatic Seal Block"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                    Catalog Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Outline product attributes, dimensions, compatibility specs..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Unit
                    </label>
                    <SearchableSelect
                      options={[
                        ...masterUnits,
                        ...(unit && !masterUnits.some(u => u.value === unit) ? [{ value: unit, label: `${unit} (${unit})` }] : [])
                      ]}
                      value={unit}
                      onChange={(val) => setUnit(val)}
                      placeholder="Select unit..."
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Def. Cost ($)
                    </label>
                    <input
                      type="number"
                      value={defaultCost}
                      onChange={(e) => setDefaultCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Sale Price ($)
                    </label>
                    <input
                      type="number"
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
                    />
                  </div>
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
                onClick={handleSaveItem}
                className="px-4 py-2 bg-slate-950 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>SAVE CHANGES</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-Drawer Modal for master units management */}
      {isUnitsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 transition-opacity animate-fade-in">
          <div className="w-full max-w-sm h-screen bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-slate-100 animate-slide-in">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-slate-800" />
                  <h3 className="text-xs font-bold text-slate-950 font-sans tracking-tight uppercase">
                    Master Unit Ledger
                  </h3>
                </div>
                <button
                  onClick={() => setIsUnitsModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {unitFormError && (
                <div className="rounded-md bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600">
                  {unitFormError}
                </div>
              )}

              {/* Add Unit Form */}
              <form onSubmit={handleAddUnit} className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3.5">
                <h4 className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase font-mono">
                  Create Master Unit
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[8px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Unit Code (Abbr)
                    </label>
                    <input
                      type="text"
                      value={newUnitCode}
                      onChange={(e) => setNewUnitCode(e.target.value)}
                      placeholder="e.g. box, kgs"
                      className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs text-slate-850 font-mono focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold tracking-wider text-slate-400 uppercase font-mono mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={newUnitLabel}
                      onChange={(e) => setNewUnitLabel(e.target.value)}
                      placeholder="e.g. Cardboard Box"
                      className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold tracking-wide transition-colors font-mono"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>ADD TO MASTER LIST</span>
                </button>
              </form>

              {/* Units List */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase font-mono">
                  Registered Master Units
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                  {masterUnits.map((u) => (
                    <div key={u.value} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800">
                          {u.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 border border-slate-100 px-1 py-0.2 rounded w-max">
                          value: {u.value}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u.value)}
                        className="p-1 px-2 text-[10px] font-mono font-bold hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded transition-colors"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsUnitsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors font-mono"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
