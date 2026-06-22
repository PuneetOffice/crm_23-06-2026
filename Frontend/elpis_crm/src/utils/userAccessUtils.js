/**
 * User Access Level Utilities
 * Determines data access scope based on user role
 */

/**
 * Determines the access level of a user based on their role
 * @param {string} role - User role from AuthContext
 * @returns {string} 'admin' | 'manager' | 'user'
 */
export const getUserAccessLevel = (role) => {
  if (!role) return 'user';
  
  const normalizedRole = String(role).toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'manager') return 'manager';
  return 'user';
};

/**
 * Checks if user can view all data (admin/manager)
 * @param {string} role - User role
 * @returns {boolean}
 */
export const canViewAllData = (role) => {
  const level = getUserAccessLevel(role);
  return level === 'admin' || level === 'manager';
};

/**
 * Checks if user can access user filtering features
 * @param {string} role - User role
 * @returns {boolean}
 */
export const canAccessUserFiltering = (role) => {
  return canViewAllData(role);
};

/**
 * Gets a human-readable access label
 * @param {string} role - User role
 * @param {string} userName - Current user's name
 * @returns {object} { label, badge, icon }
 */
export const getAccessLabel = (role, userName) => {
  const level = getUserAccessLevel(role);
  
  const labels = {
    admin: {
      label: 'Admin View: Viewing All Users\' Analytics',
      badge: 'bg-purple-100 text-purple-700',
      icon: '👥',
      description: 'You have access to all analytics and can filter by user'
    },
    manager: {
      label: 'Manager View: Viewing Team Analytics',
      badge: 'bg-blue-100 text-blue-700',
      icon: '👥',
      description: 'You can view team data and filter by user'
    },
    user: {
      label: `Your Analytics (${userName})`,
      badge: 'bg-green-100 text-green-700',
      icon: '👤',
      description: 'You are viewing your personal analytics only'
    }
  };
  
  return labels[level] || labels.user;
};

/**
 * Determines which API endpoint to use for fetching deals
 * @param {string} role - User role
 * @param {string} userName - Current user's name
 * @returns {object} { endpoint, description, needsUserParam }
 */
export const getDealsFetchConfig = (role, userName) => {
  const level = getUserAccessLevel(role);
  
  const configs = {
    admin: {
      endpoint: '/Deal',
      description: 'Fetching all deals across all users',
      needsUserParam: false,
      allowUserFilter: true
    },
    manager: {
      endpoint: '/Deal',
      description: 'Fetching team deals',
      needsUserParam: false,
      allowUserFilter: true
    },
    user: {
      endpoint: '/Deal/my-deals',
      description: `Fetching deals created by ${userName}`,
      needsUserParam: false,
      allowUserFilter: false
    }
  };
  
  return configs[level] || configs.user;
};

/**
 * Filters deals based on user access level
 * @param {Array} deals - Array of deal objects
 * @param {string} userRole - User role
 * @param {string} currentUserName - Current user's name
 * @param {string} filterByUser - Optional: filter by specific user (admin/manager only)
 * @returns {Array} Filtered deals
 */
export const filterDealsByAccess = (deals, userRole, currentUserName, filterByUser = null) => {
  if (!Array.isArray(deals)) return [];
  
  const level = getUserAccessLevel(userRole);
  
  // Admins/Managers can view all or filter by specific user
  if (level === 'admin' || level === 'manager') {
    if (filterByUser && filterByUser !== 'all') {
      return deals.filter(d => d.createdBy === filterByUser || d.CreatedBy === filterByUser);
    }
    return deals;
  }
  
  // Regular users can only see their own deals
  return deals.filter(d => 
    (d.createdBy === currentUserName || d.CreatedBy === currentUserName)
  );
};

/**
 * Gets unique creators from deals list
 * @param {Array} deals - Array of deal objects
 * @returns {Array} Sorted array of unique creator names
 */
export const getUniqueDealCreators = (deals) => {
  if (!Array.isArray(deals)) return [];
  
  const creators = new Set();
  deals.forEach(d => {
    const creator = d.createdBy || d.CreatedBy;
    if (creator) {
      creators.add(creator);
    }
  });
  
  return Array.from(creators).sort();
};

/**
 * Gets user-specific analytics stats
 * @param {Array} deals - Array of deal objects
 * @param {string} userName - User to get stats for
 * @returns {object} Statistics object
 */
export const getUserStats = (deals, userName) => {
  const userDeals = deals.filter(d => 
    (d.createdBy === userName || d.CreatedBy === userName)
  );
  
  const wonDeals = userDeals.filter(d => d.dealStage === 'Won' || d.DealStage === 'Won');
  const lostDeals = userDeals.filter(d => d.dealStage === 'Lost' || d.DealStage === 'Lost');
  
  const totalDeals = wonDeals.length + lostDeals.length;
  const winRate = totalDeals > 0 ? ((wonDeals.length / totalDeals) * 100).toFixed(1) : 0;
  
  const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.dealValue || d.DealValue || 0), 0);
  const avgDealSize = userDeals.length > 0 ? (totalRevenue / userDeals.length).toFixed(0) : 0;
  
  return {
    dealsCreated: userDeals.length,
    dealsWon: wonDeals.length,
    dealsLost: lostDeals.length,
    winRate,
    totalRevenue,
    avgDealSize,
    activeDeals: userDeals.filter(d => !['Won', 'Lost'].includes(d.dealStage || d.DealStage)).length
  };
};

/**
 * Validates JWT token contains required user claims
 * @param {object} decodedToken - Decoded JWT token
 * @returns {object} { isValid, userName, role, errors }
 */
export const validateUserClaims = (decodedToken) => {
  const errors = [];
  
  if (!decodedToken) {
    errors.push('No token provided');
    return { isValid: false, userName: null, role: null, errors };
  }
  
  const userName = decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                   decodedToken.name ||
                   decodedToken['name'] ||
                   decodedToken.preferred_username;
                   
  const role = decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
               decodedToken.role ||
               decodedToken['role'];
  
  if (!userName) {
    errors.push('User name claim not found in token');
  }
  
  if (!role) {
    errors.push('Role claim not found in token');
  }
  
  return {
    isValid: errors.length === 0,
    userName: userName || 'Unknown User',
    role: role || 'User',
    errors
  };
};

const userAccessUtils = {
  getUserAccessLevel,
  canViewAllData,
  canAccessUserFiltering,
  getAccessLabel,
  getDealsFetchConfig,
  filterDealsByAccess,
  getUniqueDealCreators,
  getUserStats,
  validateUserClaims
};

export default userAccessUtils;
