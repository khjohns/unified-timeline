import React from 'react';
import { PktAlert } from '@oslokommune/punkt-react';

interface ToastProps {
  message: string;
}

const Toast: React.FC<ToastProps> = ({ message }) => {
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
        skin="success"
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
