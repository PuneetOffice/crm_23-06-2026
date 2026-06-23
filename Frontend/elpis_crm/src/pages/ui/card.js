import React from 'react';

export const Card = ({ children, className = '' }) => {
  return (
    <div className={`rounded-xl shadow-sm bg-white ${className}`}>{children}</div>
  );
};
