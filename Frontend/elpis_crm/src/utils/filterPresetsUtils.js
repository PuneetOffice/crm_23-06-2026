/**
 * Filter Presets Utilities
 * Save and load filter combinations to/from localStorage
 */

const PRESETS_STORAGE_KEY = 'dashboard_filter_presets';

/**
 * Gets all saved filter presets
 * @returns {Array} Array of preset objects
 */
export const getFilterPresets = () => {
  try {
    const presets = localStorage.getItem(PRESETS_STORAGE_KEY);
    return presets ? JSON.parse(presets) : getDefaultPresets();
  } catch (err) {
    console.error('Error loading presets:', err);
    return getDefaultPresets();
  }
};

/**
 * Default filter presets
 * @returns {Array} Default presets
 */
export const getDefaultPresets = () => [
  {
    id: 'my-open-deals',
    name: 'My Open Deals',
    description: 'All your active deals',
    filters: {
      dateRange: 'all',
      territory: 'all',
      salesOwner: 'all',
      dealStage: 'all',
      industry: 'all',
      maturity: 'all',
      createdBy: 'current-user',
      excludeStages: ['Won', 'Lost']
    },
    isDefault: true
  },
  {
    id: 'my-won-this-month',
    name: 'My Won Deals This Month',
    description: 'Deals you closed this month',
    filters: {
      dateRange: 'thisMonth',
      territory: 'all',
      salesOwner: 'all',
      dealStage: 'Won',
      industry: 'all',
      maturity: 'all',
      createdBy: 'current-user'
    },
    isDefault: true
  },
  {
    id: 'high-value-recent',
    name: 'High-Value Recent Deals',
    description: 'Created in last 7 days, value > $50k',
    filters: {
      dateRange: 'all',
      territory: 'all',
      salesOwner: 'all',
      dealStage: 'all',
      industry: 'all',
      maturity: 'new',
      createdBy: 'all',
      minValue: 50000
    },
    isDefault: true
  },
  {
    id: 'stalled-deals',
    name: 'Stalled Deals I Own',
    description: 'Your deals in same stage for 60+ days',
    filters: {
      dateRange: 'all',
      territory: 'all',
      salesOwner: 'current-user',
      dealStage: 'all',
      industry: 'all',
      maturity: 'mature',
      createdBy: 'all'
    },
    isDefault: true
  }
];

/**
 * Saves a new filter preset
 * @param {string} name - Preset name
 * @param {string} description - Preset description
 * @param {object} filters - Filter object
 * @returns {object} The saved preset
 */
export const saveFilterPreset = (name, description, filters) => {
  const presets = getFilterPresets();
  
  const newPreset = {
    id: `preset-${Date.now()}`,
    name,
    description,
    filters,
    isDefault: false,
    createdAt: new Date().toISOString()
  };
  
  // Separate defaults and custom presets
  const customPresets = presets.filter(p => !p.isDefault);
  const defaultPresets = presets.filter(p => p.isDefault);
  
  // Add new preset to custom presets (max 10 custom presets)
  customPresets.unshift(newPreset);
  if (customPresets.length > 10) {
    customPresets.pop();
  }
  
  const allPresets = [...defaultPresets, ...customPresets];
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(allPresets));
  
  return newPreset;
};

/**
 * Deletes a custom filter preset
 * @param {string} presetId - Preset ID to delete
 * @returns {boolean} Success status
 */
export const deleteFilterPreset = (presetId) => {
  const presets = getFilterPresets();
  const preset = presets.find(p => p.id === presetId);
  
  if (!preset) {
    console.warn('Preset not found:', presetId);
    return false;
  }
  
  if (preset.isDefault) {
    console.warn('Cannot delete default presets');
    return false;
  }
  
  const filteredPresets = presets.filter(p => p.id !== presetId);
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(filteredPresets));
  
  return true;
};

/**
 * Gets a preset by ID
 * @param {string} presetId - Preset ID
 * @returns {object} Preset object or null
 */
export const getPresetById = (presetId) => {
  const presets = getFilterPresets();
  return presets.find(p => p.id === presetId) || null;
};

/**
 * Applies a preset - resolves "current-user" references
 * @param {object} preset - Preset object
 * @param {string} currentUserName - Current user name
 * @returns {object} Resolved filters object
 */
export const applyPreset = (preset, currentUserName) => {
  if (!preset) return null;
  
  const resolvedFilters = { ...preset.filters };
  
  // Replace "current-user" references with actual username
  if (resolvedFilters.createdBy === 'current-user') {
    resolvedFilters.createdBy = currentUserName;
  }
  if (resolvedFilters.salesOwner === 'current-user') {
    resolvedFilters.salesOwner = currentUserName;
  }
  
  // Remove special filter properties that aren't in the main filters object
  delete resolvedFilters.minValue;
  delete resolvedFilters.maxValue;
  delete resolvedFilters.excludeStages;
  
  return resolvedFilters;
};

/**
 * Resets presets to defaults
 */
export const resetPresetsToDefaults = () => {
  const defaults = getDefaultPresets();
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(defaults));
};

export default {
  getFilterPresets,
  getDefaultPresets,
  saveFilterPreset,
  deleteFilterPreset,
  getPresetById,
  applyPreset,
  resetPresetsToDefaults
};
