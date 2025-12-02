/**
 * TimelineItem Component
 *
 * Displays a single event in the timeline.
 * Shows timestamp, actor, event type, description, and expandable details.
 */

import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface TimelineItemProps {
  timestamp: string;
  actor: string;
  eventType: string;
  description: ReactNode;
  details?: ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}

/**
 * TimelineItem renders a single event entry in the timeline
 */
export function TimelineItem({
  timestamp,
  actor,
  eventType,
  description,
  details,
  isExpanded = false,
  onToggle,
}: TimelineItemProps) {
  return (
    <li className="relative pb-pkt-06">
      {/* Timeline connector line */}
      <div
        className="absolute left-4 top-6 bottom-0 w-0.5 bg-oslo-beige-300"
        aria-hidden="true"
      />

      <div className="flex gap-pkt-04">
        {/* Timeline dot */}
        <div
          className="relative flex-shrink-0 w-8 h-8 rounded-full bg-oslo-blue flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="w-3 h-3 rounded-full bg-white" />
        </div>

        {/* Content */}
        <div className="flex-1 pt-1">
          {/* Header: Timestamp and Actor */}
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <time
              className="text-sm font-medium text-oslo-blue"
              dateTime={timestamp}
            >
              {format(new Date(timestamp), 'PPpp', { locale: nb })}
            </time>
            <span className="text-sm text-gray-600">{actor}</span>
          </div>

          {/* Event Type */}
          <h3 className="mt-pkt-02 text-body-md font-semibold text-gray-900">
            {eventType}
          </h3>

          {/* Description */}
          <div className="mt-pkt-02 text-body-md text-gray-700">
            {description}
          </div>

          {/* Expandable Details */}
          {details && onToggle && (
            <>
              <button
                onClick={onToggle}
                className={clsx(
                  'mt-pkt-03 text-sm font-medium text-oslo-blue',
                  'hover:underline focus-visible:underline',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oslo-blue',
                  'rounded-pkt-sm px-2 py-1 -ml-2'
                )}
                aria-expanded={isExpanded}
                aria-controls={`details-${timestamp}`}
              >
                {isExpanded ? 'Skjul detaljer' : 'Vis detaljer'}
              </button>

              {isExpanded && (
                <div
                  id={`details-${timestamp}`}
                  className="mt-pkt-04 p-pkt-04 bg-oslo-beige-100 rounded-pkt-md"
                >
                  {details}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
