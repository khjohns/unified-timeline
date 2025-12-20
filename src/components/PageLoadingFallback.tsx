import { ReloadIcon } from '@radix-ui/react-icons';

/**
 * Loading fallback for lazy-loaded pages.
 * Shows a centered spinner while page code is being fetched.
 */
export function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <ReloadIcon className="w-8 h-8 animate-spin text-pkt-brand-purple-1000" />
        <p className="text-sm text-pkt-text-body-default">Laster...</p>
      </div>
    </div>
  );
}
