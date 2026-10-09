import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonTreeProps {
  data: any;
  title?: string;
}

export const JsonTree: React.FC<JsonTreeProps> = ({ data, title }) => {
  const [copied, setCopied] = useState(false);

  const formatWithHighlight = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="json-null">null</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="json-bool">{String(value)}</span>;
    }
    if (typeof value === 'number') {
      return <span className="json-num">{value}</span>;
    }
    if (typeof value === 'string') {
      return <span className="json-str">"{value}"</span>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return (
        <span>
          {'[\n'}
          {value.map((item, idx) => (
            <span key={idx} style={{ paddingLeft: '1rem', display: 'block' }}>
              {formatWithHighlight(item)}
              {idx < value.length - 1 ? ',' : ''}
            </span>
          ))}
          {']'}
        </span>
      );
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      return (
        <span>
          {'{\n'}
          {keys.map((k, idx) => (
            <span key={k} style={{ paddingLeft: '1rem', display: 'block' }}>
              <span className="json-key">"{k}"</span>
              {': '}
              {formatWithHighlight(value[k])}
              {idx < keys.length - 1 ? ',' : ''}
            </span>
          ))}
          {'}'}
        </span>
      );
    }
    return String(value);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title && <span className="inspector-section-title">{title}</span>}
        <button
          onClick={handleCopy}
          className="wb-btn wb-btn-outline"
          style={{ padding: '2px 5px', fontSize: '0.68rem', marginLeft: 'auto' }}
          title="Copy JSON payload"
        >
          {copied ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="json-container">
        <code>{formatWithHighlight(data)}</code>
      </div>
    </div>
  );
};
