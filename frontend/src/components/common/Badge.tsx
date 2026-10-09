import React from 'react';
import type { RunStatus, TraceEventType } from '../../types';

interface BadgeProps {
  variant?: 'status' | 'event' | 'scenario' | 'replay';
  status?: RunStatus;
  eventType?: TraceEventType;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'status', status, eventType, children }) => {
  if (variant === 'status' && status) {
    const classMap: Record<RunStatus, string> = {
      completed: 'badge badge-completed',
      running: 'badge badge-running',
      failed: 'badge badge-failed'
    };
    return <span className={classMap[status] || 'badge'}>{status}</span>;
  }

  if (variant === 'event' && eventType) {
    return <span className={`badge badge-event badge-${eventType}`}>{eventType}</span>;
  }

  if (variant === 'scenario') {
    return <span className="badge badge-scenario">{children}</span>;
  }

  if (variant === 'replay') {
    return <span className="badge badge-replay">{children}</span>;
  }

  return <span className="badge">{children}</span>;
};
