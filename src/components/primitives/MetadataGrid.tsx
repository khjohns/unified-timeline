/**
 * MetadataGrid Component
 *
 * Reusable grid component for displaying metadata in a clean, organized format.
 * Similar to legacy TestOversiktPanel grid but modernized.
 */

interface MetadataGridProps {
  children: React.ReactNode;
}

export function MetadataGrid({ children }: MetadataGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(150px,auto)_1fr_minmax(150px,auto)_1fr] border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
      {children}
    </div>
  );
}

interface GridItemProps {
  label: string;
  value: React.ReactNode;
  span?: boolean; // Span across 3 columns
}

export function GridItem({ label, value, span = false }: GridItemProps) {
  return (
    <>
      <div className="bg-gray-50 px-4 py-3 font-medium text-gray-700 border-b md:border-b-0 md:border-r border-gray-300 flex items-center text-sm">
        {label}
      </div>
      <div
        className={`px-4 py-3 border-b border-gray-300 md:border-b-0 flex items-center text-sm ${
          span ? 'md:col-span-3' : 'md:border-r'
        }`}
      >
        {value || '—'}
      </div>
    </>
  );
}

export function GridDivider() {
  return <div className="col-span-1 md:col-span-4 h-px bg-gray-300 hidden md:block" />;
}
