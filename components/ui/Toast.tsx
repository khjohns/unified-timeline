import React from 'react';
import { PktAlert } from '@oslokommune/punkt-react';

interface ToastProps {
  message: string;
  skin?: 'info' | 'success' | 'warning' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, skin }) => {
  // Auto-detect skin based on message content if not provided
  const determineSkin = (): 'info' | 'success' | 'warning' | 'error' => {
    if (skin) return skin;

    const lowerMessage = message.toLowerCase();

    // Error indicators
    if (lowerMessage.includes('feil') || lowerMessage.includes('error')) {
      return 'error';
    }

    // Success indicators
    if (lowerMessage.includes('validert') ||
        lowerMessage.includes('lagret') ||
        lowerMessage.includes('sendt') ||
        lowerMessage.includes('lastet')) {
      return 'success';
    }

    // Warning indicators
    if (lowerMessage.includes('advarsel') || lowerMessage.includes('warning')) {
      return 'warning';
    }

    // Default to info
    return 'info';
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md animate-fade-in-up">
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
      <PktAlert
        skin={determineSkin()}
        compact
        role="status"
        aria-live="polite"
      >
        {message}
      </PktAlert>
    </div>
  );
};

export default Toast;
