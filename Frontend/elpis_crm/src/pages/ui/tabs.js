import React, { createContext, useContext } from 'react';

const TabsContext = createContext({ value: null, onValueChange: () => {} });

export const Tabs = ({ children, value, onValueChange, className = '' }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

export const TabsTrigger = ({ children, value, className = '' }) => {
  const ctx = useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange && ctx.onValueChange(value)}
      className={className + (active ? ' opacity-100' : ' opacity-80')}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ children, value, className = '' }) => {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
};
