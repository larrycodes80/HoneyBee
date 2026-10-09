import React from 'react';
import { Layers, X, Cpu, EyeOff, Shield } from 'lucide-react';
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
        {/* Redaction Notice */}
        {event.is_redacted && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--warning-subtle)',
              border: '1px solid var(--warning-border)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              fontSize: '0.72rem',
              color: 'var(--warning)'
            }}
          >
            <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Backend Redaction Active:</strong> Sensitive fields have been masked with [REDACTED] by
              backend privacy rules. Hidden data is omitted according to security policies.
            </div>
          </div>
        )}

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
          <div className="meta-field">
            <span className="meta-field-label">Instrumentation</span>
            <span className="meta-field-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {event.instrumentation_type === 'outer_sdk' ? (
                <>
                  <Cpu size={11} color="#89ddff" />
                  <span style={{ color: '#89ddff' }}>Outer SDK (Auto)</span>
                </>
              ) : (
                <>
                  <Layers size={11} color="#c792ea" />
                  <span style={{ color: '#c792ea' }}>Internal (Developer)</span>
                </>
              )}
            </span>
          </div>
          <div className="meta-field">
            <span className="meta-field-label">Redacted</span>
            <span className="meta-field-value">
              {event.is_redacted ? (
                <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <EyeOff size={11} /> Masked
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>None</span>
              )}
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

