import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * LazySection Component
 * Renders content only when expanded to save memory
 * Perfect for collapsible form sections, accordions, etc.
 * 
 * Usage:
 *   <LazySection title="Advanced Options" defaultOpen={false}>
 *     <ExpensiveComponent />
 *   </LazySection>
 */
const LazySection = ({
  title,
  children,
  defaultOpen = false,
  className = '',
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-gray-900">{title}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Content - Only render if open */}
      {isOpen && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

export default LazySection;
