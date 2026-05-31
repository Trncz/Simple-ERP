/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className = '',
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    } else {
      setHighlightedIndex(0);
      // Give browser a microtask to autoFocus the input field
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 30);
    }
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);

  const filteredOptions = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Reset highlighted index when searching
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Handle automatic scroll of list when navigating via arrow keys
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        const listHeight = listRef.current.clientHeight;
        const itemTop = activeEl.offsetTop;
        const itemHeight = activeEl.clientHeight;
        const currentScroll = listRef.current.scrollTop;

        if (itemTop < currentScroll) {
          listRef.current.scrollTop = itemTop;
        } else if (itemTop + itemHeight > currentScroll + listHeight) {
          listRef.current.scrollTop = itemTop + itemHeight - listHeight;
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setTimeout(() => {
      if (toggleRef.current) {
        toggleRef.current.focus();
      }
    }, 50);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(prev => 
          filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(prev => 
          filteredOptions.length > 0 
            ? (prev - 1 + filteredOptions.length) % filteredOptions.length 
            : 0
        );
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setTimeout(() => {
          if (toggleRef.current) {
            toggleRef.current.focus();
          }
        }, 50);
        break;
      case 'Tab':
        // Let natural layout navigation happen but close the dropdown
        setIsOpen(false);
        break;
      default:
        // Let standard characters propagate for search typing
        break;
    }
  };

  return (
    <div 
      ref={wrapperRef} 
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={toggleRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-800 hover:border-slate-300 focus:outline-none focus:border-slate-400 text-left transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 leading-none shrink-0" />
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col p-2 max-h-60 overflow-hidden min-w-[200px]"
        >
          {/* Search bar */}
          <div className="relative mb-1.5 flex items-center shrink-0">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Ensure arrow keys or enter pressed inside the input are handled correctly
                if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyDown(e);
                }
              }}
              placeholder="Search..."
              className="w-full bg-slate-50 border border-slate-200 pl-8 pr-7 py-1.5 rounded text-xs focus:outline-none focus:border-slate-300"
            />
            {search && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch('');
                  if (inputRef.current) inputRef.current.focus();
                }}
                className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div 
            ref={listRef}
            className="overflow-y-auto max-h-44 text-xs"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-2.5 px-3 text-slate-400 text-center italic font-sans select-none">
                No matches found
              </div>
            ) : (
              filteredOptions.map((o, idx) => {
                const isSelected = o.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(o.value);
                    }}
                    className={`w-full text-left py-1.5 px-2.5 rounded transition-colors text-xs font-semibold block truncate ${
                      isHighlighted 
                        ? (isSelected ? 'bg-blue-600 text-white font-bold font-sans' : 'bg-slate-100 text-slate-900')
                        : (isSelected ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600')
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
