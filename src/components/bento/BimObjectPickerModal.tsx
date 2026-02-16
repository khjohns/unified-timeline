import { useState, useRef, useMemo, useCallback } from 'react';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { Modal } from '../primitives/Modal';
import { useIfcTypeSummary, useIfcProducts, useCreateBimLink } from '../../hooks/useBimLinks';
import type { IfcProductItem } from '../../types/timeline';

interface BimObjectPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

const PAGE_SIZE = 20;

export function BimObjectPickerModal({ open, onOpenChange, sakId }: BimObjectPickerModalProps) {
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Map<number, IfcProductItem>>(new Map());

  const { data: typesData } = useIfcTypeSummary();
  const { data: productsData, isLoading } = useIfcProducts({
    ifcType: selectedType,
    search: debouncedSearch,
    page,
  });

  const createLink = useCreateBimLink(sakId);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // Sort types by count descending
  const sortedTypes = useMemo(() => {
    if (!typesData?.types) return [];
    return Object.entries(typesData.types)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15); // Top 15 types
  }, [typesData]);

  const totalPages = productsData ? Math.ceil(productsData.total / PAGE_SIZE) : 0;

  const toggleSelect = (item: IfcProductItem) => {
    setSelectedIds((prev) => {
      const next = new Map(prev);
      if (next.has(item.object_id)) {
        next.delete(item.object_id);
      } else {
        next.set(item.object_id, item);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    for (const item of selectedIds.values()) {
      createLink.mutate({
        fag: item.fag || 'Ukjent',
        object_id: item.object_id,
        object_global_id: item.global_id,
        object_name: item.name ?? undefined,
        object_ifc_type: item.ifc_type ?? undefined,
      });
    }
    setSelectedIds(new Map());
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Velg BIM-objekt" size="lg">
      <div className="space-y-3">
        {/* IFC type pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { setSelectedType(undefined); setPage(1); }}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
              !selectedType
                ? 'bg-pkt-brand-dark-blue-1000 text-white border-transparent'
                : 'text-pkt-text-body-subtle border-pkt-border-default hover:bg-pkt-bg-subtle',
            )}
          >
            Alle
          </button>
          {sortedTypes.map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => { setSelectedType(type); setPage(1); }}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                selectedType === type
                  ? 'bg-pkt-brand-dark-blue-1000 text-white border-transparent'
                  : 'text-pkt-text-body-subtle border-pkt-border-default hover:bg-pkt-bg-subtle',
              )}
            >
              {type.replace('Ifc', '')} <span className="opacity-60 tabular-nums">{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pkt-text-body-subtle pointer-events-none" />
          <input
            type="text"
            placeholder="Sok pa navn eller GlobalId..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-pkt-bg-subtle border border-transparent focus:border-pkt-border-default focus:outline-none"
          />
        </div>

        {/* Object table */}
        <div className="min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="h-5 w-5 border-2 border-pkt-text-body-subtle/30 border-t-pkt-text-body-subtle rounded-full animate-spin" />
            </div>
          ) : productsData?.items.length === 0 ? (
            <p className="text-xs text-pkt-text-body-subtle italic text-center py-12">
              Ingen objekter funnet
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-pkt-text-body-subtle border-b border-pkt-border-default">
                  <th className="pb-1.5 w-8"></th>
                  <th className="pb-1.5">Navn</th>
                  <th className="pb-1.5">Type</th>
                  <th className="pb-1.5">Fag</th>
                </tr>
              </thead>
              <tbody>
                {productsData?.items.map((item) => (
                  <tr
                    key={item.object_id}
                    onClick={() => toggleSelect(item)}
                    className={clsx(
                      'border-b border-pkt-border-subtle cursor-pointer transition-colors',
                      selectedIds.has(item.object_id)
                        ? 'bg-pkt-brand-dark-blue-1000/5'
                        : 'hover:bg-pkt-bg-subtle',
                    )}
                  >
                    <td className="py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.object_id)}
                        onChange={() => toggleSelect(item)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-1.5 text-pkt-text-body-default">
                      {item.name || <span className="opacity-50">Uten navn</span>}
                    </td>
                    <td className="py-1.5 text-pkt-text-body-subtle">
                      {item.ifc_type?.replace('Ifc', '')}
                    </td>
                    <td className="py-1.5 text-pkt-text-body-subtle">
                      {item.fag || '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-pkt-text-body-subtle">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2 py-1 rounded hover:bg-pkt-bg-subtle disabled:opacity-30"
            >
              Forrige
            </button>
            <span className="tabular-nums">Side {page} av {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2 py-1 rounded hover:bg-pkt-bg-subtle disabled:opacity-30"
            >
              Neste
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-pkt-border-default">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-pkt-text-body-subtle hover:bg-pkt-bg-subtle"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || createLink.isPending}
            onClick={handleConfirm}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-pkt-brand-dark-blue-1000 text-white disabled:opacity-40"
          >
            Legg til {selectedIds.size > 0 ? `${selectedIds.size} valgte` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
