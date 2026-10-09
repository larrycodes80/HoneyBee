import React from 'react';
import { Inbox, Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No runs recorded yet',
  description = 'Trigger a sample agent run to record its trace and inspect decision milestones.',
  actionText = 'New Sample Run',
  onAction
}) => {
  return (
    <div className="state-container">
      <div className="state-icon">
        <Inbox size={28} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{description}</p>
      {onAction && (
        <button onClick={onAction} className="btn btn-primary">
          <Plus size={16} /> {actionText}
        </button>
      )}
    </div>
  );
};
