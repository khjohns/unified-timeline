/**
 * BimCard - BIM link display card for bento case page.
 *
 * Shows which disciplines/models are linked to a case.
 * Allows adding and removing BIM links via fag chips.
 */

import { useState } from 'react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { useBimLinks, useBimModels, useCreateBimLink, useDeleteBimLink } from '../../hooks/useBimLinks';
import type { BimLink, CatendaModel } from '../../types/timeline';

interface BimCardProps {
  sakId: string;
  className?: string;
}

/** Color mapping for discipline chips */
const fagColors: Record<string, string> = {
  ARK: 'bg-blue-50 text-blue-700 border-blue-200',
  RIB: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VVS: 'bg-orange-50 text-orange-700 border-orange-200',
  LARK: 'bg-lime-50 text-lime-700 border-lime-200',
};

const defaultFagColor = 'bg-gray-50 text-gray-700 border-gray-200';

function getFagColor(fag: string): string {
  return fagColors[fag] || defaultFagColor;
}

/** Group BIM links by fag */
function groupByFag(links: BimLink[]): Map<string, BimLink[]> {
  const groups = new Map<string, BimLink[]>();
  for (const link of links) {
    const existing = groups.get(link.fag);
    if (existing) {
      existing.push(link);
    } else {
      groups.set(link.fag, [link]);
    }
  }
  return groups;
}

/** Get available fag options from cached models, excluding already linked ones */
function getAvailableFag(models: CatendaModel[], existingLinks: BimLink[]): string[] {
  const linkedFag = new Set(existingLinks.map((l) => l.fag));
  const modelFag = new Set(models.map((m) => m.fag).filter(Boolean) as string[]);
  return [...modelFag].filter((f) => !linkedFag.has(f)).sort();
}

export function BimCard({ sakId, className }: BimCardProps) {
  const { data: links = [], isLoading } = useBimLinks(sakId);
  const { data: models = [] } = useBimModels();
  const createLink = useCreateBimLink(sakId);
  const deleteLink = useDeleteBimLink(sakId);
  const [showAdd, setShowAdd] = useState(false);

  const grouped = groupByFag(links);
  const availableFag = getAvailableFag(models, links);

  const handleAddFag = (fag: string) => {
    // Find models for this fag to include model info
    const fagModels = models.filter((m) => m.fag === fag);
    const singleModel = fagModels.length === 1 ? fagModels[0] : undefined;
    if (singleModel) {
      createLink.mutate({
        fag,
        model_id: singleModel.model_id,
        model_name: singleModel.model_name,
      });
    } else {
      // Multiple models or no models — link at fag level
      createLink.mutate({ fag });
    }
    setShowAdd(false);
  };

  const handleDelete = (linkId: number) => {
    deleteLink.mutate(linkId);
  };

  if (isLoading) {
    return (
      <div className={clsx('bg-pkt-bg-card rounded-lg p-3', className)}>
        <div className="h-4 w-24 bg-pkt-bg-subtle rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={clsx('bg-pkt-bg-card rounded-lg p-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-pkt-text-body-subtle">
          BIM-kobling
        </span>
        {availableFag.length > 0 && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-0.5 text-[10px] font-medium text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            Legg til
          </button>
        )}
      </div>

      {/* Add dropdown */}
      {showAdd && (
        <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-pkt-bg-subtle rounded-md">
          {availableFag.map((fag) => (
            <button
              key={fag}
              onClick={() => handleAddFag(fag)}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
                'hover:scale-105 hover:shadow-sm cursor-pointer',
                getFagColor(fag),
              )}
            >
              + {fag}
            </button>
          ))}
        </div>
      )}

      {/* Fag chips */}
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {[...grouped.entries()].map(([fag, fagLinks]) => {
            const first = fagLinks[0];
            return (
              <span
                key={fag}
                className={clsx(
                  'group/chip inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
                  getFagColor(fag),
                )}
              >
                <span>{fag}</span>
                {first.model_name && (
                  <span className="opacity-60 font-normal">
                    {first.model_name}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(first.id)}
                  className="ml-0.5 opacity-0 group-hover/chip:opacity-60 hover:!opacity-100 transition-opacity"
                  aria-label={`Fjern ${fag}`}
                >
                  <Cross2Icon className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-pkt-text-body-subtle italic">
          Ingen modeller koblet
        </p>
      )}
    </div>
  );
}
