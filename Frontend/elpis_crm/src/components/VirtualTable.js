import React, { useMemo, useCallback, memo } from 'react';
import { FixedSizeList as List } from 'react-window';

/**
 * Optimized Virtual Scrolling Table for Large Datasets
 * Uses react-window to render only visible rows
 */
const VirtualTable = memo(({
  data = [],
  columns = [],
  rowHeight = 48,
  height = 600,
  width = '100%',
  renderRow = null,
  onRowClick = null,
  isLoading = false,
}) => {
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      </div>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No contacts found</p>
      </div>
    );
  }
  
  // Item renderer for virtual list
  const Row = ({ index, style }) => {
    const item = data[index];
    if (!item) return null;
    
    return (
      <div
        style={style}
        className="border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center cursor-pointer"
        onClick={() => onRowClick?.(item, index)}
      >
        {renderRow ? (
          renderRow(item, index)
        ) : (
          <div className="flex flex-1 px-4">
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex-1 text-sm text-gray-700 truncate"
                style={{ minWidth: col.width || 'auto' }}
              >
                {item[col.key] || '-'}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <List
      height={height}
      itemCount={data.length}
      itemSize={rowHeight}
      width={width}
      overscanCount={5}
    >
      {Row}
    </List>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if critical props change
  return (
    prevProps.data === nextProps.data &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.height === nextProps.height &&
    prevProps.columns === nextProps.columns
  );
});

VirtualTable.displayName = 'VirtualTable';

export default VirtualTable;
