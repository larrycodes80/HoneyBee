import React, { useState, useMemo } from 'react';
import type { TraceEvent } from '../types';
import { EventCard } from './EventCard';
import { Filter, Search } from 'lucide-react';

interface TraceTimelineProps {
  events: TraceEvent[];
  onSelectEvent: (event: TraceEvent) => void;
  selectedEventId?: string;
}

export const TraceTimeline: React.FC<TraceTimelineProps> = ({
  events,
  onSelectEvent,
  selectedEventId
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Type filtering
      if (filterType === 'tools' && evt.type !== 'tool_call' && evt.type !== 'tool_result') {
        return false;
      }
      if (filterType === 'model' && evt.type !== 'model_output' && evt.type !== 'model_input') {
        return false;
      }
      if (filterType === 'errors' && evt.type !== 'error') {
        return false;
      }

      // Search filtering
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = evt.name.toLowerCase().includes(query);
        const matchesType = evt.type.toLowerCase().includes(query);
        const matchesInput = evt.input ? JSON.stringify(evt.input).toLowerCase().includes(query) : false;
        const matchesOutput = evt.output ? JSON.stringify(evt.output).toLowerCase().includes(query) : false;
        return matchesName || matchesType || matchesInput || matchesOutput;
      }

      return true;
    });
  }, [events, filterType, searchQuery]);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Timeline Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: 'var(--bg-surface)',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Filter Events:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'all', label: `All (${events.length})` },
              {
                id: 'tools',
                label: `Tools (${events.filter((e) => e.type.startsWith('tool_')).length})`
              },
              {
                id: 'model',
                label: `Model (${events.filter((e) => e.type.startsWith('model_')).length})`
              },
              {
                id: 'errors',
                label: `Errors (${events.filter((e) => e.type === 'error').length})`
              }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`filter-btn ${filterType === f.id ? 'active' : ''}`}
                style={{ padding: '3px 9px', fontSize: '0.75rem' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', width: '220px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }}
          />
          <input
            type="text"
            placeholder="Search trace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ padding: '0.35rem 0.65rem 0.35rem 1.8rem', fontSize: '0.8rem' }}
          />
        </div>
      </div>

      {/* Timeline nodes */}
      {filteredEvents.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-subtle)'
          }}
        >
          No trace events matched the selected filters.
        </div>
      ) : (
        <div className="timeline-container">
          <div className="timeline-line" />
          {filteredEvents.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              isSelected={selectedEventId === evt.id}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
};
