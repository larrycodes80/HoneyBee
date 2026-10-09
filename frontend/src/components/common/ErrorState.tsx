import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load trace data',
  message = 'An error occurred while connecting to the backend API.',
  onRetry
}) => {
  return (
    <div className="state-container" style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}>
      <div className="state-icon" style={{ color: 'var(--accent-rose)' }}>
        <AlertTriangle size={28} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          <RefreshCw size={14} /> Retry Request
        </button>
      )}
    </div>
  );
};
