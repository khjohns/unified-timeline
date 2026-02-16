/**
 * BimCard - BIM link display card for bento case page.
 *
 * Shows which disciplines/models are linked to a case.
 * Allows adding and removing BIM links via fag chips.
 */

import { Fragment, useState } from 'react';
import { ChevronDownIcon, Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { useBimLinks, useCreateBimLink, useDeleteBimLink, useRelatedBimObjects } from '../../hooks/useBimLinks';
import { BimObjectPickerModal } from './BimObjectPickerModal';
import type { BimLink, RelatedBimObject } from '../../types/timeline';

interface BimCardProps {
  sakId: string;
  className?: string;
}

/** Color mapping for discipline chips — uses badge tokens (dark mode safe) */
const fagColors: Record<string, string> = {
  ARK: 'bg-badge-info-bg text-badge-info-text border-badge-info-border',
  RIB: 'bg-badge-success-bg text-badge-success-text border-badge-success-border',
  VVS: 'bg-badge-warning-bg text-badge-warning-text border-badge-warning-border',
  LARK: 'bg-badge-danger-bg text-badge-danger-text border-badge-danger-border',
};

const defaultFagColor = 'bg-pkt-bg-subtle text-pkt-text-body-dark border-pkt-border-gray';

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

export function BimCard({ sakId, className }: BimCardProps) {
  const { data: links = [], isLoading } = useBimLinks(sakId);
  const deleteLink = useDeleteBimLink(sakId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedFag, setExpandedFag] = useState<string | null>(null);

  const grouped = groupByFag(links);

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
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-0.5 text-[10px] font-medium text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          Legg til
        </button>
      </div>

      {/* Fag chips */}
      {links.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {[...grouped.entries()].map(([fag, fagLinks]) => {
              const first = fagLinks[0] as BimLink | undefined;
              if (!first) return null;
              const isExpanded = expandedFag === fag;
              return (
                <button
                  key={fag}
                  type="button"
                  onClick={() => setExpandedFag(isExpanded ? null : fag)}
                  className={clsx(
                    'group/chip inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-all cursor-pointer',
                    isExpanded && 'ring-1 ring-current/20',
                    getFagColor(fag),
                  )}
                >
                  <span>{fag}</span>
                  {first.model_name && (
                    <span className="opacity-60 font-normal">
                      {first.model_name}
                    </span>
                  )}
                  <ChevronDownIcon
                    className={clsx(
                      'w-3 h-3 opacity-40 transition-transform duration-200',
                      isExpanded && 'rotate-180',
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Expanded detail panel */}
          {expandedFag && grouped.get(expandedFag) && (
            <BimLinkDetail
              links={grouped.get(expandedFag)!}
              fag={expandedFag}
              sakId={sakId}
              onDelete={handleDelete}
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-pkt-text-body-subtle italic">
          Ingen modeller koblet
        </p>
      )}

      <BimObjectPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        sakId={sakId}
      />
    </div>
  );
}

/** Format ISO date to compact Norwegian format */
function formatLinkedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Detail panel shown when a fag chip is expanded */
function BimLinkDetail({
  links,
  fag,
  sakId,
  onDelete,
}: {
  links: BimLink[];
  fag: string;
  sakId: string;
  onDelete: (id: number) => void;
}) {
  const createLink = useCreateBimLink(sakId);

  const handleAddRelated = (link: BimLink, obj: RelatedBimObject) => {
    createLink.mutate({
      fag: link.fag,
      object_id: obj.object_id,
      object_global_id: obj.global_id,
      object_name: obj.name ?? undefined,
      object_ifc_type: obj.ifc_type ?? undefined,
    });
  };

  return (
    <div className="rounded-md bg-pkt-bg-subtle border border-pkt-border-subtle p-2.5 space-y-3">
      {links.map((link) => (
        <div key={link.id} className="space-y-2">
          {/* Header: object name + delete */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {link.object_name ? (
                <p className="text-xs font-medium text-pkt-text-body-dark">
                  {link.object_name}
                  {link.object_ifc_type && (
                    <span className="ml-1 font-normal text-pkt-text-body-subtle">
                      {link.object_ifc_type}
                    </span>
                  )}
                </p>
              ) : link.model_name ? (
                <p className="text-xs font-medium text-pkt-text-body-dark">{link.model_name}</p>
              ) : null}
              {link.kommentar && (
                <p className="text-[11px] italic text-pkt-text-body-subtle mt-0.5">{link.kommentar}</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(link.id);
              }}
              className="shrink-0 p-0.5 rounded text-pkt-text-body-subtle opacity-40 hover:opacity-100 transition-opacity"
              aria-label={`Fjern ${fag}-kobling`}
            >
              <Cross2Icon className="w-3 h-3" />
            </button>
          </div>

          {/* IFC Properties */}
          {link.properties && <BimPropertiesView properties={link.properties} />}

          {/* Meta: who + when + GlobalId */}
          <div className="flex items-center gap-1.5 text-[10px] text-pkt-text-body-subtle">
            <span>{link.linked_by} &middot; {formatLinkedDate(link.linked_at)}</span>
            {link.object_global_id && (
              <span className="font-mono opacity-50 truncate" title={link.object_global_id}>
                {link.object_global_id}
              </span>
            )}
          </div>

          {/* Related objects suggestions */}
          {link.object_id && (
            <RelatedObjectsSuggestions
              sakId={sakId}
              link={link}
              onAdd={(obj) => handleAddRelated(link, obj)}
              isAdding={createLink.isPending}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Suggestions for related BIM objects from Catenda */
function RelatedObjectsSuggestions({
  sakId,
  link,
  onAdd,
  isAdding,
}: {
  sakId: string;
  link: BimLink;
  onAdd: (obj: RelatedBimObject) => void;
  isAdding: boolean;
}) {
  const { data, isLoading } = useRelatedBimObjects(sakId, link.id ?? undefined);
  const groups = data?.groups ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 pt-1">
        <div className="h-3 w-3 border-2 border-pkt-text-body-subtle/30 border-t-pkt-text-body-subtle rounded-full animate-spin" />
        <span className="text-[10px] text-pkt-text-body-subtle">Henter relaterte objekter...</span>
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <div className="pt-1 space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-pkt-text-body-subtle">
        Relaterte objekter
      </span>
      {groups.map((group) => (
        <div key={group.category}>
          <p className="text-[10px] text-pkt-text-body-subtle mb-1">{group.label}</p>
          <div className="flex flex-wrap gap-1">
            {group.items.map((item) => (
              <button
                key={item.object_id}
                type="button"
                disabled={isAdding}
                onClick={() => onAdd(item)}
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border transition-all',
                  'bg-pkt-bg-subtle border-pkt-border-default text-pkt-text-body-default',
                  'hover:bg-pkt-bg-default hover:shadow-sm cursor-pointer',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <PlusIcon className="w-3 h-3 opacity-60" />
                <span>{item.name ?? `#${item.object_id}`}</span>
                {item.ifc_type && (
                  <span className="opacity-50 font-normal">{item.ifc_type}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Renders IFC property sets, quantities, and materials */
function BimPropertiesView({ properties }: { properties: NonNullable<BimLink['properties']> }) {
  const { attributes, propertySets, quantitySets, materials } = properties;
  const hasContent = attributes || propertySets || quantitySets || (materials && materials.length > 0);
  if (!hasContent) return null;

  return (
    <div className="space-y-1.5 text-[11px]">
      {/* Key attributes */}
      {attributes && Object.keys(attributes).length > 0 && (
        <PropertyGroup label="Attributter" entries={attributes} />
      )}

      {/* Property Sets */}
      {propertySets && Object.entries(propertySets).map(([psetName, props]) => (
        <PropertyGroup key={psetName} label={psetName} entries={props} />
      ))}

      {/* Quantity Sets */}
      {quantitySets && Object.entries(quantitySets).map(([qsetName, quantities]) => (
        <PropertyGroup key={qsetName} label={qsetName} entries={quantities} />
      ))}

      {/* Materials */}
      {materials && materials.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-pkt-text-body-subtle">
            Materialer
          </span>
          <p className="text-pkt-text-body-default mt-0.5">
            {materials.join(' / ')}
          </p>
        </div>
      )}
    </div>
  );
}

/** A single group of key-value properties */
function PropertyGroup({ label, entries }: { label: string; entries: Record<string, string | number | boolean> }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-pkt-text-body-subtle">
        {label}
      </span>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0 mt-0.5">
        {Object.entries(entries).map(([key, val]) => (
          <Fragment key={key}>
            <span className="text-pkt-text-body-subtle">{key}</span>
            <span className="text-pkt-text-body-default">{String(val)}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
