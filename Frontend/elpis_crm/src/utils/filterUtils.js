// Utility functions for applying filters to data

/**
 * Apply filters to an array of data
 * @param {Array} data - The data array to filter
 * @param {Array} filters - Array of filter objects
 * @returns {Array} - Filtered data
 */
export function applyFilters(data, filters) {
  if (!filters || filters.length === 0) {
    console.debug("[filterUtils] No filters applied, returning all data:", data.length);
    return data;
  }

  console.debug("[filterUtils] Applying filters:", { filterCount: filters.length, dataCount: data.length, filters });
  
  // Log detailed filter structure
  filters.forEach((f, idx) => {
    console.debug(`[filterUtils] Filter ${idx}:`, { field: f.field, operator: f.operator, value: f.value, dataType: f.dataType });
  });

  const filtered = data.filter((item, itemIdx) => {
    // All filters must pass (AND logic)
    const passes = filters.every((filter, filterIdx) => {
      if (!filter.field || !filter.operator) {
        console.debug("[filterUtils] Skipping invalid filter:", filter);
        return true;
      }
      
      const value = getFieldValue(item, filter.field);
      const result = evaluateFilter(value, filter.operator, filter.value, filter.dataType);
      
      // Log first 3 items for debugging
      if (itemIdx < 3) {
        console.debug(`[filterUtils] Item ${itemIdx}, Filter ${filterIdx} - Field: "${filter.field}", ItemValue: "${value}", Operator: "${filter.operator}", FilterValue: "${filter.value}", DataType: "${filter.dataType}", Result: ${result}`);
      }
      
      return result;
    });
    
    return passes;
  });

  console.debug("[filterUtils] Filter result:", { originalCount: data.length, filteredCount: filtered.length });
  return filtered;
}

/**
 * Get field value from an object with case-insensitive fallback
 */
function getFieldValue(obj, key) {
  if (!obj) return undefined;
  if (key in obj) return obj[key];
  
  // Try lowercase first letter
  const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
  if (lowerKey in obj) return obj[lowerKey];
  
  // Try all lowercase
  const allLower = key.toLowerCase();
  return obj[allLower];
}

/**
 * Evaluate a single filter condition
 */
function evaluateFilter(value, operator, filterValue, dataType) {
  // Handle isEmpty and isNotEmpty operators
  if (operator === 'isEmpty') {
    return value === null || value === undefined || value === '' || String(value).toLowerCase() === 'null';
  }
  if (operator === 'isNotEmpty') {
    return value !== null && value !== undefined && value !== '' && String(value).toLowerCase() !== 'null';
  }

  // If value is empty and operator is not isEmpty/isNotEmpty, it FAILS the filter
  if (value === null || value === undefined || value === '' || String(value).toLowerCase() === 'null') {
    return false;
  }

  // Convert values to strings for comparison (except for numbers and dates)
  const strValue = String(value).toLowerCase();
  const strFilterValue = String(filterValue).toLowerCase();

  switch (dataType) {
    case 'text':
    case 'select':
    case 'tags':
      return evaluateTextFilter(strValue, operator, strFilterValue, dataType);
    
    case 'number':
      return evaluateNumberFilter(value, operator, filterValue);
    
    case 'date':
      return evaluateDateFilter(value, operator, filterValue);
    
    default:
      return evaluateTextFilter(strValue, operator, strFilterValue, dataType);
  }
}

/**
 * Evaluate text-based filters
 */
function evaluateTextFilter(value, operator, filterValue, dataType) {
  if (!filterValue) return true;
  
  // Special handling for tags - match ANY tag (OR logic)
  if (dataType === 'tags') {
    const valueTags = String(value)
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t);
    
    const filterTags = String(filterValue)
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t);
    
    if (filterTags.length === 0) return true;
    
    switch (operator) {
      case 'contains':
        // Match if ANY filter tag is in value tags
        return filterTags.some(tag => valueTags.includes(tag));
      
      case 'notContains':
        // Match if NONE of the filter tags are in value tags
        return !filterTags.some(tag => valueTags.includes(tag));
      
      case 'equals':
        // Match if value tags exactly match filter tags
        return valueTags.length === filterTags.length &&
               filterTags.every(tag => valueTags.includes(tag));
      
      default:
        return true;
    }
  }
  
  switch (operator) {
    case 'contains':
      return value.includes(filterValue);
    
    case 'notContains':
      return !value.includes(filterValue);
    
    case 'equals':
      return value === filterValue;
    
    case 'notEquals':
      return value !== filterValue;
    
    case 'startsWith':
      return value.startsWith(filterValue);
    
    case 'endsWith':
      return value.endsWith(filterValue);
    
    default:
      return true;
  }
}

/**
 * Evaluate number-based filters
 */
function evaluateNumberFilter(value, operator, filterValue) {
  const numValue = Number(value);
  const numFilterValue = Number(filterValue);
  
  if (isNaN(numValue) || isNaN(numFilterValue)) return true;
  
  switch (operator) {
    case 'equals':
      return numValue === numFilterValue;
    
    case 'notEquals':
      return numValue !== numFilterValue;
    
    case 'greaterThan':
      return numValue > numFilterValue;
    
    case 'lessThan':
      return numValue < numFilterValue;
    
    case 'greaterOrEqual':
      return numValue >= numFilterValue;
    
    case 'lessOrEqual':
      return numValue <= numFilterValue;
    
    default:
      return true;
  }
}

/**
 * Evaluate date-based filters
 */
function evaluateDateFilter(value, operator, filterValue) {
  if (!filterValue) return true;
  
  const dateValue = new Date(value);
  const dateFilterValue = new Date(filterValue);
  
  if (isNaN(dateValue.getTime()) || isNaN(dateFilterValue.getTime())) return true;
  
  // Reset time to compare dates only
  dateValue.setHours(0, 0, 0, 0);
  dateFilterValue.setHours(0, 0, 0, 0);
  
  switch (operator) {
    case 'equals':
      return dateValue.getTime() === dateFilterValue.getTime();
    
    case 'notEquals':
      return dateValue.getTime() !== dateFilterValue.getTime();
    
    case 'before':
      return dateValue.getTime() < dateFilterValue.getTime();
    
    case 'after':
      return dateValue.getTime() > dateFilterValue.getTime();
    
    default:
      return true;
  }
}

/**
 * Get active filter count
 */
export function getActiveFilterCount(filters) {
  if (!filters) return 0;
  return filters.filter(f => f.value !== "" || ['isEmpty', 'isNotEmpty'].includes(f.operator)).length;
}
