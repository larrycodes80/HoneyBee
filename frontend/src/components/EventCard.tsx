import React from 'react';
import {
  Wrench,
  CheckCircle2,
  Cpu,
  AlertOctagon,
  Play,
  Flag,
  ChevronRight,
  Terminal
} from 'lucide-react';
import type { TraceEvent, TraceEventType } from '../types';

interface EventCardProps {
  event: TraceEvent;
  isSelected?: boolean;
  onSelect: (event: TraceEvent) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, isSelected, onSelect }) => {
  const getEventIcon = (type: TraceEventType) => {
    switch (type) {
      case 'tool_call':
        return <Wrench size={16} color="var(--accent-amber)" />;
      case 'tool_result':
        return <CheckCircle2 size={16} color="var(--accent-emerald)" />;
      case 'model_output':
      case 'model_input':
        return <Cpu size={16} color="var(--accent-purple)" />;
      case 'error':
        return <AlertOctagon size={16} color="var(--accent-rose)" />;
      case 'agent_start':
        return <Play size={16} color="var(--accent-cyan)" />;
      case 'agent_end':
        return <Flag size={16} color="var(--accent-cyan)" />;
      default:
        return <Terminal size={16} color="var(--text-secondary)" />;
    }
  };

  const formatSummary = () => {
    if (event.type === 'tool_call') {
      const args = event.input ? JSON.stringify(event.input) : '{}';
      return (
        <div>
          <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Tool Call: </span>
          <span style={{ color: 'var(--text-primary)' }}>{event.name}</span>
          <div style={{ marginTop: '4px', opacity: 0.85 }}>args: {args}</div>
        </div>
      );
    }

    if (event.type === 'tool_result') {
      const res = event.output ? JSON.stringify(event.output) : '{}';
      return (
        <div>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Result from {event.name}: </span>
          <div style={{ marginTop: '4px', opacity: 0.85 }}>{res}</div>
        </div>
      );
    }

    if (event.type === 'model_output') {
      const thought =
        typeof event.output === 'object' && event.output?.thought
          ? event.output.thought
          : typeof event.output === 'string'
          ? event.output
          : JSON.stringify(event.output);
      return (
        <div>
          <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Model Decision: </span>
          <div style={{ marginTop: '4px', opacity: 0.9 }}>{thought}</div>
        </div>
      );
    }

    if (event.type === 'error') {
      const msg =
        typeof event.output === 'object' && event.output?.message
          ? event.output.message
          : JSON.stringify(event.output || event.metadata);
      return (
        <div>
          <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>Error Encountered: </span>
          <div style={{ marginTop: '4px', color: 'var(--accent-rose)' }}>{msg}</div>
        </div>
      );
    }

    if (event.type === 'agent_start') {
      return (
        <div>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Execution Started </span>
          {event.input && (
            <span style={{ opacity: 0.85 }}>({JSON.stringify(event.input)})</span>
          )}
        </div>
      );
    }

    if (event.type === 'agent_end') {
      const summary =
        typeof event.output === 'object' && event.output?.summary
          ? event.output.summary
          : JSON.stringify(event.output || 'Run concluded');
      return (
        <div>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Execution Concluded: </span>
          <span style={{ opacity: 0.85 }}>{summary}</span>
        </div>
      );
    }

    return <div>{JSON.stringify(event.output || event.input || {})}</div>;
  };

  const formattedTime = new Date(event.timestamp).toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });

  return (
    <div className="timeline-event-wrapper">
      <div className="timeline-node">
        <div className="timeline-sequence-circle">
          #{event.sequence}
        </div>
      </div>

      <div
        className={`event-card type-${event.type} ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(event)}
        style={{
          boxShadow: isSelected ? '0 0 0 2px var(--accent-cyan)' : undefined
        }}
      >
        <div className="event-header">
          <div className="event-title-group">
            <div className="event-icon-badge">{getEventIcon(event.type)}</div>
            <div>
              <span className="event-name">{event.name}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  marginLeft: '8px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'var(--bg-surface-elevated)',
                  color: 'var(--text-muted)'
                }}
              >
                {event.type}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="event-timestamp">{formattedTime}</span>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        <div className="event-body-summary">{formatSummary()}</div>
      </div>
    </div>
  );
};
