import React, { useState, useRef, useEffect } from 'react';

export interface MultiSelectOption {
  id: string;
  name: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const isAllSelected = selectedIds.length === 0;

  // Display text logic
  let displayText = `Todas ${label}`;
  if (selectedIds.length > 0) {
    if (selectedIds.length === options.length) {
      displayText = `Todas ${label}`;
    } else if (selectedIds.length === 1) {
      const selected = options.find((o) => o.id === selectedIds[0]);
      displayText = selected ? selected.name : `${selectedIds.length} ${label}`;
    } else {
      displayText = `${selectedIds.length} ${label}`;
    }
  }

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative font-['Manrope',sans-serif]" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`h-8 px-2.5 rounded-lg border flex items-center justify-between gap-1.5 text-xs font-bold min-w-[130px] transition-all ${
          disabled
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-gray-800/40 dark:border-gray-800'
            : selectedIds.length > 0
            ? 'bg-emerald-50 text-[#11d493] border-[#11d493]/40 dark:bg-[#11d493]/10 dark:border-[#11d493]/50'
            : 'bg-white dark:bg-[#10221c] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1a2e28]'
        }`}
      >
        <span className="truncate max-w-[120px]">{displayText}</span>
        <span className="material-symbols-outlined text-[14px] shrink-0 text-gray-400">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-white dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[120] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Busca interna se tiver mais de 5 itens */}
          {options.length > 5 && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Buscar em ${label}...`}
                className="w-full text-xs px-2 py-1 rounded bg-gray-50 dark:bg-[#1a2e28] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-[#11d493]"
                autoFocus
              />
            </div>
          )}

          {/* Opção "Todas" */}
          <div className="p-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/30">
            <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => onChange([])}
                className="rounded border-gray-300 dark:border-gray-600 text-[#11d493] focus:ring-[#11d493] accent-[#11d493]"
              />
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                Todas (Sem filtro)
              </span>
            </label>
          </div>

          {/* Lista de Opções */}
          <div className="max-h-52 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
            {filteredOptions.map((opt) => {
              const isChecked = selectedIds.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-emerald-50/60 dark:bg-[#11d493]/10 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-xs'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(opt.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-[#11d493] focus:ring-[#11d493] accent-[#11d493]"
                  />
                  <span className="truncate text-xs">{opt.name}</span>
                </label>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="p-3 text-[11px] text-gray-400 italic text-center">
                Nenhum item encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
