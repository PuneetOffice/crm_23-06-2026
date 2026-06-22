/**
 * User-Based Analytics Utilities
 * Calculates user-specific and team-wide metrics
 */

/**
 * Calculates personal user statistics
 * @param {Array} deals - All deals
 * @param {string} userName - User to calculate stats for
 * @returns {object} User statistics
 */
export const calculateUserStats = (deals, userName) => {
  if (!userName) return null;

  const userDeals = deals.filter(d => 
    (d.createdBy === userName || d.CreatedBy === userName)
  );

  const wonDeals = userDeals.filter(d => d.dealStage === 'Won' || d.DealStage === 'Won');
  const lostDeals = userDeals.filter(d => d.dealStage === 'Lost' || d.DealStage === 'Lost');
  const openDeals = userDeals.filter(d => !['Won', 'Lost'].includes(d.dealStage || d.DealStage));

  const totalDeals = userDeals.length;
  const totalWonDeals = wonDeals.length + lostDeals.length;
  const winRate = totalWonDeals > 0 ? ((wonDeals.length / totalWonDeals) * 100).toFixed(1) : 0;

  const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.dealValue || d.DealValue || 0), 0);
  const avgDealSize = totalDeals > 0 ? (totalRevenue / totalDeals).toFixed(0) : 0;

  const myOwnerDeals = deals.filter(d => d.salesOwner === userName || d.SalesOwner === userName).length;

  return {
    dealsCreated: totalDeals,
    dealsWon: wonDeals.length,
    dealsLost: lostDeals.length,
    openDeals: openDeals.length,
    winRate,
    totalRevenue,
    avgDealSize,
    dealsAssignedToMe: myOwnerDeals,
    lastMonthDeals: userDeals.filter(d => {
      const date = d.createdAt || d.CreatedAt;
      if (!date) return false;
      const today = new Date();
      const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
      return new Date(date) >= monthAgo;
    }).length
  };
};

/**
 * Calculates team-wide statistics
 * @param {Array} deals - All deals
 * @returns {object} Team statistics
 */
export const calculateTeamStats = (deals) => {
  const allWon = deals.filter(d => d.dealStage === 'Won' || d.DealStage === 'Won');
  const allLost = deals.filter(d => d.dealStage === 'Lost' || d.DealStage === 'Lost');

  const totalRevenue = allWon.reduce((sum, d) => sum + (d.dealValue || d.DealValue || 0), 0);
  const totalWinRate = allWon.length + allLost.length > 0 
    ? ((allWon.length / (allWon.length + allLost.length)) * 100).toFixed(1)
    : 0;

  // Get top performer this month
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const thisMonthDeals = deals.filter(d => {
    const date = d.createdAt || d.CreatedAt;
    return date && new Date(date) >= monthStart;
  });

  const userStats = {};
  thisMonthDeals.forEach(d => {
    const creator = d.createdBy || d.CreatedBy;
    if (!userStats[creator]) {
      userStats[creator] = { count: 0, revenue: 0, won: 0 };
    }
    userStats[creator].count++;
    userStats[creator].revenue += d.dealValue || d.DealValue || 0;
    if (d.dealStage === 'Won' || d.DealStage === 'Won') {
      userStats[creator].won++;
    }
  });

  const topPerformer = Object.entries(userStats).reduce((top, [user, stats]) => {
    return (stats.revenue > (top?.revenue || 0)) ? { user, ...stats } : top;
  }, null);

  const thisMonthRevenue = Object.values(userStats).reduce((sum, s) => sum + s.revenue, 0);
  const thisMonthDealsCount = thisMonthDeals.length;
  const thisMonthWonCount = thisMonthDeals.filter(d => d.dealStage === 'Won' || d.DealStage === 'Won').length;
  const thisMonthDecidedCount = thisMonthDeals.filter(d => {
    const stage = d.dealStage || d.DealStage;
    return stage === 'Won' || stage === 'Lost';
  }).length;
  const thisMonthWinRate = thisMonthDecidedCount > 0 
    ? ((thisMonthWonCount / thisMonthDecidedCount) * 100).toFixed(1)
    : 0;

  const mostActiveUser = Object.entries(userStats).reduce((max, [user, stats]) => {
    return stats.count > (max?.count || 0) ? { user, count: stats.count } : max;
  }, null);

  return {
    totalRevenue,
    totalWinRate,
    topPerformer: topPerformer?.user || 'N/A',
    topPerformerRevenue: topPerformer?.revenue || 0,
    teamTotalRevenue: thisMonthRevenue,
    teamDealsCreated: thisMonthDealsCount,
    teamWinRate: thisMonthWinRate,
    mostActiveUser: mostActiveUser?.user || 'N/A',
    mostActiveUserCount: mostActiveUser?.count || 0
  };
};

/**
 * Calculates created vs updated deals comparison
 * @param {Array} deals - All deals
 * @param {string} timeFrame - 'thisMonth', 'thisQuarter', 'thisYear'
 * @returns {object} Created vs updated comparison
 */
