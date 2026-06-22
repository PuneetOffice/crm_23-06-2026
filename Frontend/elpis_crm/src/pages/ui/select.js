import React from 'react';

// Simple select primitives that extract SelectItem children from SelectContent
export const Select = ({ children, value, onValueChange }) => {
  // Find SelectContent among children
  const content = React.Children.toArray(children).find(
    (c) => c && c.type && c.type.displayName === 'SelectContent'
  );
  const items = content
    ? React.Children.toArray(content.props.children).filter((c) => c && c.type && c.type.displayName === 'SelectItem')
    : [];

  return (
    <div className="inline-block relative">
      <select
        value={value}
        onChange={(e) => onValueChange && onValueChange(e.target.value)}
        className="px-3 py-2 border rounded"
      >
        {items.map((it) => (
          <option key={it.props.value} value={it.props.value}>
            {it.props.children}
          </option>
        ))}
      </select>
      {/* render Trigger/Value for compatibility (no-op) */}
      {React.Children.toArray(children).map((c) => {
        if (!c) return null;
        const t = c.type && (c.type.displayName || c.type.name);
        if (t === 'SelectTrigger' || t === 'SelectValue') return null;
        return null;
      })}
    </div>
  );
};

export const SelectTrigger = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = ({ children }) => {
  return <span>{children}</span>;
};
SelectValue.displayName = 'SelectValue';

export const SelectContent = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};
SelectContent.displayName = 'SelectContent';

export const SelectItem = ({ children, value }) => {
  return <div data-value={value}>{children}</div>;
};
SelectItem.displayName = 'SelectItem';
