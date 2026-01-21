/**
 * Footer Component
 *
 * Displays copyright, privacy policy link, and cookie information.
 * Required for GDPR compliance and good practice.
 */

import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-pkt-border-subtle bg-pkt-bg-subtle py-4 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-pkt-grays-gray-600">
        <p>&copy; {currentYear} Oslobygg KF. Alle rettigheter reservert.</p>
        <nav className="flex items-center gap-4">
          <Link
            to="/personvern"
            className="hover:text-pkt-brand-warm-blue-1000 hover:underline transition-colors"
          >
            Personvernerklæring
          </Link>
          <span className="text-pkt-grays-gray-300">|</span>
          <Link
            to="/cookies"
            className="hover:text-pkt-brand-warm-blue-1000 hover:underline transition-colors"
          >
            Informasjonskapsler
          </Link>
        </nav>
      </div>
    </footer>
  );
}