export const calculateCreatedVsUpdated = (deals, timeFrame = 'thisMonth') => {
  const today = new Date();
  let startDate;

  if (timeFrame === 'thisMonth') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (timeFrame === 'thisQuarter') {
    const quarter = Math.floor(today.getMonth() / 3);
    startDate = new Date(today.getFullYear(), quarter * 3, 1);
  } else if (timeFrame === 'thisYear') {
    startDate = new Date(today.getFullYear(), 0, 1);
  }

  const created = deals.filter(d => {
    const date = d.createdAt || d.CreatedAt;
    return date && new Date(date) >= startDate;
  });

  const updated = deals.filter(d => {
    const date = d.updatedAt || d.UpdatedAt;
    return date && new Date(date) >= startDate;
  });

  return {
    dealsCreated: created.length,
    dealsUpdated: updated.length,
    createdRevenue: created
      .filter(d => d.dealStage === 'Won')
      .reduce((sum, d) => sum + (d.dealValue || d.DealValue || 0), 0),
    updatedRevenue: updated
      .filter(d => d.dealStage === 'Won')
      .reduce((sum, d) => sum + (d.dealValue || d.DealValue || 0), 0)
  };
};

/**
 * Gets deal creator leaderboard
 * @param {Array} deals - All deals
 * @param {string} metric - 'revenue' | 'deals' | 'winRate' | 'avgDealSize'
 * @param {number} limit - Number of top performers to return
 * @returns {Array} Leaderboard entries
 */
export const getDealCreatorLeaderboard = (deals, metric = 'revenue', limit = 10) => {
  const userStats = {};

  deals.forEach(d => {
    const creator = d.createdBy || d.CreatedBy;
    if (!creator) return;

    if (!userStats[creator]) {
      userStats[creator] = {
        user: creator,
        dealsCreated: 0,
        dealsWon: 0,
        dealsLost: 0,
        totalRevenue: 0,
        deals: []
      };
    }

    userStats[creator].dealsCreated++;
    userStats[creator].deals.push(d);

    if (d.dealStage === 'Won' || d.DealStage === 'Won') {
      userStats[creator].dealsWon++;
      userStats[creator].totalRevenue += d.dealValue || d.DealValue || 0;
    } else if (d.dealStage === 'Lost' || d.DealStage === 'Lost') {
      userStats[creator].dealsLost++;
    }
  });

  const leaderboard = Object.values(userStats)
    .map(stats => ({
      ...stats,
      winRate: stats.dealsWon + stats.dealsLost > 0 
        ? ((stats.dealsWon / (stats.dealsWon + stats.dealsLost)) * 100).toFixed(1)
        : 0,
      avgDealSize: stats.dealsCreated > 0 
        ? (stats.totalRevenue / stats.dealsCreated).toFixed(0)
        : 0
    }))
    .sort((a, b) => {
      switch (metric) {
        case 'deals': return b.dealsCreated - a.dealsCreated;
        case 'winRate': return parseFloat(b.winRate) - parseFloat(a.winRate);
        case 'avgDealSize': return parseFloat(b.avgDealSize) - parseFloat(a.avgDealSize);
        case 'revenue':
        default: return b.totalRevenue - a.totalRevenue;
      }
    })
    .slice(0, limit);

  return leaderboard;
};

/**
 * Gets deal creation trend over time
 * @param {Array} deals - All deals
 * @param {number} months - Number of months to look back
 * @returns {Array} Trend data by user
 */
export const getDealCreationTrend = (deals, months = 3) => {
  const today = new Date();
  const data = {};

  // Initialize months
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    data[monthKey] = {};
  }

  // Fill in deals
  deals.forEach(d => {
    const createdDate = d.createdAt || d.CreatedAt;
    if (!createdDate) return;

    const date = new Date(createdDate);
    const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });

    if (data[monthKey]) {
      const creator = d.createdBy || d.CreatedBy;
      if (!data[monthKey][creator]) {
        data[monthKey][creator] = 0;
      }
      data[monthKey][creator]++;
    }
  });

  return Object.entries(data).map(([month, creators]) => ({
    month,
    ...creators,
    total: Object.values(creators).reduce((sum, count) => sum + count, 0)
  }));
};

/**
 * Gets conversion funnel by creator
 * @param {Array} deals - All deals
 * @param {Array} creators - List of creators to analyze (optional)
 * @returns {Array} Funnel data per creator
 */
export const getConversionFunnelByCreator = (deals, creators = null) => {
  const STAGES = ['New Lead', 'Need Analysis', 'Under Review', 'Demo', 'Proposal/Price Quote', 'Negotiation/Review', 'Won', 'Lost'];
  
  const uniqueCreators = creators || [...new Set(deals.map(d => d.createdBy || d.CreatedBy).filter(Boolean))];

  return uniqueCreators.map(creator => {
    const creatorDeals = deals.filter(d => (d.createdBy === creator || d.CreatedBy === creator));
    const funnel = {};

    STAGES.forEach(stage => {
      funnel[stage] = creatorDeals.filter(d => (d.dealStage || d.DealStage) === stage).length;
    });

    return {
      creator,
      ...funnel
    };
  });
};

/**
 * Gets recently updated deals
 * @param {Array} deals - All deals
 * @param {number} hours - How many hours to look back
 * @returns {Array} Recently updated deals
 */
export const getRecentlyUpdatedDeals = (deals, hours = 24) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

  return deals
    .filter(d => {
      const updatedDate = d.updatedAt || d.UpdatedAt;
      return updatedDate && new Date(updatedDate) >= cutoff;
    })
    .sort((a, b) => new Date(b.updatedAt || b.UpdatedAt) - new Date(a.updatedAt || a.UpdatedAt))
    .slice(0, 10);
};

const userAnalyticsUtils = {
  calculateUserStats,
  calculateTeamStats,
  calculateCreatedVsUpdated,
  getDealCreatorLeaderboard,
  getDealCreationTrend,
  getConversionFunnelByCreator,
  getRecentlyUpdatedDeals
};

export default userAnalyticsUtils;
