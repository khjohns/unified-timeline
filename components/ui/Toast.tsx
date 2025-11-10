import React from 'react';
import { CheckIcon } from './icons';

interface ToastProps {
  message: string;
}

const Toast: React.FC<ToastProps> = ({ message }) => {
  return (
    <div
      className="fixed bottom-5 right-5 flex items-center gap-3 bg-pri-600 text-white py-2 px-4 rounded-lg shadow-lg transition-all duration-300 ease-in-out transform animate-fade-in-up"
      role="alert"
      aria-live="assertive"
    >
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
      <CheckIcon className="w-5 h-5" />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
