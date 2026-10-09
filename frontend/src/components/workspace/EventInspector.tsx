import React from 'react';
import { Layers, X } from 'lucide-react';
import type { TraceEvent } from '../../types';
import { JsonTree } from '../common/JsonTree';

interface EventInspectorProps {
  event: TraceEvent | null;
  onClose?: () => void;
}

export const EventInspector: React.FC<EventInspectorProps> = ({ event, onClose }) => {
  if (!event) {
    return (
      <aside className="pane-inspector">
        <div className="inspector-header">
          <div className="inspector-title">
            <Layers size={14} color="var(--text-muted)" />
            <span>Event Inspector</span>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.78rem'
          }}
        >
          Select any event row from the timeline to inspect its full payload and metadata.
        </div>
      </aside>
    );
  }

  const stepStr = String(event.sequence).padStart(2, '0');

  return (
    <aside className="pane-inspector">
      {/* Header */}
      <div className="inspector-header">
        <div className="inspector-title">
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
            #{stepStr}
          </span>
          <span>{event.name}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="wb-btn wb-btn-outline" style={{ padding: '2px 4px' }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Inspector Body */}
      <div className="inspector-body">
        {/* Core Metadata Grid */}
        <div className="inspector-meta-grid">
          <div className="meta-field">
            <span className="meta-field-label">Event ID</span>
            <span className="meta-field-value">{event.id}</span>
          </div>
          <div className="meta-field">
            <span className="meta-field-label">Type</span>
            <span className="meta-field-value" style={{ color: 'var(--accent)' }}>
              {event.type}
            </span>
          </div>
          <div className="meta-field" style={{ gridColumn: 'span 2' }}>
            <span className="meta-field-label">Timestamp</span>
            <span className="meta-field-value">{event.timestamp}</span>
          </div>
        </div>

        {/* Input / Arguments Payload */}
        <div className="inspector-section">
          <JsonTree
            title={event.type === 'tool_call' ? 'Tool Arguments' : 'Input / Model Request'}
            data={event.input}
          />
        </div>

        {/* Output / Result Payload */}
        <div className="inspector-section">
          <JsonTree
            title={event.type === 'tool_result' ? 'Tool Output' : 'Output / Response'}
            data={event.output}
          />
        </div>

        {/* Runtime Metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="inspector-section">
            <JsonTree title="Execution Metadata" data={event.metadata} />
          </div>
        )}
      </div>
    </aside>
  );
};
