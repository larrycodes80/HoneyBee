import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  title?: string;
  data: any;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ title, data }) => {
  const [copied, setCopied] = useState(false);

  const formatted = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="json-block">
      <div className="json-block-header">
        {title && <span className="json-block-title">{title}</span>}
        <button
          onClick={handleCopy}
          className="btn btn-ghost"
          style={{ padding: '2px 6px', fontSize: '0.75rem' }}
          title="Copy JSON"
        >
          {copied ? (
            <>
              <Check size={12} color="#10b981" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>
      <pre>
        <code>{data !== null && data !== undefined ? formatted : 'null'}</code>
      </pre>
    </div>
  );
};
