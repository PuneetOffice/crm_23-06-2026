import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePagination } from '../hooks/useLazyLoading';

/**
 * LazyTable Component - Implements pagination for large tables
 * Only renders visible rows + context rows (e.g., 50 rows per page)
 * Significantly improves performance for tables with 1000+ rows
 * 
 * Usage:
 *   <LazyTable 
 *     data={contacts} 
 *     columns={contactColumns} 
 *     rowsPerPage={50}
 *     renderRow={(item) => <TableRow item={item} />}
 *   />
 */
const LazyTable = ({
  data = [],
  columns = [],
  rowsPerPage = 50,
  renderRow,
  className = '',
  onPageChange,
}) => {
  const { items, page, totalPages, pageSize, totalItems, onPageChange: handlePageChange } = usePagination(data, rowsPerPage);

  const onChangePage = (newPage) => {
    handlePageChange(newPage);
    if (onPageChange) onPageChange(newPage);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-0 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          {columns.map((col) => (
            <div
              key={col.key}
              className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap"
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="divide-y divide-gray-200">
          {items.length > 0 ? (
            items.map((item, idx) => (
              <div key={`${item.id || idx}-${page}`} className="hover:bg-gray-50 transition-colors">
                {renderRow ? renderRow(item) : JSON.stringify(item)}
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No records found
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold">{Math.min(page * pageSize, totalItems)}</span> of{' '}
            <span className="font-semibold">{totalItems}</span> records
          </div>

          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => onChangePage(page - 1)}
              disabled={page === 1}
              className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Page Info */}
            <span className="text-sm text-gray-600 px-2">
              Page <span className="font-semibold">{page}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </span>

            {/* Next Button */}
            <button
              onClick={() => onChangePage(page + 1)}
              disabled={page === totalPages}
              className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Jump to Page */}
            <input
              type="number"
              min="1"
              max={totalPages}
              value={page}
              onChange={(e) => {
                const newPage = parseInt(e.target.value);
                if (!isNaN(newPage)) onChangePage(newPage);
              }}
              className="w-14 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Go to page"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LazyTable;
