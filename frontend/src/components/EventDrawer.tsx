import React, { useEffect } from 'react';
import { X, Layers, Clock, Hash, Tag } from 'lucide-react';
import type { TraceEvent } from '../types';
import { JsonViewer } from './common/JsonViewer';

interface EventDrawerProps {
  event: TraceEvent | null;
  onClose: () => void;
}

export const EventDrawer: React.FC<EventDrawerProps> = ({ event, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">
            <Layers size={20} color="var(--accent-cyan)" />
            <span>Event #{event.sequence}: {event.name}</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Metadata quick stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              background: 'var(--bg-main)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Hash size={14} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-secondary)' }}>Event ID:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {event.id}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={14} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-secondary)' }}>Type:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {event.type}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2' }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-secondary)' }}>Timestamp:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {event.timestamp}
              </strong>
            </div>
          </div>

          {/* Input payload */}
          <div>
            <JsonViewer title="Event Input Payload" data={event.input} />
          </div>

          {/* Output payload */}
          <div>
            <JsonViewer title="Event Output Payload" data={event.output} />
          </div>

          {/* Metadata */}
          <div>
            <JsonViewer title="Runtime Metadata" data={event.metadata} />
          </div>
        </div>
      </div>
    </div>
  );
};
