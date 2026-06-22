import React from 'react';

export const Button = ({ children, className = '', ...props }) => {
  return (
    <button {...props} className={`px-3 py-2 rounded ${className}`}>
      {children}
    </button>
  );
};
