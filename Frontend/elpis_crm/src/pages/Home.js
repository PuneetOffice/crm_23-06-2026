/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ComposedChart, Sankey, Sink, Source, Node, Link,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Label, LabelList
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Target, Briefcase,
  Filter, Calendar, MapPin, UserCircle, Building2, Tag, Download, AlertCircle,
  ArrowUpRight, ArrowDownRight, Activity, RefreshCw, X, ChevronDown, Zap, Clock,
  Award, BarChart3, TrendingUp as Trending, Eye, EyeOff, Mail, FileText, Share2,
  Settings, Home as HomeIcon, CheckCircle, AlertTriangle, Info, Plus, Minus,
  GripVertical, Search, Phone, Globe, Smartphone, Mail as MailIcon, Shield, Save, Star, Package
} from 'lucide-react';
/* eslint-enable no-unused-vars */
import apiClient from '../api/client';
import AuthContext from '../auth/AuthContext';
import HomeDealSlideIn from './HomeDealSlideIn';
import companyLogo from '../assets/Logo_2.png';
import {
  getUserAccessLevel,
  canViewAllData,
  getAccessLabel,
  getDealsFetchConfig,
  getUniqueDealCreators
} from '../utils/userAccessUtils';
import {
  calculateUserStats,
  calculateTeamStats,
  calculateCreatedVsUpdated,
  getDealCreatorLeaderboard,
  getDealCreationTrend,
  getRecentlyUpdatedDeals
} from '../utils/userAnalyticsUtils';
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â”Œâ”€ CONSTANTS & CONFIGURATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const PIPELINE_STAGES = [
  "New Lead", "Enquiry Analysis", "Under Review", "Demo",
  "Proposal/Price Quote", "Hold", "Negotiation/Review",
  "PO Received", "Won", "Lost"
];

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f43f5e'];

// Helper Functions
const formatCurrency = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);
const formatByCurrency = (value, currency = 'INR') => {
  const num = Number(value) || 0;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  } catch (e) {
    return `${currency} ${num.toFixed(2)}`;
  }
};
const safeDate = (v) => (v ? new Date(v) : null);
const toMonthLabel = (d) => d?.toLocaleString('default', { month: 'short' }) ?? '';
const getGradeColor = (score) => {
  if (score >= 85) return { grade: 'A', color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (score >= 70) return { grade: 'B', color: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' };
  if (score >= 55) return { grade: 'C', color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' };
  return { grade: 'D', color: 'bg-red-100 text-red-700', bar: 'bg-red-500' };
};
// Phase 5: Helper to format cache age
const formatCacheAge = (seconds) => {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

// Phase 6: Validation helper for deals
const validateDeal = (deal) => {
  return {
    ...deal,
    dealName: deal.dealName || deal.name || deal.Name || 'Unnamed Deal',
    accountName: deal.accountName || deal.AccountName || 'Unknown Account',
    dealValue: deal.dealValue ?? 0,
    dealStage: deal.dealStage || 'New Lead',
    salesOwner: deal.salesOwner || 'Unassigned',
    territory: deal.territory || 'Unknown',
    industryType: deal.industryType || 'Other',
    probability: deal.probability ?? 0,
    createdBy: deal.createdBy || 'Unknown',
    updatedBy: deal.updatedBy || 'Unknown',
    createdAt: deal.createdAt || new Date(),
    closedDate: deal.closedDate || null,
    expectedCloseDate: deal.expectedCloseDate || null
  };
};

// 
// LOADING SKELETON 
function LoadingDashboardSkeleton() {
  const Pulse = ({ className }) => <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6">
      <div className="max-w-[2560px] mx-auto space-y-6">
        <Pulse className="h-10 w-80" />
        <Pulse className="h-24 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Pulse key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Pulse key={i} className="h-72" />)}
        </div>
      </div>
    </div>
  );
}


const ICON_BG = ['bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600', 'bg-rose-50 text-rose-600', 'bg-cyan-50 text-cyan-600', 'bg-purple-50 text-purple-600', 'bg-teal-50 text-teal-600'];

function KPICard({ title, value, trend, trendValue, icon: Icon, index = 0, onDrill, badge, comparison, loading = false, info }) {
  const isPositive = trend === 'up';
  const iconStyle = ICON_BG[index % ICON_BG.length];
  const [showInfo, setShowInfo] = useState(false);

  if (loading) {
    return <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 animate-pulse"><div className="h-16 sm:h-20 bg-gray-100 rounded" /></div>;
  }

  return (
    <div onClick={() => onDrill?.(title)} className="group bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer relative">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-normal text-gray-500 uppercase tracking-wide">{title}</p>
            {info && <div className="relative"><button onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }} className="p-0.5 text-gray-400 hover:text-gray-600"><Info className="w-3.5 h-3.5" /></button>{showInfo && <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 w-48 whitespace-normal">{info}</div>}</div>}
          </div>
          <h3 className="text-lg sm:text-xl font-normal text-gray-900 truncate">{value}</h3>
          {badge && <span className={`inline-block text-xs font-normal mt-2 px-2 py-0.5 rounded ${badge.color}`}>{badge.text}</span>}
        </div>
        <div className={`p-1.5 sm:p-2 rounded flex-shrink-0 ${iconStyle}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
        <span className={`text-xs font-normal ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>{trendValue}</span>
        {comparison && <span className="text-xs text-gray-400 hidden sm:inline">{comparison}</span>}
      </div>
    </div>
  );
}

// 
// CHART CARD COMPONENT  
//
function ChartCard({ title, subtitle, children, className = '', action, actions = [], onClick, info }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div onClick={onClick} className={`bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-normal text-gray-900">{title}</h3>
            {info && <div className="relative"><button onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }} className="p-0.5 text-gray-400 hover:text-gray-600"><Info className="w-3.5 h-3.5" /></button>{showInfo && <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 w-56 whitespace-normal">{info}</div>}</div>}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action && <div onClick={(e) => { e.stopPropagation(); action.onClick(); }} className="cursor-pointer p-1.5 hover:bg-gray-50 rounded transition-colors">{action.icon}</div>}
          {actions.map((a, i) => <div key={i} onClick={(e) => { e.stopPropagation(); a.onClick(); }} className="cursor-pointer p-1.5 hover:bg-gray-50 rounded transition-colors" title={a.title}>{a.icon}</div>)}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// 
// ALERT COMPONENT 
// 

function AlertBanner({ severity = 'warning', title, message, onDismiss, actionText, onAction }) {
  const bgMap = { critical: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200', info: 'bg-blue-50 border-blue-200', success: 'bg-emerald-50 border-emerald-200' };
  const iconMap = { critical: AlertTriangle, warning: AlertCircle, info: Info, success: CheckCircle };
  const Icon = iconMap[severity];

  return (
    <div className={`${bgMap[severity]} border rounded-lg p-1.5 sm:p-2 mb-2 flex items-start gap-1.5`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${severity === 'critical' ? 'text-red-600' : severity === 'warning' ? 'text-amber-600' : severity === 'info' ? 'text-blue-600' : 'text-emerald-600'}`} />

      <div className="flex-1 min-w-0">
        <h4 className={`text-xs font-medium mb-0.5 ${severity === 'critical' ? 'text-red-900' : severity === 'warning' ? 'text-amber-900' : severity === 'info' ? 'text-blue-900' : 'text-emerald-900'}`}>{title}</h4>

        <p className={`text-xs leading-relaxed ${severity === 'critical' ? 'text-red-800' : severity === 'warning' ? 'text-amber-800' : severity === 'info' ? 'text-blue-800' : 'text-emerald-800'}`}>{message}</p>

        {actionText && <button onClick={onAction} className={`mt-1.5 text-xs font-medium px-3 py-1 rounded-full transition-colors ${severity === 'critical' ? 'bg-red-100 text-red-700 hover:bg-red-200' : severity === 'warning' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : severity === 'info' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>{actionText}</button>}
      </div>

      {onDismiss && <button onClick={onDismiss} className="flex-shrink-0 text-gray-400 hover:text-gray-600 hover:bg-white/50 p-0.5 rounded transition-colors" title="Close"><X className="w-4 h-4" /></button>}
    </div>
  );
}

// 
// CUSTOM TOOLTIPS 
// 

const CustomTooltip = ({ active, payload, label, isCurrency = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-2.5 text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {isCurrency ? formatCurrency(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

// 
// SECTION HEADER 
// 

function SectionHeader({ title, subtitle, icon: Icon, action, info }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl font-medium text-gray-900 truncate">{title}</h2>
          {info && (
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }} className="p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors">
                <Info className="w-4 h-4" />
              </button>
              {showInfo && (
                <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
                  {info}
                </div>
              )}
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 line-clamp-2">{subtitle}</p>}
      </div>
      {action && <button onClick={action.onClick} className="flex-shrink-0 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors flex items-center gap-2 text-xs font-medium whitespace-nowrap">{action.icon && <action.icon className="w-3.5 h-3.5" />}{action.text}</button>}
    </div>
  );
}

// 
// FILTER BAR 
// 

function FilterBar({ filters, onFilterChange, deals, onReset, onExport, canViewAll, currentUserName, uniqueCreators }) {
  const [isOpen, setIsOpen] = useState(true);
  const salesOwners = useMemo(() => [...new Set(deals.map(d => d.salesOwner).filter(Boolean))], [deals]);
  const territories = useMemo(() => [...new Set(deals.map(d => d.territory).filter(Boolean))], [deals]);
  const industries = useMemo(() => [...new Set(deals.map(d => d.industryType).filter(Boolean))], [deals]);

  // Build list of years from deal data (most recent first) + current year
  const availableYears = useMemo(() => {
    const yearSet = new Set();
    yearSet.add(new Date().getFullYear());
    deals.forEach(d => {
      if (d.createdAt) {
        const y = new Date(d.createdAt).getFullYear();
        if (!isNaN(y) && y > 2000) yearSet.add(y);
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [deals]);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6" role="region" aria-label="Filters">
      {/* Filter Header with Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-700">Filters</h3>
          {Object.values(filters).filter(f => f !== 'all' && f !== '').length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full" aria-label={`${Object.values(filters).filter(f => f !== 'all' && f !== '').length} active filters`}>
              {Object.values(filters).filter(f => f !== 'all' && f !== '').length} active
            </span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
          aria-expanded={isOpen}
          aria-controls="filter-content"
          title={isOpen ? 'Close filters' : 'Open filters'}
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 transform rotate-180" />}
        </button>
      </div>

      {/* Filter Content - Collapsible */}
      {isOpen && (
        <div id="filter-content" className="p-4 space-y-4" role="group" aria-label="Filter controls">
          <div className="flex flex-wrap gap-3">
            {/* Created By Filter - Admin/Manager only */}
            {canViewAll && (
              <div className="w-full sm:w-auto flex-shrink-0 min-w-[150px]">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Created By</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 transition-colors"
                  value={filters.createdBy}
                  onChange={(e) => onFilterChange('createdBy', e.target.value)}
                >
                  <option value="all">All Users</option>
                  {uniqueCreators.map(creator => (
                    <option key={creator} value={creator}>{creator}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div className="w-full sm:w-auto flex-shrink-0 min-w-[140px]">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Date Range</label>
              <select
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 transition-colors"
                value={filters.dateRange}
                onChange={(e) => onFilterChange('dateRange', e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Range: From/To pickers + Generate Excel Report */}
            {filters.dateRange === 'custom' && (
              <>
                <div className="w-full sm:w-auto flex-shrink-0 min-w-[150px]">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">From Date</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50 text-gray-700 transition-colors"
                    value={filters.customFrom || ''}
                    max={filters.customTo || undefined}
                    onChange={(e) => onFilterChange('customFrom', e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-auto flex-shrink-0 min-w-[150px]">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">To Date</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50 text-gray-700 transition-colors"
                    value={filters.customTo || ''}
                    min={filters.customFrom || undefined}
                    onChange={(e) => onFilterChange('customTo', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Month sub-dropdown */}
            {filters.dateRange === 'month' && (
              <div className="w-full sm:w-auto flex-shrink-0 min-w-[140px]">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Select Month</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50 text-gray-700 transition-colors"
                  value={filters.selectedMonth}
                  onChange={(e) => onFilterChange('selectedMonth', parseInt(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            )}

            {/* Quarter sub-dropdown */}
            {filters.dateRange === 'quarter' && (
              <div className="w-full sm:w-auto flex-shrink-0 min-w-[180px]">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Select Quarter</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50 text-gray-700 transition-colors"
                  value={filters.selectedQuarter}
                  onChange={(e) => onFilterChange('selectedQuarter', parseInt(e.target.value))}
                >
                  <option value={1}>Q1 — April to June</option>
                  <option value={2}>Q2 — July to September</option>
                  <option value={3}>Q3 — October to December</option>
                  <option value={4}>Q4 — January to March</option>
                </select>
              </div>
            )}

            {/* Year sub-dropdown (shown for month, quarter and year modes) */}
            {(filters.dateRange === 'month' || filters.dateRange === 'quarter' || filters.dateRange === 'year') && (
              <div className="w-full sm:w-auto flex-shrink-0 min-w-[120px]">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Select Year</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50 text-gray-700 transition-colors"
                  value={filters.selectedYear}
                  onChange={(e) => onFilterChange('selectedYear', parseInt(e.target.value))}
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {/* Other filters */}
            {[
              { key: 'territory', icon: MapPin, label: 'Territory', options: [['all', 'All Territories'], ...territories.map(t => [t, t])] },
              { key: 'salesOwner', icon: UserCircle, label: 'Sales Owner', options: [['all', 'All Owners'], ...salesOwners.map(o => [o, o])] },
              { key: 'dealStage', icon: Target, label: 'Deal Stage', options: [['all', 'All Stages'], ...PIPELINE_STAGES.map(s => [s, s])] },
              { key: 'industry', icon: Building2, label: 'Industry', options: [['all', 'All Industries'], ...industries.map(i => [i, i])] },
              { key: 'maturity', icon: Clock, label: 'Deal Maturity', options: [['all', 'All'], ['new', 'New (<7d)'], ['active', 'Active (7-60d)'], ['mature', 'Mature (60+d)']] }
            ].map(({ key, label, options }) => (
              <div key={key} className="w-full sm:w-auto flex-shrink-0 min-w-[140px]">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">{label}</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 transition-colors"
                  value={filters[key]}
                  onChange={(e) => onFilterChange(key, e.target.value)}
                >
                  {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={onReset} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors" aria-label="Reset all filters">Reset</button>
            {onExport && <button onClick={onExport} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors flex items-center gap-1.5" aria-label="Export deals to a branded Excel report"><Download className="w-3.5 h-3.5" aria-hidden="true" />Export</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// 
//  STAGE BADGE 
// 

function StageBadge({ stage }) {
  const map = {
    'New Lead': 'bg-blue-100 text-blue-700', 'Enquiry Analysis': 'bg-cyan-100 text-cyan-700',
    'Under Review': 'bg-blue-100 text-blue-700', 'Demo': 'bg-purple-100 text-purple-700',
    'Proposal/Price Quote': 'bg-amber-100 text-amber-700', 'Hold': 'bg-stone-100 text-stone-700', 'Negotiation/Review': 'bg-orange-100 text-orange-700',
    //'Follow Up': 'bg-yellow-100 text-yellow-700', 
    'RO Received': 'bg-f0f8ff text-blue-700',
    'Won': 'bg-emerald-100 text-emerald-700', 'Lost': 'bg-rose-100 text-rose-700',
  };
  return <span className={`px-3 py-1 text-xs font-bold rounded-full ${map[stage] ?? 'bg-gray-100 text-gray-700'}`}>{stage}</span>;
}

// 
// MODALS 
// 

function DrillDownModal({ isOpen, title, deals, accounts, contacts = [], onClose, dataType, currentUser, customData = [], openDealInDealsPage }) {
  if (!isOpen) return null;

  const getFilteredData = () => {
    // Always prioritize customData - used for chart drill-downs and filtered results
    if (customData && Array.isArray(customData) && customData.length > 0) {
      return customData;
    }
    if (dataType === 'Total Accounts') {
      return accounts || [];
    }
    if (dataType === 'Total Contacts') {
      return contacts || [];
    }
    if (!deals || deals.length === 0) return [];
    switch (dataType) {
      case 'Total Revenue': return deals.filter(d => d.dealStage === 'Won').sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0));
      case 'Deals Won': return deals.filter(d => d.dealStage === 'Won');
      case 'Deals Lost': return deals.filter(d => d.dealStage === 'Lost');
      case 'Win Rate': return deals.filter(d => d.dealStage === 'Won' || d.dealStage === 'Lost');
      case 'Pipeline Value': return deals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage));
      default: return deals;
    }
  };

  const filteredDeals = getFilteredData();
  const isDealData = filteredDeals.length > 0 && filteredDeals[0].dealName;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
          <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-normal text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-0">{filteredDeals.length} records found</p>
              {isDealData && <p className="text-xs text-gray-500 mt-0">Click a deal row to open the existing Deals slide-in.</p>}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white rounded-lg transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto drilldown-scroll">
            {filteredDeals.length === 0 ? (
              <div className="text-center py-16">
                <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-normal">No data available</p>
              </div>
            ) : (
              <div>
                <table className="w-full min-w-[900px] table-auto text-sm border-collapse">
                  <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: '0 1px 0 0 #5e687973' }}>
                    <tr>
                      {isDealData ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[180px]">Deal Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[160px]">Account</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[130px]">Value</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[220px]">Stage</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[130px]">Owner</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[140px]">Created By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[140px]">Updated By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase min-w-[100px]">Probability</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Details</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map((item, idx) => {
                      if (isDealData) {
                        const isRecentlyUpdated = item.updatedAt && (new Date() - new Date(item.updatedAt)) < 24 * 60 * 60 * 1000;
                        const isOwnDeal = currentUser && (item.createdBy === currentUser || item.salesOwner === currentUser);
                        return (
                          <tr key={idx} className={`border-b border-gray-100 transition-colors ${isOwnDeal ? 'bg-yellow-50 hover:bg-yellow-100' : isRecentlyUpdated ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3 font-normal text-gray-900 break-words">
                              <a
                                href={`/dashboard/Deals?id=${item.dealId || item.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  openDealInDealsPage(item);
                                }}
                                className="text-blue-600 hover:text-blue-700 cursor-pointer hover:underline"
                              >
                                {item.dealName || '—'}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-gray-600 break-words">{item.accountName || '—'}</td>
                            <td className="px-4 py-3 font-normal text-gray-900">{formatByCurrency(item.originalDealValue ?? item.dealValue ?? 0, item.originalCurrency ?? item.Currency ?? 'INR')}</td>
                            <td className="px-4 py-3"><StageBadge stage={item.dealStage} /></td>
                            <td className="px-4 py-3 text-gray-600">{item.salesOwner || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-normal text-gray-800">{item.createdBy || '—'}</span>
                                {item.createdAt && <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-normal text-gray-800">{item.updatedBy || '—'}</span>
                                {isRecentlyUpdated && <span className="px-1.5 py-0.5 bg-blue-200 text-blue-700 text-xs font-normal rounded w-fit">24h</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-normal">{item.probability ?? 0}%</span></td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-normal text-gray-900">{item.name || item.Name || `${item.FirstName || item.firstName || ''} ${item.LastName || item.lastName || ''}`.trim() || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{item.email || item.workEmail || item.WorkEmail || item.phone || item.Phone || '—'}</td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="px-6 py-2 bg-gradient-to-r from-blue-50 to-blue-100 border-t border-blue-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              <div><p className="text-xs text-blue-600">Total Records</p><p className="text-lg font-normal text-blue-900">{filteredDeals.length}</p></div>
              {isDealData && <>
                <div><p className="text-xs text-blue-600">Total Value</p><p className="text-lg font-normal text-blue-900">{formatCurrency(filteredDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0))}</p></div>
                <div><p className="text-xs text-blue-600">Avg Value</p><p className="text-lg font-normal text-blue-900">{formatCurrency(filteredDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0) / filteredDeals.length)}</p></div>
                <div><p className="text-xs text-blue-600">Avg Probability</p><p className="text-lg font-normal text-blue-900">{(filteredDeals.reduce((s, d) => s + (d.probability ?? 0), 0) / filteredDeals.length).toFixed(1)}%</p></div>
              </>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// 
// ANTICIPATED OUTCOME CARD 
//

const QUARTERS = [
  { key: 'q1', label: 'Q1', period: 'Apr — Jun' },
  { key: 'q2', label: 'Q2', period: 'Jul — Sep' },
  { key: 'q3', label: 'Q3', period: 'Oct — Dec' },
  { key: 'q4', label: 'Q4', period: 'Jan — Mar' },
];

const parseTargetValue = (value) => {
  if (value === null || value === undefined) return '';
  const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return '';
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : '';
};

const formatTargetValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const normalizeQuarterTargets = (payload) => {
  const source = Array.isArray(payload)
    ? payload.reduce((acc, item) => {
      if (!item || typeof item !== 'object') return acc;
      const keyRaw = item.quarter || item.q || item.name || item.key;
      const key = keyRaw ? String(keyRaw).trim().toLowerCase() : '';
      const targetValue = item.target ?? item.value ?? item.Target ?? item.Value;
      if (['q1', 'q2', 'q3', 'q4'].includes(key)) acc[key] = targetValue;
      return acc;
    }, {})
    : payload?.targets ?? payload;

  return {
    q1: parseTargetValue(source?.q1 ?? source?.Q1 ?? source?.q1Target ?? source?.Q1Target ?? ''),
    q2: parseTargetValue(source?.q2 ?? source?.Q2 ?? source?.q2Target ?? source?.Q2Target ?? ''),
    q3: parseTargetValue(source?.q3 ?? source?.Q3 ?? source?.q3Target ?? source?.Q3Target ?? ''),
    q4: parseTargetValue(source?.q4 ?? source?.Q4 ?? source?.q4Target ?? source?.Q4Target ?? ''),
  };
};

const getCurrentFiscalQuarter = () => {
  const month = new Date().getMonth(); // Jan=0, Feb=1, ... Dec=11

  if (month >= 3 && month <= 5) return 'q1'; // Apr-Jun
  if (month >= 6 && month <= 8) return 'q2'; // Jul-Sep
  if (month >= 9 && month <= 11) return 'q3'; // Oct-Dec
  return 'q4'; // Jan-Mar
};

const getCurrentFiscalQuarterNumber = () => {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) return 1; // Apr-Jun
  if (month >= 6 && month <= 8) return 2; // Jul-Sep
  if (month >= 9 && month <= 11) return 3; // Oct-Dec
  return 4; // Jan-Mar
};

function AnticipatedOutcomeCard({ canEdit, index = 4 }) {
  const iconStyle = ICON_BG[index % ICON_BG.length];
  const [targets, setTargets] = useState({ q1: '', q2: '', q3: '', q4: '' });
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentFiscalQuarter());
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedTarget = targets[selectedQuarter];
  const currentQuarter = QUARTERS.find((item) => item.key === selectedQuarter) || QUARTERS[0];

  useEffect(() => {
    let cancelled = false;
    const loadTargets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get('/DashboardTargets/dashboard-targets');
        const normalized = normalizeQuarterTargets(res.data);
        if (!cancelled) {
          setTargets(normalized);
        }
      } catch (err) {
        if (!cancelled) setError('Unable to load quarter targets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTargets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setInputValue(formatTargetValue(targets[selectedQuarter]) || '');
  }, [selectedQuarter, targets]);

  const updateQuarterTarget = async (quarter, value) => {
    const numeric = parseTargetValue(value);
    if (numeric === '') return;
    if (parseTargetValue(targets[quarter]) === numeric) return;

    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/DashboardTargets/dashboard-targets/${quarter}`, { target: numeric });
      setTargets((prev) => ({ ...prev, [quarter]: numeric }));
      setInputValue(formatTargetValue(numeric));
    } catch (err) {
      console.error(err);
      setError('Unable to save target. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const rawValue = e.target.value;
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    setInputValue(cleaned);
  };

  const handleInputBlur = () => {
    if (!canEdit) return;
    updateQuarterTarget(selectedQuarter, inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="group bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 relative">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Target</p>
          <p className="text-[11px] text-gray-400 mb-2">{currentQuarter.label} · {currentQuarter.period}</p>

          {canEdit ? (
            <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 h-8 px-2 mt-1 w-full">
              <span className="text-xs font-medium text-gray-400 select-none flex-shrink-0">₹</span>
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                placeholder="Enter value…"
                className="h-full w-full min-w-0 border-none bg-transparent px-1 text-sm text-gray-800 focus:outline-none placeholder-gray-400 tabular-nums"
              />
            </div>
          ) : selectedTarget !== '' ? (
            <h3 className="text-lg sm:text-xl font-normal text-gray-900 truncate mt-1">₹{formatTargetValue(selectedTarget)}</h3>
          ) : (
            <p className="text-sm text-gray-400 italic mt-1">No outcome set yet</p>
          )}
        </div>

        {/* Icon + dropdown stacked on the right */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={`p-1.5 sm:p-2 rounded ${iconStyle} mb-1.5`}>
            <Target className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="h-7 w-11 rounded border border-gray-200 bg-white px-0.5 text-[10px] text-gray-700 focus:outline-none cursor-pointer"
          >
            {QUARTERS.map((q) => (
              <option key={q.key} value={q.key}>{q.label}</option>
            ))}
          </select>

        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {selectedTarget !== '' ? (
          <>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="text-xs font-normal text-emerald-600">Target set</span>
          </>
        ) : (
          <>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="text-xs font-normal text-gray-400">{canEdit ? 'Enter target above' : 'Not yet defined'}</span>
          </>
        )}
        {saving && <span className="text-xs font-normal text-slate-500">Saving...</span>}
        {loading && <span className="text-xs font-normal text-slate-500">Loading targets…</span>}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

// 
// MAIN HOME COMPONENT 
// 

export default function Home() {
  // Authentication Context
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const userName = auth?.getUserName?.();
  const userAccessLevel = getUserAccessLevel(userRole);
  const canViewAll = canViewAllData(userRole);
  const accessLabel = getAccessLabel(userRole, userName);

  // Data State
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [accountTotalCount, setAccountTotalCount] = useState(0);
  const [contactTotalCount, setContactTotalCount] = useState(0);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [lifecycleStats, setLifecycleStats] = useState({
    prospect: 0,
    engaged: 0,
    customer: 0,
    promoter: 0,
    other: 0,
  });
  const [drillAccounts, setDrillAccounts] = useState([]);
  const [drillContacts, setDrillContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [noDealsbannerDismissed, setNoDealsbannerDismissed] = useState(false);

  // Filter State
  const [filters, setFilters] = useState({
    dateRange: 'all',
    selectedMonth: new Date().getMonth(),   // 0-11 (Jan=0)
    selectedQuarter: getCurrentFiscalQuarterNumber(),                     // 1-4 (Q1=Apr-Jun, Indian fiscal)
    selectedYear: new Date().getFullYear(),
    customFrom: '',   // YYYY-MM-DD — Custom Range report only
    customTo: '',     // YYYY-MM-DD — Custom Range report only
    territory: 'all',
    salesOwner: 'all',
    dealStage: 'all',
    industry: 'all',
    maturity: 'all',
    createdBy: canViewAll ? 'all' : userName // Auto-filter users to their own deals
  });

  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownType, setDrillDownType] = useState('');
  const [drillDownData, setDrillDownData] = useState([]);

  //  Home-page deal slide-in (no navigation away) 
  const [homeSlideInDealId, setHomeSlideInDealId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null); // { text, type }

  const showToast = (text, type = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const openDealSlideIn = (deal) => {
    const id = deal?.dealId || deal?.id || deal?.Id || deal?.DealId;
    if (!id) return;
    setHomeSlideInDealId(id);
  };

  useEffect(() => {
    if (!drillDownOpen) {
      setDrillAccounts([]);
      setDrillContacts([]);
      return;
    }
    if (drillDownType !== 'Total Accounts' && drillDownType !== 'Total Contacts') return;
    let cancelled = false;
    (async () => {
      try {
        if (drillDownType === 'Total Accounts') {
          const res = await apiClient.get('/Account', { params: { page: 1, pageSize: 500 } });
          const body = res.data;
          const rows = Array.isArray(body) ? body : body?.items || body?.Items || [];
          if (!cancelled) setDrillAccounts(rows);
        } else {
          const res = await apiClient.get('/Contact', { params: { page: 1, pageSize: 500 } });
          const body = res.data;
          const rows = Array.isArray(body) ? body : body?.items || body?.Items || [];
          if (!cancelled) setDrillContacts(rows);
        }
      } catch {
        if (!cancelled) {
          if (drillDownType === 'Total Accounts') setDrillAccounts([]);
          else setDrillContacts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drillDownOpen, drillDownType]);

  // Kept for backward-compat (DrillDownModal and links still call this)
  // but now opens the Home-page slide-in instead of navigating away.
  const openDealInDealsPage = openDealSlideIn;

  const handleStageClick = (payload) => {
    if (!payload || !payload.deals) return;
    handleDrillDown(`${payload.name} deals`, payload.deals);
  };

  const handleOwnerDrillDown = (owner) => {
    if (!owner || !owner.owner) return;
    const ownerDeals = filteredDeals.filter(d => d.salesOwner === owner.owner);
    handleDrillDown(`${owner.owner} deals`, ownerDeals);
  };

  const handleIndustryClick = (industryData) => {
    if (!industryData || !industryData.name) return;
    const industryDeals = deals.filter(d => d.dealStage === 'Won' && d.industryType === industryData.name);
    handleDrillDown(`${industryData.name} - Revenue (${formatCurrency(industryData.value)})`, industryDeals);
  };

  const handleDealAgingClick = (ageRange) => {
    if (!ageRange) return;
    const today = new Date();
    let agingDeals = [];

    switch (ageRange) {
      case '0-30':
        agingDeals = deals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage) && d.createdAt && (today - new Date(d.createdAt)) / 86400000 <= 30);
        break;
      case '31-60':
        agingDeals = deals.filter(d => {
          if (['Won', 'Lost', 'PO Received'].includes(d.dealStage) || !d.createdAt) return false;
          const age = (today - new Date(d.createdAt)) / 86400000;
          return age > 30 && age <= 60;
        });
        break;
      case '61-90':
        agingDeals = deals.filter(d => {
          if (['Won', 'Lost', 'PO Received'].includes(d.dealStage) || !d.createdAt) return false;
          const age = (today - new Date(d.createdAt)) / 86400000;
          return age > 60 && age <= 90;
        });
        break;
      case '90+':
        agingDeals = deals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage) && d.createdAt && (today - new Date(d.createdAt)) / 86400000 > 90);
        break;
      default:
        return;
    }

    handleDrillDown(`Deals Aging ${ageRange} Days (${agingDeals.length})`, agingDeals);
  };

  const handleCreatorClick = (creator) => {
    if (!creator || !creator.user) return;
    const creatorDeals = deals.filter(d => d.createdBy === creator.user);
    handleDrillDown(`Deals Created by ${creator.user} (${creatorDeals.length})`, creatorDeals);
  };

  const handleActivityMetricsClick = (type) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (type === 'created') {
      const createdDeals = deals.filter(d => {
        if (!d.createdAt) return false;
        const dealDate = new Date(d.createdAt);
        return dealDate.getMonth() === currentMonth && dealDate.getFullYear() === currentYear;
      });
      handleDrillDown(`Deals Created This Month (${createdDeals.length})`, createdDeals);
    } else if (type === 'updated') {
      const updatedDeals = deals.filter(d => {
        if (!d.updatedAt) return false;
        const dealDate = new Date(d.updatedAt);
        return dealDate.getMonth() === currentMonth && dealDate.getFullYear() === currentYear;
      });
      handleDrillDown(`Deals Updated This Month (${updatedDeals.length})`, updatedDeals);
    }
  };

  // Phase 5: Caching & Optimization
  const cacheRef = React.useRef({ deals: null, timestamp: null, CACHE_DURATION: 2 * 60 * 1000 }); // 2 minutes
  const [cacheAge, setCacheAge] = useState(0);
  const cacheTimerRef = React.useRef(null);

  // Data Fetching with User-Based Access Control
  const fetchDataRef = React.useRef(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Phase 5: Check cache before fetching
        const now = Date.now();
        if (cacheRef.current.deals && cacheRef.current.timestamp &&
          (now - cacheRef.current.timestamp) < cacheRef.current.CACHE_DURATION) {
          const cachedDeals = cacheRef.current.deals;
          setDeals(cachedDeals);
          try {
            const [accountsRes, contactsRes, productsRes, lifeRes] = await Promise.all([
              apiClient.get("/Account", { params: { page: 1, pageSize: 1 } }),
              apiClient.get("/Contact", { params: { page: 1, pageSize: 1 } }),
              apiClient.get("/Products").catch(() => ({ data: [] })),
              apiClient.get("/Contact/stats/lifecycle").catch(() => ({ data: {} })),
            ]);
            const extractTotal = (payload) => {
              if (!payload) return 0;
              if (Array.isArray(payload)) return payload.length;
              const t = payload.totalCount ?? payload.TotalCount;
              return typeof t === "number" ? t : 0;
            };
            setAccountTotalCount(extractTotal(accountsRes.data));
            setContactTotalCount(extractTotal(contactsRes.data));
            setProductTotalCount(extractTotal(productsRes.data));
            const ld = lifeRes.data || {};
            setLifecycleStats({
              prospect: Number(ld.prospect ?? ld.Prospect ?? 0),
              engaged: Number(ld.engaged ?? ld.Engaged ?? 0),
              customer: Number(ld.customer ?? ld.Customer ?? 0),
              promoter: Number(ld.promoter ?? ld.Promoter ?? 0),
              other: Number(ld.other ?? ld.Other ?? 0),
            });
          } catch {
            /* keep previous totals */
          }
          setLastUpdated(new Date(cacheRef.current.timestamp));
          setLoading(false);
          startCacheTimer();
          return;
        }

        // Determine which endpoint to use based on user access level
        const fetchConfig = getDealsFetchConfig(userRole, userName);
        const dealEndpoint = fetchConfig.endpoint;

        // Fetch deals - use appropriate endpoint
        const dealsRes = await apiClient.get(dealEndpoint);

        const extractTotal = (payload) => {
          if (!payload) return 0;
          if (Array.isArray(payload)) return payload.length;
          const t = payload.totalCount ?? payload.TotalCount;
          if (typeof t === "number") return t;
          return 0;
        };

        const [accountsRes, contactsRes, productsRes, lifeRes] = await Promise.all([
          apiClient.get("/Account", { params: { page: 1, pageSize: 1 } }),
          apiClient.get("/Contact", { params: { page: 1, pageSize: 1 } }),
          apiClient.get("/Products").catch(() => ({ data: [] })),
          apiClient.get("/Contact/stats/lifecycle").catch(() => ({ data: {} })),
        ]);

        const dealsData = Array.isArray(dealsRes.data) ? dealsRes.data.map(d => {
          // Handle both camelCase and PascalCase from API
          const origDealValue = d.dealValue ?? d.DealValue ?? 0;
          const origCurrency = d.currency ?? d.Currency ?? 'INR';
          const normalized = {
            ...d,
            accountId: d.accountId || d.AccountId,
            accountName: d.accountName || d.AccountName,
            createdAt: safeDate(d.createdAt || d.CreatedAt),
            closedDate: safeDate(d.closedDate || d.ClosedDate),
            expectedCloseDate: safeDate(d.expectedCloseDate || d.ExpectedCloseDate),
            createdBy: d.createdBy || d.CreatedBy,
            updatedBy: d.updatedBy || d.UpdatedBy,
            dealStage: d.dealStage || d.DealStage,
            // Normalized dealValue is the INR/base currency value (source of truth for calculations)
            dealValue: (
              d.dealValueInBaseCurrency ??
              d.DealValueInBaseCurrency ??
              d.dealValueInINR ??
              d.DealValueInINR ??
              d.dealValue ??
              d.DealValue ??
              0
            ),
            // preserve original entered amount and currency for UI display
            originalDealValue: origDealValue,
            originalCurrency: origCurrency,
            salesOwner: d.salesOwner || d.SalesOwner,
            territory: d.territory || d.Territory,
            industryType: d.industryType || d.IndustryType,
            probability: d.probability || d.Probability,
            dealName: d.dealName || d.Name
          };
          // Phase 6: Validate critical fields
          return validateDeal(normalized);
        }) : [];

        // Debug: Log first deal to check field names
        if (dealsData.length > 0) {
          console.log('First deal structure:', dealsData[0]);
          console.log('User access level:', userAccessLevel);
          console.log('User name:', userName);
          console.log('Total deals loaded:', dealsData.length);
        }

        // Phase 5: Store in cache
        cacheRef.current.deals = dealsData;
        cacheRef.current.timestamp = now;
        setCacheAge(0);

        setDeals(dealsData);
        setAccountTotalCount(extractTotal(accountsRes.data));
        setContactTotalCount(extractTotal(contactsRes.data));
        setProductTotalCount(extractTotal(productsRes.data));
        setAccounts([]);
        setContacts([]);
        const ld = lifeRes.data || {};
        setLifecycleStats({
          prospect: Number(ld.prospect ?? ld.Prospect ?? 0),
          engaged: Number(ld.engaged ?? ld.Engaged ?? 0),
          customer: Number(ld.customer ?? ld.Customer ?? 0),
          promoter: Number(ld.promoter ?? ld.Promoter ?? 0),
          other: Number(ld.other ?? ld.Other ?? 0),
        });
        setLastUpdated(new Date());
        startCacheTimer();
      } catch (err) {
        // Phase 6: Enhanced error handling
        let errorMessage = 'Failed to fetch dashboard data. Please try again.';

        if (err.response?.status === 403) {
          errorMessage = 'You do not have permission to access this dashboard. Contact your administrator.';
        } else if (err.response?.status === 401) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (err.response?.status === 404) {
          errorMessage = 'API endpoint not found. Please contact support.';
        } else if (err.message === 'Network Error') {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        }

        setError(errorMessage);
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDataRef.current = fetchData;
    if (userRole && userName) {
      fetchData();
    }
    const interval = setInterval(fetchData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [userRole, userName, userAccessLevel]);

  // Refetch dashboard when any import completes
  useEffect(() => {
    const handler = () => { fetchDataRef.current?.(); };
    window.addEventListener("importComplete", handler);
    return () => window.removeEventListener("importComplete", handler);
  }, []);

  // Phase 5: Cache timer - update displayed age of cached data
  const startCacheTimer = () => {
    if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
    cacheTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (cacheRef.current.timestamp || 0)) / 1000);
      setCacheAge(elapsed);
    }, 1000);
  };

  // Invalidate cache on filter changes
  useEffect(() => {
    cacheRef.current.timestamp = null;
  }, [filters]);

  // Cleanup cache timer
  useEffect(() => {
    return () => {
      if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
    };
  }, []);

  // Filtered Data with User Access Control
  const filteredDeals = useMemo(() => {
    let result = deals;
    const today = new Date();

    // Apply user access level filtering
    if (!canViewAll) {
      // Regular users only see their own deals
      result = result.filter(d => (d.createdBy === userName || d.CreatedBy === userName));
    } else if (filters.createdBy && filters.createdBy !== 'all') {
      // Admins/managers can filter by specific user
      result = result.filter(d => (d.createdBy === filters.createdBy || d.CreatedBy === filters.createdBy));
    }

    // Apply other filters
    if (filters.territory !== 'all') result = result.filter(d => d.territory === filters.territory);
    if (filters.salesOwner !== 'all') result = result.filter(d => d.salesOwner === filters.salesOwner);
    if (filters.dealStage !== 'all') result = result.filter(d => d.dealStage === filters.dealStage);
    if (filters.industry !== 'all') result = result.filter(d => d.industryType === filters.industry);

    if (filters.dateRange === 'month') {
      // Filter by selected calendar month + year
      const start = new Date(filters.selectedYear, filters.selectedMonth, 1);
      const end = new Date(filters.selectedYear, filters.selectedMonth + 1, 0, 23, 59, 59);
      result = result.filter(d => d.createdAt && d.createdAt >= start && d.createdAt <= end);
    } else if (filters.dateRange === 'quarter') {
      // Indian fiscal quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
      const quarterMonthMap = {
        1: { startMonth: 3, endMonth: 5 }, // Apr-Jun
        2: { startMonth: 6, endMonth: 8 }, // Jul-Sep
        3: { startMonth: 9, endMonth: 11 }, // Oct-Dec
        4: { startMonth: 0, endMonth: 2 }, // Jan-Mar
      };
      const { startMonth, endMonth } = quarterMonthMap[filters.selectedQuarter] || quarterMonthMap[1];
      const start = new Date(filters.selectedYear, startMonth, 1);
      const end = new Date(filters.selectedYear, endMonth + 1, 0, 23, 59, 59);
      result = result.filter(d => d.createdAt && d.createdAt >= start && d.createdAt <= end);
    } else if (filters.dateRange === 'year') {
      const start = new Date(filters.selectedYear, 0, 1);
      const end = new Date(filters.selectedYear, 11, 31, 23, 59, 59);
      result = result.filter(d => d.createdAt && d.createdAt >= start && d.createdAt <= end);
    }
    // 'all' â†’ no date filtering

    if (filters.maturity !== 'all') {
      result = result.filter(d => {
        if (!d.createdAt) return false;
        const age = Math.floor((today - d.createdAt) / 86400000);
        if (filters.maturity === 'new') return age < 7;
        if (filters.maturity === 'active') return age >= 7 && age < 60;
        if (filters.maturity === 'mature') return age >= 60;
        return true;
      });
    }

    return result;
  }, [deals, filters, userName, canViewAll]);

  // Analytics Calculations
  const analytics = useMemo(() => {
    const today = new Date();
    // Revenue is based on 'Won' deals only
    const won = filteredDeals.filter(d => d.dealStage === 'Won');
    const lost = filteredDeals.filter(d => d.dealStage === 'Lost');
    // Open pipeline = everything that is not Won, Lost, or PO Received
    const open = filteredDeals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage));

    const totalRevenue = won.reduce((s, d) => s + (d.dealValue ?? 0), 0);
    const dealsWon = won.length;
    const dealsLost = lost.length;
    const winRate = dealsWon + dealsLost > 0 ? (dealsWon / (dealsWon + dealsLost) * 100).toFixed(1) : 0;
    const avgDealSize = dealsWon > 0 ? (totalRevenue / dealsWon).toFixed(0) : 0;
    const pipelineValue = open.reduce((s, d) => s + (d.dealValue ?? 0), 0);
    const expectedRevenue = open.reduce((s, d) => s + ((d.dealValue ?? 0) * (d.probability ?? 0) / 100), 0);

    const healthScore = Math.round(winRate * 0.7 + Math.min(dealsWon * 5, 30));
    const stalledDeals = open.filter(d => d.createdAt && Math.floor((today - d.createdAt) / 86400000) > 60);

    const byStage = {};
    PIPELINE_STAGES.forEach(s => byStage[s] = []);
    filteredDeals.forEach(d => {
      if (byStage[d.dealStage]) byStage[d.dealStage].push(d);
    });

    const pipelineByStage = PIPELINE_STAGES.map((stage, i) => ({
      name: stage,
      value: byStage[stage].reduce((s, d) => s + (d.dealValue ?? 0), 0),
      count: byStage[stage].length,
      deals: byStage[stage]
    }));

    const ownerStats = {};
    filteredDeals.forEach(d => {
      if (!ownerStats[d.salesOwner]) ownerStats[d.salesOwner] = { won: 0, lost: 0, value: 0, count: 0 };
      ownerStats[d.salesOwner].count++;
      ownerStats[d.salesOwner].value += d.dealValue ?? 0;
      if (d.dealStage === 'Won' || d.dealStage === 'PO Received') ownerStats[d.salesOwner].won++;
      if (d.dealStage === 'Lost') ownerStats[d.salesOwner].lost++;
    });

    const winRateByOwner = Object.entries(ownerStats).map(([owner, stats]) => ({
      owner,
      winRate: stats.won + stats.lost > 0 ? ((stats.won / (stats.won + stats.lost)) * 100).toFixed(1) : 0,
      won: stats.won,
      deals: stats.count,
      revenue: stats.value
    })).sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));

    const territoryStats = {};
    filteredDeals.forEach(d => {
      if (!territoryStats[d.territory]) territoryStats[d.territory] = { value: 0, won: 0, count: 0 };
      territoryStats[d.territory].value += d.dealValue ?? 0;
      territoryStats[d.territory].count++;
      if (['Won', 'PO Received'].includes(d.dealStage)) territoryStats[d.territory].won++;
    });

    const territoryMetrics = Object.entries(territoryStats).map(([territory, stats]) => ({
      territory,
      revenue: stats.value,
      deals: stats.count,
      dealsWon: stats.won,
      winRate: stats.count > 0 ? ((stats.won / stats.count) * 100).toFixed(1) : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const monthData = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    won.filter(d => d.closedDate && d.closedDate >= sixMonthsAgo).forEach(d => {
      const key = toMonthLabel(d.closedDate);
      monthData[key] = (monthData[key] ?? 0) + (d.dealValue ?? 0);
    });

    const revenueTrend = Object.entries(monthData).map(([month, revenue]) => ({
      month,
      actual: revenue,
      expected: revenue * 1.05,
      deals: filteredDeals.filter(d => d.closedDate && toMonthLabel(d.closedDate) === month).length
    }));

    const dealAging = {
      '0-30': open.filter(d => d.createdAt && (today - d.createdAt) / 86400000 <= 30).length,
      '31-60': open.filter(d => d.createdAt && (today - d.createdAt) / 86400000 > 30 && (today - d.createdAt) / 86400000 <= 60).length,
      '61-90': open.filter(d => d.createdAt && (today - d.createdAt) / 86400000 > 60 && (today - d.createdAt) / 86400000 <= 90).length,
      '90+': open.filter(d => d.createdAt && (today - d.createdAt) / 86400000 > 90).length
    };

    const industryRevenue = {};
    won.forEach(d => {
      industryRevenue[d.industryType] = (industryRevenue[d.industryType] ?? 0) + (d.dealValue ?? 0);
    });

    const industryData = Object.entries(industryRevenue).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const highValueDeals = filteredDeals.filter(d => d.dealValue && d.dealValue > 100000).sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0)).slice(0, 5);

    const lowWinRateDeals = winRate < 30 ? lost.concat(won).slice(0, 100) : [];
    const alerts = [];
    if (healthScore < 60) alerts.push({ id: 'health', severity: 'critical', title: 'Low Pipeline Health', message: `Score is ${healthScore}. Investigate stalled deals or low win rates.`, data: stalledDeals });
    if (stalledDeals.length > 0) alerts.push({ id: 'stalled', severity: 'warning', title: `${stalledDeals.length} Stalled Deals`, message: `${stalledDeals.length} deals have been in the same stage for over 60 days.`, data: stalledDeals });
    if (winRate < 30 && dealsWon + dealsLost > 5) alerts.push({ id: 'winrate', severity: 'warning', title: 'Low Win Rate', message: `Current win rate is ${winRate}%. Review lost deal reasons.`, data: lowWinRateDeals });

    // Phase 2: User-based analytics
    const userStats = !canViewAll ? calculateUserStats(filteredDeals, userName) : null;
    const teamStats = canViewAll ? calculateTeamStats(deals) : null;
    const createdVsUpdated = calculateCreatedVsUpdated(deals, 'thisMonth');
    const userLeaderboard = canViewAll ? getDealCreatorLeaderboard(deals, 'revenue', 10) : [];
    const dealCreationTrend = canViewAll ? getDealCreationTrend(deals, 3) : [];
    const recentUpdates = getRecentlyUpdatedDeals(deals, 24);

    // Get unique creators for the CreatedBy filter (moved here to avoid hook order violation)
    const uniqueCreators = getUniqueDealCreators(deals);

    return {
      healthScore, totalRevenue, dealsWon, dealsLost, winRate, avgDealSize, pipelineValue, expectedRevenue, stalledDeals: stalledDeals.length,
      pipelineByStage, revenueTrend, dealAging, winRateByOwner, territoryMetrics, industryData, highValueDeals, alerts, stalledDealsData: stalledDeals, lowWinRateDealsData: lowWinRateDeals,
      // Phase 2 additions
      userStats, teamStats, createdVsUpdated, userLeaderboard, dealCreationTrend, recentUpdates, uniqueCreators
    };
  }, [filteredDeals, deals, canViewAll, userName]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      dateRange: 'all',
      selectedMonth: new Date().getMonth(),
      selectedQuarter: 1,
      selectedYear: new Date().getFullYear(),
      customFrom: '',
      customTo: '',
      territory: 'all',
      salesOwner: 'all',
      dealStage: 'all',
      industry: 'all',
      maturity: 'all',
      createdBy: canViewAll ? 'all' : userName
    });
  };

  const handleDrillDown = (title, dataToPass = []) => {
    setDrillDownTitle(title);
    setDrillDownType(title);
    setDrillDownData(dataToPass);
    setDrillDownOpen(true);
  };

  const handleAlertAction = (alert) => {
    handleDrillDown(alert.title, alert.data || []);
  };

  const handleDismissAlert = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const handleCloseError = () => {
    setError(null);
  };

  // Export button → branded Excel report.
  //   • Custom Range selected → custom-range report (From/To).
  //   • Otherwise → full branded Excel of the currently filtered deals.
  const handleExport = () => {
    if (filters.dateRange === 'custom') {
      handleGenerateCustomReport();
      return;
    }
    handleExportExcel();
  };

  // Professional, company-branded Excel (.xlsx) report — logo, address, styled table.
  // Uses ExcelJS (lazy-loaded) because SheetJS can't embed images or apply styling.
  const handleExportExcel = async () => {
    if (filteredDeals.length === 0) {
      alert('No deals found for the selected filters / date range.');
      return;
    }

    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;

    // Brand palette
    const BRAND = 'FF573C66';      // primary purple
    const BRAND_LIGHT = 'FFEDE7F1';
    const BAND = 'FFF5F7FA';       // alternating row
    const WHITE = 'FFFFFFFF';
    const MUTED = 'FF6B7280';
    const BORDER = 'FFE5E7EB';
    const thin = { style: 'thin', color: { argb: BORDER } };
    const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

    // Report metadata
    const exportDate = new Date().toLocaleString('en-IN');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dateRangeLabel =
      filters.dateRange === 'month'
        ? `${monthNames[filters.selectedMonth]} ${filters.selectedYear}`
        : filters.dateRange === 'quarter'
          ? `Q${filters.selectedQuarter} ${filters.selectedYear}`
          : filters.dateRange === 'year'
            ? `${filters.selectedYear}`
            : 'All Time';

    const totalDeals = filteredDeals.length;
    const totalValue = filteredDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0);
    const wonDeals = filteredDeals.filter(d => ['Won', 'PO Received'].includes(d.dealStage)).length;
    const avgValue = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;

    const fmtDate = (val) => {
      if (!val) return '—';
      const dt = val instanceof Date ? val : new Date(val);
      if (isNaN(dt)) return '—';
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const COLUMNS = [
      { header: 'Deal Name', key: 'dealName', width: 28 },
      { header: 'Account', key: 'accountName', width: 24 },
      { header: 'Value (INR)', key: 'dealValue', width: 16, numeric: true },
      { header: 'Stage', key: 'dealStage', width: 16 },
      { header: 'Probability (%)', key: 'probability', width: 14, numeric: true },
      { header: 'Owner', key: 'salesOwner', width: 18 },
      { header: 'Territory', key: 'territory', width: 16 },
      { header: 'Industry', key: 'industryType', width: 18 },
      { header: 'Created By', key: 'createdBy', width: 18 },
      { header: 'Created Date', key: 'createdAt', width: 15 },
      { header: 'Updated By', key: 'updatedBy', width: 18 },
      { header: 'Updated Date', key: 'updatedAt', width: 15 },
      { header: 'Days in Pipeline', key: 'days', width: 15, numeric: true }
    ];
    const LAST_COL = COLUMNS.length; // 13
    const lastColLetter = String.fromCharCode(64 + LAST_COL); // 'M'

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Elpis CRM';
    wb.created = new Date();
    const ws = wb.addWorksheet('Deals Report', {
      // A4 print template — scale all columns onto one A4 page width
      pageSetup: {
        paperSize: 9,              // A4
        orientation: 'landscape',  // 13 columns fit better wide
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      },
      headerFooter: { oddFooter: '&LElpis IT Solutions Pvt Ltd&RPage &P of &N' }
    });

    ws.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));

    // ── Compact header (rows 1–3): small logo in the top-left corner + details ─
    ws.mergeCells('A1:B3');
    ws.mergeCells(`C1:${lastColLetter}1`);
    ws.mergeCells(`C2:${lastColLetter}2`);
    ws.mergeCells(`C3:${lastColLetter}3`);

    const nameCell = ws.getCell('C1');
    nameCell.value = 'Elpis IT Solutions Pvt Ltd';
    nameCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: BRAND } };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const hqCell = ws.getCell('C2');
    hqCell.value = 'Bengaluru — HQ';
    hqCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND } };
    hqCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const addrCell = ws.getCell('C3');
    addrCell.value = 'No. 102/1, 3rd Floor, Outer Ring Road, Kamadhenu Nagar, B Narayanapura, Mahadevapura, Bengaluru, Karnataka 560016, India';
    addrCell.font = { name: 'Calibri', size: 8, color: { argb: MUTED } };
    addrCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws.getRow(1).height = 16;
    ws.getRow(2).height = 13;
    ws.getRow(3).height = 13;

    // Embed a small logo tucked into the top-left corner (cells A1:B3)
    try {
      const res = await fetch(companyLogo);
      const buffer = await res.arrayBuffer();
      const imgId = wb.addImage({ buffer, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0.1, row: 0.25 }, ext: { width: 120, height: 28 } });
    } catch (e) {
      // If the logo can't be loaded, fall back to a text wordmark
      ws.getCell('A1').value = 'ELPIS';
      ws.getCell('A1').font = { size: 14, bold: true, color: { argb: BRAND } };
      ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Brand divider row (row 5)
    ws.mergeCells(`A5:${lastColLetter}5`);
    const titleCell = ws.getCell('A5');
    titleCell.value = `CRM Deals Report   —   ${dateRangeLabel}`;
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: WHITE } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    ws.getRow(5).height = 24;

    // Meta line (row 6)
    ws.mergeCells(`A6:${lastColLetter}6`);
    const metaCell = ws.getCell('A6');
    metaCell.value = `Generated: ${exportDate}    |    Prepared by: ${userName || '—'}`;
    metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(6).height = 16;

    // ── KPI strip (row 8): label/value pairs ────────────────────────────────
    const kpis = [
      ['Total Deals', String(totalDeals)],
      ['Total Value', `INR ${totalValue.toLocaleString('en-IN')}`],
      ['Won Deals', String(wonDeals)],
      ['Avg Value', `INR ${avgValue.toLocaleString('en-IN')}`]
    ];
    // Each KPI spans ~3 columns: label row 8, styled box
    let col = 1;
    const span = Math.floor(LAST_COL / kpis.length); // ~3
    kpis.forEach(([label, value], i) => {
      const startCol = col;
      const endCol = i === kpis.length - 1 ? LAST_COL : col + span - 1;
      const s = String.fromCharCode(64 + startCol);
      const e = String.fromCharCode(64 + endCol);
      ws.mergeCells(`${s}8:${e}8`);
      const cell = ws.getCell(`${s}8`);
      cell.value = { richText: [
        { text: `${label}\n`, font: { size: 8, color: { argb: MUTED }, bold: true } },
        { text: value, font: { size: 12, bold: true, color: { argb: BRAND } } }
      ] };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } };
      cell.border = allBorders;
      col = endCol + 1;
    });
    ws.getRow(8).height = 34;

    // ── Count Summary (above the details) ───────────────────────────────────
    const nowC = new Date();
    const classifyOutcome = (d) => {
      const stage = d.dealStage || '';
      const reason = (d.lostReason || '').trim();
      if (['Won', 'PO Received'].includes(stage)) return 'Won';
      if (stage === 'Lost') return /withdr|cancel/i.test(reason) ? 'Withdrew' : 'Lost';
      const last = d.updatedAt ? new Date(d.updatedAt) : (d.createdAt ? new Date(d.createdAt) : nowC);
      return (nowC - last) / 86400000 > 60 ? 'Stalled' : 'Open';
    };
    const cycleDays = (d) => {
      const c = d.createdAt ? new Date(d.createdAt) : null;
      if (!c || isNaN(c)) return null;
      const end = d.closedDate ? new Date(d.closedDate) : nowC;
      return Math.max(0, Math.round((end - c) / 86400000));
    };
    const outcomeCounts = { Won: 0, Lost: 0, Stalled: 0, Withdrew: 0, Open: 0 };
    const spMap = {};
    const reasonMap = {};
    const cyc = [];
    filteredDeals.forEach(d => {
      const o = classifyOutcome(d);
      outcomeCounts[o] = (outcomeCounts[o] || 0) + 1;
      const sp = d.salesOwner || 'Unassigned';
      spMap[sp] = (spMap[sp] || 0) + 1;
      if (['Lost', 'Withdrew'].includes(o)) {
        const key = (d.lostReason || '').trim() || 'Not specified';
        reasonMap[key] = (reasonMap[key] || 0) + 1;
      }
      const cd = cycleDays(d);
      if (cd != null) cyc.push(cd);
    });
    const bySales = Object.entries(spMap).sort((a, b) => b[1] - a[1]);
    const byReason = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
    const avgCycle = cyc.length ? Math.round(cyc.reduce((a, b) => a + b, 0) / cyc.length) : 0;

    const colLetter = (n) => String.fromCharCode(64 + n);
    const titleBand = (rowNum, text) => {
      ws.mergeCells(`A${rowNum}:${lastColLetter}${rowNum}`);
      const c = ws.getCell(`A${rowNum}`);
      c.value = text; c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(rowNum).height = 18;
    };
    // Place a count group (heading + item/value rows) side-by-side starting at startCol
    const placeGroup = (startCol, heading, items, headRow) => {
      const c1 = colLetter(startCol), c2 = colLetter(startCol + 1);
      ws.mergeCells(`${c1}${headRow}:${c2}${headRow}`);
      const h = ws.getCell(`${c1}${headRow}`);
      h.value = heading; h.font = { name: 'Calibri', size: 8, bold: true, color: { argb: WHITE } };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      h.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
      h.border = allBorders;
      const h2 = ws.getCell(`${c2}${headRow}`); h2.border = allBorders; h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      items.forEach(([label, value], i) => {
        const rr = headRow + 1 + i;
        const lc = ws.getCell(`${c1}${rr}`); lc.value = label; lc.font = { name: 'Calibri', size: 8, color: { argb: 'FF1F2937' } }; lc.alignment = { vertical: 'middle', horizontal: 'left' }; lc.border = allBorders;
        const vc = ws.getCell(`${c2}${rr}`); vc.value = value; vc.font = { name: 'Calibri', size: 8, bold: true, color: { argb: BRAND } }; vc.alignment = { vertical: 'middle', horizontal: 'right' }; vc.border = allBorders;
      });
    };

    const outcomeItems = ['Won', 'Lost', 'Stalled', 'Withdrew', 'Open'].map(o => [o === 'Open' ? 'Open/In-Progress' : o, outcomeCounts[o] || 0]);
    const salesItems = bySales.length ? bySales.map(([name, count]) => [name, count]) : [['—', 0]];
    const reasonItems = byReason.length ? byReason.map(([reason, count]) => [reason, count]) : [['None', 0]];
    const dealSizeItems = [['Total (INR)', totalValue.toLocaleString('en-IN')], ['Average (INR)', avgValue.toLocaleString('en-IN')]];
    const cycleItems = [['Average (Days)', avgCycle]];

    let cs = 10;
    titleBand(cs, 'Count Summary'); cs++;
    const groupHeadRow = cs;
    // 5 groups laid out horizontally across columns A–J
    placeGroup(1, 'Outcome', outcomeItems, groupHeadRow);
    placeGroup(3, 'Salesperson', salesItems, groupHeadRow);
    placeGroup(5, 'Reason (Lost/Withdrew)', reasonItems, groupHeadRow);
    placeGroup(7, 'Deal Size', dealSizeItems, groupHeadRow);
    placeGroup(9, 'Sales Cycle', cycleItems, groupHeadRow);
    const maxItems = Math.max(outcomeItems.length, salesItems.length, reasonItems.length, dealSizeItems.length, cycleItems.length);

    // ── Table header (dynamic, below the horizontal count summary) ──────────
    const HEADER_ROW = groupHeadRow + 1 + maxItems + 1; // heading + tallest group + blank gap
    ws.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`; // repeat column headers on every A4 page
    const headerRow = ws.getRow(HEADER_ROW);
    COLUMNS.forEach((c, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = c.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'right' : 'left', wrapText: true };
      cell.border = allBorders;
    });
    headerRow.height = 22;

    // ── Data rows ───────────────────────────────────────────────────────────
    filteredDeals.forEach((d, i) => {
      const rowNum = HEADER_ROW + 1 + i;
      const row = ws.getRow(rowNum);
      const values = {
        dealName: d.dealName || '—',
        accountName: d.accountName || '—',
        dealValue: d.dealValue || 0,
        dealStage: d.dealStage || '—',
        probability: d.probability ?? 0,
        salesOwner: d.salesOwner || '—',
        territory: d.territory || '—',
        industryType: d.industryType || '—',
        createdBy: d.createdBy || '—',
        createdAt: fmtDate(d.createdAt),
        updatedBy: d.updatedBy || '—',
        updatedAt: fmtDate(d.updatedAt),
        days: d.createdAt ? Math.floor((new Date() - new Date(d.createdAt)) / 86400000) : 0
      };
      COLUMNS.forEach((c, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = values[c.key];
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'right' : 'left' };
        cell.border = allBorders;
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
        if (c.key === 'dealValue') cell.numFmt = '#,##0';
      });
      row.height = 18;
    });

    // Autofilter over the table
    const lastDataRow = HEADER_ROW + filteredDeals.length;
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastDataRow, column: LAST_COL } };

    // ── Footer ──────────────────────────────────────────────────────────────
    const footerRowNum = lastDataRow + 2;
    ws.mergeCells(`A${footerRowNum}:${lastColLetter}${footerRowNum}`);
    const footer = ws.getCell(`A${footerRowNum}`);
    footer.value = '© 2026 Elpis IT Solutions Pvt Ltd. All rights reserved.';
    footer.font = { name: 'Calibri', size: 8, italic: true, color: { argb: MUTED } };
    footer.alignment = { vertical: 'middle', horizontal: 'center' };

    // ── Download ──────────────────────────────────────────────────────────────
    const out = await wb.xlsx.writeBuffer();
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Elpis-CRM-Deals-Report-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Custom Range report — validate From/To, filter deals to that range, and export a
  // company-branded Excel with a Report Information section + serial-numbered table.
  const handleGenerateCustomReport = async () => {
    const fromStr = filters.customFrom; // YYYY-MM-DD
    const toStr = filters.customTo;

    // Validation
    if (!fromStr) { alert('From Date is mandatory.'); return; }
    if (!toStr) { alert('To Date is mandatory.'); return; }
    if (new Date(toStr) < new Date(fromStr)) { alert('To Date cannot be before From Date.'); return; }

    // Filter records to the selected range (inclusive)
    const start = new Date(`${fromStr}T00:00:00`);
    const end = new Date(`${toStr}T23:59:59`);
    const records = (deals || []).filter(d => {
      if (!d.createdAt) return false;
      const created = d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
      return created >= start && created <= end;
    });

    if (records.length === 0) {
      alert('No records found for the selected date range.');
      return;
    }

    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;

    // Helpers
    const toDMY = (yyyyMmDd) => {
      const [y, m, d] = yyyyMmDd.split('-');
      return `${d}-${m}-${y}`;
    };
    const fmtDate = (val) => {
      if (!val) return '—';
      const dt = val instanceof Date ? val : new Date(val);
      if (isNaN(dt)) return '—';
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      return `${dd}-${mm}-${dt.getFullYear()}`;
    };
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const generatedOn = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Brand palette
    const BRAND = 'FF573C66';
    const BAND = 'FFF5F7FA';
    const WHITE = 'FFFFFFFF';
    const MUTED = 'FF6B7280';
    const BORDER = 'FFE5E7EB';
    const thin = { style: 'thin', color: { argb: BORDER } };
    const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

    // Columns (serial first)
    const COLUMNS = [
      { header: 'S.No', key: 'sno', width: 6, numeric: true },
      { header: 'Deal Name', key: 'dealName', width: 28 },
      { header: 'Account', key: 'accountName', width: 24 },
      { header: 'Value (INR)', key: 'dealValue', width: 16, numeric: true, money: true },
      { header: 'Stage', key: 'dealStage', width: 16 },
      { header: 'Probability (%)', key: 'probability', width: 14, numeric: true },
      { header: 'Owner', key: 'salesOwner', width: 18 },
      { header: 'Territory', key: 'territory', width: 16 },
      { header: 'Industry', key: 'industryType', width: 18 },
      { header: 'Created By', key: 'createdBy', width: 18 },
      { header: 'Created Date', key: 'createdAt', width: 15 },
      { header: 'Updated By', key: 'updatedBy', width: 18 },
      { header: 'Updated Date', key: 'updatedAt', width: 15 }
    ];
    const LAST_COL = COLUMNS.length; // 13
    const lastColLetter = String.fromCharCode(64 + LAST_COL);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Elpis CRM';
    wb.created = now;
    const ws = wb.addWorksheet('Custom Range Report', {
      // A4 print template — scale all columns onto one A4 page width
      pageSetup: {
        paperSize: 9,              // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      },
      headerFooter: { oddFooter: '&LElpis IT Solutions Pvt Ltd&RPage &P of &N' }
    });
    ws.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));

    // ── Compact header (rows 1–3): small logo in the top-left corner + details ─
    ws.mergeCells('A1:B3');
    ws.mergeCells(`C1:${lastColLetter}1`);
    ws.mergeCells(`C2:${lastColLetter}2`);
    ws.mergeCells(`C3:${lastColLetter}3`);

    const nameCell = ws.getCell('C1');
    nameCell.value = 'Elpis IT Solutions Pvt Ltd';
    nameCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: BRAND } };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const hqCell = ws.getCell('C2');
    hqCell.value = 'Bengaluru — HQ';
    hqCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND } };
    hqCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const addrCell = ws.getCell('C3');
    addrCell.value = 'No. 102/1, 3rd Floor, Outer Ring Road, Kamadhenu Nagar B, Narayanapura, Mahadevapura, Bengaluru, Karnataka 560016, India';
    addrCell.font = { name: 'Calibri', size: 8, color: { argb: MUTED } };
    addrCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws.getRow(1).height = 16;
    ws.getRow(2).height = 13;
    ws.getRow(3).height = 13;

    try {
      const res = await fetch(companyLogo);
      const buffer = await res.arrayBuffer();
      const imgId = wb.addImage({ buffer, extension: 'png' });
      // Small logo tucked into the top-left corner (cells A1:B3)
      ws.addImage(imgId, { tl: { col: 0.1, row: 0.25 }, ext: { width: 120, height: 28 } });
    } catch (e) {
      ws.getCell('A1').value = 'ELPIS';
      ws.getCell('A1').font = { size: 14, bold: true, color: { argb: BRAND } };
      ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // ── Report Information section ───────────────────────────────────────────
    const infoRows = [
      ['Report Name', 'Custom Range Report'],
      ['Date Range', `From: ${toDMY(fromStr)}    To: ${toDMY(toStr)}`],
      ['Generated By', userName || '—'],
      ['Generated On', generatedOn]
    ];
    let infoRowNum = 5;
    infoRows.forEach(([label, value]) => {
      const labelCell = ws.getCell(`A${infoRowNum}`);
      ws.mergeCells(`A${infoRowNum}:B${infoRowNum}`);
      labelCell.value = label;
      labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

      ws.mergeCells(`C${infoRowNum}:${lastColLetter}${infoRowNum}`);
      const valueCell = ws.getCell(`C${infoRowNum}`);
      valueCell.value = value;
      valueCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      valueCell.alignment = { vertical: 'middle', horizontal: 'left' };

      ws.getRow(infoRowNum).height = 18;
      infoRowNum++;
    });

    // ── Count Summary (between header and data) ─────────────────────────────
    const classifyOutcome = (d) => {
      const stage = d.dealStage || '';
      const reason = (d.lostReason || '').trim();
      if (['Won', 'PO Received'].includes(stage)) return 'Won';
      if (stage === 'Lost') return /withdr|cancel/i.test(reason) ? 'Withdrew' : 'Lost';
      const last = d.updatedAt ? new Date(d.updatedAt) : (d.createdAt ? new Date(d.createdAt) : now);
      return (now - last) / 86400000 > 60 ? 'Stalled' : 'Open';
    };
    const cycleDaysC = (d) => {
      const c = d.createdAt ? new Date(d.createdAt) : null;
      if (!c || isNaN(c)) return null;
      const end = d.closedDate ? new Date(d.closedDate) : now;
      return Math.max(0, Math.round((end - c) / 86400000));
    };
    const outcomeCounts = { Won: 0, Lost: 0, Stalled: 0, Withdrew: 0, Open: 0 };
    const spMap = {};
    const reasonMap = {};
    const cyc = [];
    records.forEach(d => {
      const o = classifyOutcome(d);
      outcomeCounts[o] = (outcomeCounts[o] || 0) + 1;
      const sp = d.salesOwner || 'Unassigned';
      spMap[sp] = (spMap[sp] || 0) + 1;
      if (['Lost', 'Withdrew'].includes(o)) {
        const key = (d.lostReason || '').trim() || 'Not specified';
        reasonMap[key] = (reasonMap[key] || 0) + 1;
      }
      const cd = cycleDaysC(d);
      if (cd != null) cyc.push(cd);
    });
    const bySales = Object.entries(spMap).sort((a, b) => b[1] - a[1]);
    const byReason = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
    const avgCycle = cyc.length ? Math.round(cyc.reduce((a, b) => a + b, 0) / cyc.length) : 0;
    const totalValueC = records.reduce((s, d) => s + (d.dealValue || 0), 0);
    const avgValueC = records.length ? Math.round(totalValueC / records.length) : 0;

    const colLetter = (n) => String.fromCharCode(64 + n);
    const titleBand = (rowNum, text) => {
      ws.mergeCells(`A${rowNum}:${lastColLetter}${rowNum}`);
      const c = ws.getCell(`A${rowNum}`);
      c.value = text; c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(rowNum).height = 18;
    };
    const placeGroup = (startCol, heading, items, headRow) => {
      const c1 = colLetter(startCol), c2 = colLetter(startCol + 1);
      ws.mergeCells(`${c1}${headRow}:${c2}${headRow}`);
      const h = ws.getCell(`${c1}${headRow}`);
      h.value = heading; h.font = { name: 'Calibri', size: 8, bold: true, color: { argb: WHITE } };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      h.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
      h.border = allBorders;
      const h2 = ws.getCell(`${c2}${headRow}`); h2.border = allBorders; h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      items.forEach(([label, value], i) => {
        const rr = headRow + 1 + i;
        const lc = ws.getCell(`${c1}${rr}`); lc.value = label; lc.font = { name: 'Calibri', size: 8, color: { argb: 'FF1F2937' } }; lc.alignment = { vertical: 'middle', horizontal: 'left' }; lc.border = allBorders;
        const vc = ws.getCell(`${c2}${rr}`); vc.value = value; vc.font = { name: 'Calibri', size: 8, bold: true, color: { argb: BRAND } }; vc.alignment = { vertical: 'middle', horizontal: 'right' }; vc.border = allBorders;
      });
    };

    const outcomeItems = ['Won', 'Lost', 'Stalled', 'Withdrew', 'Open'].map(o => [o === 'Open' ? 'Open/In-Progress' : o, outcomeCounts[o] || 0]);
    const salesItems = bySales.length ? bySales.map(([name, count]) => [name, count]) : [['—', 0]];
    const reasonItems = byReason.length ? byReason.map(([reason, count]) => [reason, count]) : [['None', 0]];
    const dealSizeItems = [['Total (INR)', totalValueC.toLocaleString('en-IN')], ['Average (INR)', avgValueC.toLocaleString('en-IN')]];
    const cycleItems = [['Average (Days)', avgCycle]];

    let cs = infoRowNum + 1; // one blank row gap
    titleBand(cs, 'Count Summary'); cs++;
    const groupHeadRow = cs;
    // 5 groups laid out horizontally across columns B–K (col A is the narrow S.No)
    placeGroup(2, 'Outcome', outcomeItems, groupHeadRow);
    placeGroup(4, 'Salesperson', salesItems, groupHeadRow);
    placeGroup(6, 'Reason (Lost/Withdrew)', reasonItems, groupHeadRow);
    placeGroup(8, 'Deal Size', dealSizeItems, groupHeadRow);
    placeGroup(10, 'Sales Cycle', cycleItems, groupHeadRow);
    const maxItems = Math.max(outcomeItems.length, salesItems.length, reasonItems.length, dealSizeItems.length, cycleItems.length);

    // ── Table header (dynamic, below the horizontal count summary) ──────────
    const HEADER_ROW = groupHeadRow + 1 + maxItems + 1; // heading + tallest group + blank gap
    ws.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`; // repeat column headers on every A4 page
    const headerRow = ws.getRow(HEADER_ROW);
    COLUMNS.forEach((c, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = c.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
      cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'right' : 'left', wrapText: true };
      cell.border = allBorders;
    });
    headerRow.height = 22;

    // ── Data rows ───────────────────────────────────────────────────────────
    records.forEach((d, i) => {
      const rowNum = HEADER_ROW + 1 + i;
      const row = ws.getRow(rowNum);
      const values = {
        sno: i + 1,
        dealName: d.dealName || '—',
        accountName: d.accountName || '—',
        dealValue: d.dealValue || 0,
        dealStage: d.dealStage || '—',
        probability: d.probability ?? 0,
        salesOwner: d.salesOwner || '—',
        territory: d.territory || '—',
        industryType: d.industryType || '—',
        createdBy: d.createdBy || '—',
        createdAt: fmtDate(d.createdAt),
        updatedBy: d.updatedBy || '—',
        updatedAt: fmtDate(d.updatedAt)
      };
      COLUMNS.forEach((c, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = values[c.key];
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'middle', horizontal: c.numeric ? 'right' : 'left' };
        cell.border = allBorders;
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
        if (c.money) cell.numFmt = '#,##0';
      });
      row.height = 18;
    });

    const lastDataRow = HEADER_ROW + records.length;
    ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: lastDataRow, column: LAST_COL } };

    // ── Footer ──────────────────────────────────────────────────────────────
    const footerRowNum = lastDataRow + 2;
    ws.mergeCells(`A${footerRowNum}:${lastColLetter}${footerRowNum}`);
    const footer = ws.getCell(`A${footerRowNum}`);
    footer.value = '© 2026 Elpis IT Solutions Pvt Ltd. All rights reserved.';
    footer.font = { name: 'Calibri', size: 8, italic: true, color: { argb: MUTED } };
    footer.alignment = { vertical: 'middle', horizontal: 'center' };

    // ── Download: Custom_Range_Report_FromDate_to_ToDate.xlsx ────────────────
    const out = await wb.xlsx.writeBuffer();
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Custom_Range_Report_${toDMY(fromStr)}_to_${toDMY(toStr)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingDashboardSkeleton />;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 overflow-x-hidden">
        <div className="max-w-[2560px] mx-auto px-4 sm:px-6 py-2 sm:py-3 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
            <div className="min-w-0 shrink">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-base sm:text-lg font-normal text-gray-900 truncate">Dashboard</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-normal rounded-full ${accessLabel.badge}`}>
                  {userAccessLevel === 'user' ? 'Your' : canViewAll ? 'All Users' : 'Team'}
                </span>
              </div>
              <p className="text-xs text-gray-600 truncate">{accessLabel.description}</p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <button onClick={() => window.location.reload()} className="p-1.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0" title="Refresh"><RefreshCw className="w-4 h-4 text-gray-600" /></button>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                Updated {lastUpdated.toLocaleTimeString()}
                {cacheAge > 0 && <span className="text-gray-400 ml-1">(cached {formatCacheAge(cacheAge)})</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[2560px] mx-auto px-4 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        {/* No Data Message for Regular Users */}
        {!canViewAll && filteredDeals.length === 0 && !error && !noDealsbannerDismissed && (
          <AlertBanner
            severity="info"
            title="No Deals Yet"
            message={`You haven't created any deals yet. Start creating deals to see them on your dashboard.`}
            onDismiss={() => setNoDealsbannerDismissed(true)}
          />
        )}

        {/* Alerts - Dismissible */}
        {analytics.alerts.length > 0 && (
          <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
            {analytics.alerts.filter(alert => !dismissedAlerts.has(alert.id)).map(alert => (
              <AlertBanner key={alert.id} severity={alert.severity} title={alert.title} message={alert.message} onDismiss={() => handleDismissAlert(alert.id)} actionText="View Details" onAction={() => handleAlertAction(alert)} />
            ))}
          </div>
        )}

        {/* Error Alert */}
        {error && <AlertBanner severity="critical" title="Data Load Error" message={error} onDismiss={handleCloseError} />}

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          deals={deals}
          onReset={handleReset}
          onExport={handleExport}
          canViewAll={canViewAll}
          currentUserName={userName}
          uniqueCreators={analytics.uniqueCreators}
        />

        {/* ROW 1: DEAL PIPELINE MASTERY */}
        <div className="mb-6 sm:mb-8">
          <SectionHeader title="Deal Pipeline Mastery" subtitle="Real-time deal health, pipeline progression, and conversion intelligence" icon={Target} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <AnticipatedOutcomeCard canEdit={canViewAll} index={0} />
            <KPICard title="Pipeline Health Score" value={analytics.healthScore} trend={analytics.healthScore > 70 ? 'up' : 'down'} trendValue={`${analytics.healthScore > 70 ? '+' : ''}${(analytics.healthScore - 70).toFixed(0)}pts vs 70`} icon={Award} index={1} onDrill={handleDrillDown} badge={getGradeColor(analytics.healthScore)} />
            <KPICard title="Total Revenue (Won)" value={formatCurrency(analytics.totalRevenue)} trend={analytics.dealsWon > 0 ? 'up' : 'down'} trendValue={`${analytics.dealsWon} won deal${analytics.dealsWon !== 1 ? 's' : ''}`} icon={DollarSign} index={2} onDrill={handleDrillDown} comparison="from Won deals only" info="Sum of deal values for all deals in 'Won' stage within the selected filter period." />
            <KPICard title="Deals Won" value={analytics.dealsWon} trend={analytics.dealsWon > 0 ? 'up' : 'down'} trendValue={`${analytics.dealsLost} lost`} icon={TrendingUp} index={3} onDrill={handleDrillDown} comparison="this period" />
            <KPICard title="Win Rate" value={`${analytics.winRate}%`} trend={analytics.winRate > 50 ? 'up' : 'down'} trendValue={`${analytics.dealsWon + analytics.dealsLost} closed deals`} icon={Target} index={4} onDrill={handleDrillDown} comparison="won ÷ closed" info="Win Rate = Won deals ÷ (Won + Lost) deals × 100" />
          </div>

          {/* Pipeline by Stage - Full Width */}
          {(() => {
            const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const quarterLabels = { 1: 'Q1 Apr—Jun', 2: 'Q2 Jul—Sep', 3: 'Q3 Oct—Dec', 4: 'Q4 Jan—Mar' };
            const pipelineSubtitle =
              filters.dateRange === 'all' ? 'All-time deal count across every pipeline stage' :
                filters.dateRange === 'month' ? `${MONTHS_SHORT[filters.selectedMonth]} ${filters.selectedYear} — deal count by stage` :
                  filters.dateRange === 'quarter' ? `${quarterLabels[filters.selectedQuarter]} ${filters.selectedYear} — deal count by stage` :
                    filters.dateRange === 'year' ? `${filters.selectedYear} — deal count by stage` :
                      'Deal count distribution across all stages';

            // Ensure pipelineByStage uses ALL filteredDeals (already correct — this is a safety re-derive)
            const stageData = analytics.pipelineByStage.map(s => ({
              ...s,
              // Show 0 explicitly so every stage appears on the chart even with no deals
              value: s.value || 0,
              count: s.count || 0,
            }));

            // Full-height transparent background rect — makes the entire column clickable, not just the bar
            const StageColumnHitArea = ({ x, y, width, height, index }) => (
              <rect
                x={x} y={y} width={width} height={height}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => handleStageClick(stageData[index])}
              />
            );

            return (
              <ChartCard
                title="Pipeline by Stage"
                subtitle={pipelineSubtitle}
                actions={[{ icon: <Download className="w-4 h-4" />, onClick: handleExport, title: 'Export' }]}
                className="mb-4 sm:mb-6"
                info="Shows deal count for every stage in the selected period. 'All Time' includes every deal ever created regardless of date."
              >
                {stageData.every(s => s.count === 0) ? (
                  <div className="flex items-center justify-center h-72 text-gray-400 text-sm">
                    No deals found for the selected period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={370}>
                    <BarChart
                      data={stageData}
                      margin={{ top: 24, right: 16, left: 16, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10, fill: '#666' }}
                        label={{ value: 'Deal Stage', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#666' }}
                        width={44}
                        allowDecimals={false}
                        tickFormatter={(v) => v}
                        label={{ value: 'Deal Count', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 11 }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-white border border-gray-200 rounded shadow-md p-2.5 text-xs">
                              <p className="font-medium text-gray-900 mb-1">{label}</p>
                              {payload.map((p, i) => (
                                <div key={i} style={{ color: p.color }}>
                                  Deals: <span className="font-semibold">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name="Deal Count"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                        cursor="pointer"
                        onClick={(data) => handleStageClick(data.payload)}
                        background={<StageColumnHitArea />}
                      >
                        {stageData.map((entry, i) => {
                          const stageColorMap = {
                            "New Lead": "#93c5fd",
                            "Enquiry Analysis": "#93c5fd",
                            "Under Review": "#93c5fd",
                            "Demo": "#93c5fd",
                            "Proposal/Price Quote": "#93c5fd",
                            "Hold": "#93c5fd",
                            "Negotiation/Review": "#93c5fd",
                            //"Follow Up": "#93c5fd",
                            "PO Received": "#93c5fd",
                            "Won": "#bbf7d0",
                            "Lost": "#fecaca",
                          };
                          return <Cell key={`cell-${i}`} fill={stageColorMap[entry.name] || "#93c5fd"} />;
                        })}
                        <LabelList
                          dataKey="count"
                          position="top"
                          isAnimationActive={false}
                          style={{ fontSize: 9, fill: '#374151', fontWeight: 500 }}
                          formatter={(v) => (v > 0 ? v : '')}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Revenue Trend */}
            <ChartCard title="Revenue Trend (6 Months)" subtitle="Actual revenue vs expected pipeline conversion">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={analytics.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="actual" fill="#3b82f6" stroke="#1e40af" fillOpacity={0.1} name="Actual" />
                  <Line type="monotone" dataKey="expected" stroke="#8b5cf6" strokeDasharray="5 5" name="Expected" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Deal Aging Distribution */}
            <ChartCard title="Deal Aging Distribution" subtitle="Open deals by age in days - Click to view deals">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={[
                      { name: '0-30 Days', value: analytics.dealAging['0-30'], ageRange: '0-30' },
                      { name: '31-60 Days', value: analytics.dealAging['31-60'], ageRange: '31-60' },
                      { name: '61-90 Days', value: analytics.dealAging['61-90'], ageRange: '61-90' },
                      { name: '90+ Days', value: analytics.dealAging['90+'], ageRange: '90+' }
                    ]}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={75}
                    onClick={(entry) => handleDealAgingClick(entry.payload.ageRange)}
                    style={{ cursor: 'pointer' }}
                  >
                    {[0, 1, 2, 3].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: '12px', paddingBottom: '10px', paddingTop: '15px' }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Sales Rep Performance */}
          <ChartCard title="Sales Rep Performance" subtitle="Win rate, deals, and revenue by owner" className="mt-5">
            <div className="space-y-2 max-h-72 overflow-y-auto deal-cards-scrollbar">
              {analytics.winRateByOwner.slice(0, 10).map((owner, i) => (
                <div key={i} onClick={() => handleOwnerDrillDown(owner)} className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{owner.owner}</p>
                    <p className="text-xs text-gray-500">{owner.deals} deals • {formatCurrency(owner.revenue)}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-lg font-medium text-blue-600">{owner.winRate}%</p>
                    <p className="text-xs text-gray-500">win rate</p>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* ROW 2: SALES PERFORMANCE & TERRITORY */}
        <div className="mb-8">
          <SectionHeader title="Sales Performance & Territory Intelligence" subtitle="Sales rep effectiveness, territory health, and competitive positioning" icon={BarChart3} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Territory Performance */}
            <ChartCard title="Territory Performance" subtitle="Revenue and deals by territory">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.territoryMetrics} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="territory" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar yAxisId="left" dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="deals" fill="#3b82f6" name="Deals" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Industry Revenue Breakdown */}
            <ChartCard title="Revenue by Industry" subtitle="Closed revenue distribution - Click to view deals">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.industryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={80}
                    onClick={(entry) => handleIndustryClick(entry.payload)}
                    style={{ cursor: 'pointer' }}
                  >
                    {analytics.industryData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <KPICard
              title="Pipeline Value"
              value={formatCurrency(analytics.pipelineValue)}
              trend={analytics.pipelineValue > 0 ? 'up' : 'down'}
              trendValue={`${filteredDeals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage)).length} open deals`}
              icon={Briefcase}
              index={4}
              onDrill={handleDrillDown}
              comparison="total value of open deals"
              info="Sum of deal values for all active (non-closed) pipeline deals."
            />
            <KPICard
              title="Expected Revenue"
              value={formatCurrency(Math.round(analytics.expectedRevenue))}
              trend={analytics.expectedRevenue > 0 ? 'up' : 'down'}
              trendValue="probability-weighted"
              icon={TrendingUp}
              index={5}
              onDrill={handleDrillDown}
              comparison="deal value × probability"
              info="Each open deal's value multiplied by its close probability, then summed. A realistic revenue forecast."
            />
            <KPICard
              title="Avg Deal Size (Won)"
              value={formatCurrency(analytics.avgDealSize)}
              trend={analytics.dealsWon > 0 ? 'up' : 'down'}
              trendValue={analytics.dealsWon > 0 ? `from ${analytics.dealsWon} won deals` : 'No won deals yet'}
              icon={DollarSign}
              index={6}
              onDrill={handleDrillDown}
              comparison="avg value of Won deals"
              info="Total revenue from Won deals divided by the number of Won deals."
            />
          </div>
        </div>

        {/* ROW 3: CUSTOMER INTELLIGENCE */}
        <div className="mb-8">
          <SectionHeader title="Customer Relationship Intelligence" subtitle="engagement, and relationship health" icon={Users} />

          {(() => {
            const uniqueAccountCount = new Set(filteredDeals.map(d => d.accountId).filter(Boolean)).size;
            const avgRevenuePerAccount = analytics.totalRevenue / Math.max(uniqueAccountCount, 1);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard
                  title="Total Accounts"
                  value={accountTotalCount}
                  trend="up"
                  trendValue="in system"
                  icon={Building2}
                  index={0}
                  onDrill={() => { window.location.href = '/dashboard/Accounts'; }}
                  comparison="click to view all"
                  info="Total number of accounts in the CRM system."
                />
                <KPICard
                  title="Total Contacts"
                  value={contactTotalCount}
                  trend="up"
                  trendValue="in system"
                  icon={Users}
                  index={1}
                  onDrill={() => { window.location.href = '/dashboard/Contacts'; }}
                  comparison="click to view all"
                  info="Total number of contacts in the CRM system."
                />

                <KPICard
                  title="Total Products"
                  value={productTotalCount}
                  trend="up"
                  trendValue="in system"
                  icon={Package}
                  index={3}
                  onDrill={() => { window.location.href = '/dashboard/Products'; }}
                  comparison="click to view all"
                  info="Total number of products in the CRM system."
                />

                <KPICard
                  title="Avg Revenue / Account"
                  value={formatCurrency(avgRevenuePerAccount)}
                  trend={avgRevenuePerAccount > 0 ? 'up' : 'down'}
                  trendValue={`${uniqueAccountCount} accounts with deals`}
                  icon={DollarSign}
                  index={2}
                  onDrill={handleDrillDown}
                  comparison="Won revenue ÷ accounts"
                  info="Total won revenue divided by the number of unique accounts in the current filter."
                />
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Contact Activity */}
            <ChartCard title="Lost Deal Reasons" subtitle="Why deals are being lost — click to view">
              {(() => {
                const lostDeals = filteredDeals.filter(d => d.dealStage === 'Lost');
                const reasonGroups = lostDeals.reduce((acc, d) => {
                  const key = d.lostReason?.trim();
                  if (!key) return acc;
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {});

                const data = Object.entries(reasonGroups)
                  .map(([reason, count]) => ({ reason, count }))
                  .filter(item => item.count >= 10)
                  .sort((a, b) => b.count - a.count);

                const total = lostDeals.length;

                if (data.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                      <TrendingDown className="w-8 h-8 text-gray-300" />
                      <p className="text-sm">No significant lost reasons yet</p>
                    </div>
                  );
                }

                const maxCount = data[0].count;

                return (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1 deal-cards-scrollbar">
                    {data.map((item, i) => {
                      const pct = Math.round((item.count / maxCount) * 100);
                      const lostPct = ((item.count / total) * 100).toFixed(1);
                      const barColor = 'from-orange-400 to-orange-300';

                      return (
                        <div
                          key={i}
                          onClick={() => {
                            const reasonDeals = filteredDeals.filter(d =>
                              d.dealStage === 'Lost' && d.lostReason?.trim() === item.reason
                            );
                            handleDrillDown(`Lost — ${item.reason} (${reasonDeals.length})`, reasonDeals);
                          }}
                          className="cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[55%] group-hover:text-rose-600 transition-colors">{item.reason}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{item.count} deal{item.count !== 1 ? 's' : ''} · {lostPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </ChartCard>

            {/* Top High-Value Deals */}
            <ChartCard title="Top High-Value Deals" subtitle="Deals exceeding ₹1,00,000 in value">
              {analytics.highValueDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                  <DollarSign className="w-8 h-8 text-gray-300" />
                  <p className="text-sm">No high-value deals found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1 deal-cards-scrollbar">
                  {(() => {
                    const maxValue = Math.max(...analytics.highValueDeals.map(d => d.dealValue ?? 0), 1);
                    return analytics.highValueDeals.map((deal, i) => {
                      const pct = Math.round(((deal.dealValue ?? 0) / maxValue) * 100);
                      const barColor = 'from-indigo-500 to-sky-400';

                      return (
                        <div
                          key={i}
                          onClick={(e) => { e.preventDefault(); openDealInDealsPage(deal); }}
                          className="cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[55%] group-hover:text-sky-600 transition-colors">
                              {deal.dealName}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {formatByCurrency(deal.originalDealValue ?? deal.dealValue ?? 0, deal.originalCurrency ?? deal.Currency ?? 'INR')} · {deal.dealStage}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </ChartCard>
          </div>
        </div>

        {/* ROW 4: FORECASTING & TRENDS */}
        <div className="mb-8">
          <SectionHeader title="Revenue Forecasting & Trends" subtitle="Predictive analytics and trend analysis" icon={TrendingUp} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Forecast Comparison */}
            <ChartCard title="Revenue Forecast vs Actual" subtitle="3-month rolling comparison">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={analytics.revenueTrend.slice(-3)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip isCurrency />} />
                  <Legend />
                  <Bar dataKey="actual" fill="#3b82f6" name="Actual Revenue" radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="expected" stroke="#f59e0b" strokeWidth={2} name="Expected" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Pipeline Status */}
            <ChartCard title="Pipeline Stage Status" subtitle="Deal count and value across all stages">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 deal-cards-scrollbar">
                {analytics.pipelineByStage.map((stage, i) => {
                  const maxCount = Math.max(...analytics.pipelineByStage.map(s => s.count), 1);
                  const pct = Math.round((stage.count / maxCount) * 100);
                  const barColor = stage.name === 'Won' ? 'from-emerald-500 to-emerald-400' :
                    stage.name === 'Lost' ? 'from-rose-500 to-rose-400' :
                      'from-blue-500 to-cyan-400';
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[55%]">{stage.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{stage.count} deal{stage.count !== 1 ? 's' : ''} · {formatCurrency(stage.value)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </div>
        </div>

        {/* ROW 5: OPERATIONAL HEALTH */}
        <div>
          <SectionHeader title="Operational Health & System Metrics" subtitle="Data quality, team activity, and engagement metrics" icon={Activity} />

          {/* Compute real-time metrics for this section */}
          {(() => {
            // Data completeness: % of deals that have all key fields filled
            const keyFields = ['dealName', 'accountName', 'salesOwner', 'territory', 'dealValue', 'probability', 'dealStage'];
            const completenessScore = filteredDeals.length === 0 ? 100 :
              Math.round(
                filteredDeals.reduce((sum, d) => {
                  const filled = keyFields.filter(f => d[f] != null && d[f] !== '' && d[f] !== 0).length;
                  return sum + (filled / keyFields.length) * 100;
                }, 0) / filteredDeals.length
              );
            const completenessGrade = completenessScore >= 90 ? 'Excellent' : completenessScore >= 70 ? 'Good' : 'Needs Work';
            const completenessColor = completenessScore >= 90 ? 'bg-emerald-100 text-emerald-700' : completenessScore >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';

            // Deal conversion: Won ÷ all closed (won + lost) × 100
            const closedDeals = filteredDeals.filter(d => ['Won', 'Lost'].includes(d.dealStage));
            const wonDeals = filteredDeals.filter(d => d.dealStage === 'Won');
            const conversionRate = closedDeals.length > 0 ? ((wonDeals.length / closedDeals.length) * 100).toFixed(1) : '0.0';

            // Stalled ratio: open deals stalled > 60 days as a proxy for team responsiveness
            const openDeals = filteredDeals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage));
            const today = new Date();
            const stalledCount = openDeals.filter(d => d.createdAt && (today - d.createdAt) / 86400000 > 60).length;
            const responsivenessScore = openDeals.length === 0
              ? 100
              : Math.round(((openDeals.length - stalledCount) / openDeals.length) * 100);
            const responsivenessLabel = responsivenessScore >= 80 ? 'Active' : responsivenessScore >= 60 ? 'Fair' : 'At Risk';
            const responsivenessColor = responsivenessScore >= 80 ? 'bg-emerald-100 text-emerald-700' : responsivenessScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard
                  title="Data Completeness"
                  value={`${completenessScore}%`}
                  trend={completenessScore >= 70 ? 'up' : 'down'}
                  trendValue={`${keyFields.length} fields checked`}
                  icon={CheckCircle}
                  index={0}
                  onDrill={handleDrillDown}
                  badge={{ color: completenessColor, text: completenessGrade }}
                  comparison="across active deals"
                  info="Percentage of deals that have all 7 key fields (name, account, owner, territory, value, probability, stage) filled in."
                />
                <KPICard
                  title="Deal Conversion Rate"
                  value={`${conversionRate}%`}
                  trend={parseFloat(conversionRate) >= 50 ? 'up' : 'down'}
                  trendValue={`${wonDeals.length} won / ${closedDeals.length} closed`}
                  icon={Target}
                  index={1}
                  onDrill={handleDrillDown}
                  comparison="Won ÷ Closed deals"
                  info="Won deals divided by total closed (Won + Lost) deals, expressed as a percentage."
                />
                <KPICard
                  title="Pipeline Responsiveness"
                  value={`${responsivenessScore}%`}
                  trend={responsivenessScore >= 80 ? 'up' : 'down'}
                  trendValue={`${stalledCount} stalled >60d`}
                  icon={Activity}
                  index={2}
                  onDrill={handleDrillDown}
                  badge={{ color: responsivenessColor, text: responsivenessLabel }}
                  comparison="of open deals are active"
                  info="Percentage of open deals that have been active (created or updated) within the last 60 days."
                />
                <KPICard
                  title="Open Deals"
                  value={openDeals.length}
                  trend={openDeals.length > 0 ? 'up' : 'down'}
                  trendValue={`${analytics.stalledDeals} stalled`}
                  icon={Briefcase}
                  index={3}
                  onDrill={handleDrillDown}
                  comparison="excluding Won/Lost/PO"
                  info="Active deals currently in the pipeline (excludes Won, Lost, and PO Received stages)."
                />
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* System Activity Heatmap */}
            <ChartCard title="Team Activity Timeline" subtitle="Recent engagement and deal activity">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.revenueTrend.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="deals" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Deals Closed" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Summary Statistics */}
            <ChartCard title="Dashboard Summary" subtitle="Key metrics overview">
              <div className="space-y-4">
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-normal uppercase">Total Deals</p>
                  <p className="text-2xl font-normal text-blue-900 mt-1">{filteredDeals.length}</p>
                  <p className="text-xs text-blue-600 mt-1">{analytics.dealsWon} won | {analytics.dealsLost} lost</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                  <p className="text-xs text-emerald-600 font-normal uppercase">Total Revenue</p>
                  <p className="text-2xl font-normal text-emerald-900 mt-1">{formatCurrency(analytics.totalRevenue)}</p>
                  <p className="text-xs text-emerald-600 mt-1">from {analytics.dealsWon} closed deals</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-600 font-normal uppercase">Pipeline Value</p>
                  <p className="text-2xl font-normal text-amber-900 mt-1">{formatCurrency(analytics.pipelineValue)}</p>
                  <p className="text-xs text-amber-600 mt-1">{filteredDeals.filter(d => !['Won', 'Lost', 'PO Received'].includes(d.dealStage)).length} open deals</p>
                </div>
              </div>
            </ChartCard>
          </div>
        </div>

        {/* PHASE 2: USER-BASED ANALYTICS SECTION */}
        {!canViewAll && analytics.userStats && (
          <div className="mb-8">
            <SectionHeader title="Your Personal Analytics" subtitle="Your deal creation, performance, and productivity metrics" icon={UserCircle} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard title="Deals I Created" value={analytics.userStats.dealsCreated} trend={analytics.userStats.dealsCreated > 0 ? 'up' : 'down'} trendValue={`${analytics.userStats.lastMonthDeals} created last month`} icon={Briefcase} index={0} comparison="total deals" />
              <KPICard title="My Win Rate" value={`${analytics.userStats.winRate}%`} trend={analytics.userStats.winRate > 50 ? 'up' : 'down'} trendValue={analytics.userStats.winRate > 50 ? 'Above 50% avg' : 'Below 50% avg'} icon={Target} index={1} comparison="of closed deals" />
              <KPICard title="My Total Revenue" value={formatCurrency(analytics.userStats.totalRevenue)} trend={analytics.userStats.totalRevenue > 0 ? 'up' : 'down'} trendValue="from Won deals" icon={DollarSign} index={2} comparison="from won deals" />
              <KPICard title="Assigned to Me" value={analytics.userStats.dealsAssignedToMe} trend={analytics.userStats.openDeals > 0 ? 'up' : 'down'} trendValue={`${analytics.userStats.openDeals} open`} icon={Users} index={3} comparison="deals I own" />
            </div>
          </div>
        )}

        {canViewAll && analytics.teamStats && (
          <div className="mb-8 pt-5">
            <SectionHeader
              title="Team Performance Overview"
              subtitle="Aggregate team metrics and top performer insights "
              icon={Users}
              info="These metrics reflect the current month's data."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard
                title="Team Total Revenue"
                value={formatCurrency(analytics.teamStats.teamTotalRevenue)}
                trend={analytics.teamStats.teamTotalRevenue > 0 ? 'up' : 'down'}
                trendValue="from Won deals"
                icon={DollarSign}
                index={0}
                comparison="this month — all team members"
                info="Total revenue generated by the team from deals marked Won during the selected month."
              />
              <KPICard
                title="Team Win Rate"
                value={`${analytics.teamStats.teamWinRate}%`}
                trend={analytics.teamStats.teamWinRate > 50 ? 'up' : 'down'}
                trendValue={analytics.teamStats.teamWinRate > 50 ? 'Above avg' : 'Below avg'}
                icon={Target}
                index={1}
                comparison="this month"
                info="Percentage of team deals decided (Won/Lost) that were Won during the selected month."
              />
              <KPICard
                title="Top Performer"
                value={analytics.teamStats.topPerformer}
                trend="up"
                trendValue={formatCurrency(analytics.teamStats.topPerformerRevenue)}
                icon={Award}
                index={2}
                comparison="this month — by revenue"
                info="The team member with the highest revenue from deals created this month."
              />
              <KPICard
                title="Most Active User"
                value={analytics.teamStats.mostActiveUser}
                trend="up"
                trendValue={`${analytics.teamStats.mostActiveUserCount} deals`}
                icon={Activity}
                index={3}
                comparison="this month — by deal count"
                info="The team member with the most deal activity (created) during the selected month."
              />
            </div>
          </div>
        )}

        {/* Created vs Updated Comparison */}
        <div className="mb-8">
          <SectionHeader
            title="Deal Activity Metrics"
            subtitle="Comparison of created vs updated deals this month - Click cards to view deals"
            icon={Activity}
            info="Shows created vs updated deals for the current month" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KPICard
              title="Deals Created This Month"
              value={analytics.createdVsUpdated.dealsCreated}
              trend={analytics.createdVsUpdated.dealsCreated > 0 ? 'up' : 'down'}
              trendValue="created this month"
              icon={Plus}
              index={0}
              badge={{ color: 'bg-blue-100 text-blue-700', text: 'New' }}
              comparison="calendar month"
              onDrill={() => handleActivityMetricsClick('created')}
            />
            <KPICard
              title="Deals Updated This Month"
              value={analytics.createdVsUpdated.dealsUpdated}
              trend={analytics.createdVsUpdated.dealsUpdated > 0 ? 'up' : 'down'}
              trendValue="updated this month"
              icon={RefreshCw}
              index={1}
              comparison="any field changed"
              onDrill={() => handleActivityMetricsClick('updated')}
            />
            <KPICard
              title="Created Revenue"
              value={formatCurrency(analytics.createdVsUpdated.createdRevenue)}
              trend={analytics.createdVsUpdated.createdRevenue > 0 ? 'up' : 'down'}
              trendValue="from newly won deals"
              icon={DollarSign}
              index={2}
              comparison="created this month"
              onDrill={() => handleActivityMetricsClick('created')}
            />
            <KPICard
              title="Updated Revenue"
              value={formatCurrency(analytics.createdVsUpdated.updatedRevenue)}
              trend={analytics.createdVsUpdated.updatedRevenue > 0 ? 'up' : 'down'}
              trendValue="from updated won deals"
              icon={TrendingUp}
              index={3}
              comparison="modified this month"
              onDrill={() => handleActivityMetricsClick('updated')}
            />
          </div>
        </div>

        {/* Deal Creator Leaderboard - Admin/Manager Only */}
        {canViewAll && analytics.userLeaderboard.length > 0 && (
          <div className="mb-8">
            <SectionHeader title="Deal Creator Leaderboard" subtitle="Top performers by revenue, deals created, and win rate - Click to view all deals" icon={Award} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Leaders */}
              <ChartCard title="Top Creators by Revenue" subtitle="Ranked by total revenue from deals they created">
                <div className="space-y-2 max-h-80 overflow-y-auto deal-cards-scrollbar">
                  {analytics.userLeaderboard.slice(0, 5).map((creator, i) => (
                    <div
                      key={i}
                      onClick={() => handleCreatorClick(creator)}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-transparent rounded-lg border border-emerald-100 hover:border-emerald-200 transition-colors cursor-pointer hover:shadow-md"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-sm font-normal text-emerald-700">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{creator.user}</p>
                          <p className="text-xs text-gray-500">{creator.dealsCreated} deals • {creator.dealsWon} won</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-lg font-normal text-emerald-600">{formatCurrency(creator.totalRevenue)}</p>
                        <p className="text-xs text-gray-500">{creator.winRate}% win</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>

              {/* Deal Count Leaders */}
              <ChartCard title="Most Prolific Creators" subtitle="Ranked by number of deals created">
                <div className="space-y-2 max-h-80 overflow-y-auto deal-cards-scrollbar">
                  {[...analytics.userLeaderboard].sort((a, b) => b.dealsCreated - a.dealsCreated).slice(0, 5).map((creator, i) => (
                    <div
                      key={i}
                      onClick={() => handleCreatorClick(creator)}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-transparent rounded-lg border border-blue-100 hover:border-blue-200 transition-colors cursor-pointer hover:shadow-md"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-sm font-normal text-blue-700">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{creator.user}</p>
                          <p className="text-xs text-gray-500">{creator.totalRevenue > 0 ? formatCurrency(creator.totalRevenue) : 'No won deals'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-lg font-normal text-blue-600">{creator.dealsCreated}</p>
                        <p className="text-xs text-gray-500">deals</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          </div>
        )}

        {/* Deal Creation Trend - Admin/Manager Only */}
        {canViewAll && analytics.dealCreationTrend.length > 0 && (
          <div className="mb-8">
            <ChartCard title="Deal Creation Trend (Last 3 Months)" subtitle="Number of deals created by team members over time - Click bar to view deals">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.dealCreationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="total"
                    fill="#3b82f6"
                    name="Total Deals"
                    radius={[8, 8, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      if (data.payload && data.payload.month) {
                        // Filter deals created in the selected month
                        // dealCreationTrend uses format like "May 26" (month + 2-digit year)
                        const selectedMonth = data.payload.month;
                        const monthDeals = deals.filter(d => {
                          if (!d.createdAt) return false;
                          const createdDate = new Date(d.createdAt);
                          const dealMonth = createdDate.toLocaleString('default', { month: 'short', year: '2-digit' });
                          return dealMonth === selectedMonth;
                        });
                        handleDrillDown(`Deals Created in ${selectedMonth}`, monthDeals);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {/* Recent Updates Activity Feed */}
        {analytics.recentUpdates && analytics.recentUpdates.length > 0 && (
          <div className="mb-8">
            <SectionHeader title="Recent Deal Activity" subtitle="Deals updated in the last 24 hours" icon={Activity} />

            <ChartCard>
              <div className="space-y-2 max-h-96 overflow-y-auto deal-cards-scrollbar">
                {analytics.recentUpdates.map((deal, idx) => (
                  <a
                    key={idx}
                    href={`/dashboard/Deals?id=${deal.dealId || deal.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      openDealInDealsPage(deal);
                    }}
                    className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer hover:shadow-sm"
                  >
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{deal.dealName || 'Unnamed Deal'}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {deal.updatedBy ? `Updated by ${deal.updatedBy}` : 'Updated'} • {deal.dealStage}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {deal.updatedAt ? new Date(deal.updatedAt).toLocaleString() : 'Recently updated'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900">{formatByCurrency(deal.originalDealValue ?? deal.dealValue ?? 0, deal.originalCurrency ?? deal.Currency ?? 'INR')}</p>
                    </div>
                  </a>
                ))}
              </div>
            </ChartCard>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">Last updated: {lastUpdated.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Dashboard auto-refreshes every 5 minutes</p>
        </div>
      </div>

      {/* Drill-Down Modal */}
      <DrillDownModal isOpen={drillDownOpen} title={drillDownTitle} deals={filteredDeals} accounts={drillDownType === 'Total Accounts' ? drillAccounts : accounts} contacts={drillDownType === 'Total Contacts' ? drillContacts : contacts} onClose={() => setDrillDownOpen(false)} dataType={drillDownType} currentUser={userName} customData={drillDownData} openDealInDealsPage={openDealInDealsPage} />

      {/* Home-page Deal Slide-in — no navigation, Home stays in background */}
      {homeSlideInDealId && (
        <HomeDealSlideIn
          dealId={homeSlideInDealId}
          onClose={() => setHomeSlideInDealId(null)}
          userName={userName}
          userRole={userRole}
          onToast={showToast}
          onSaved={() => {
            // Invalidate cache so Home re-fetches fresh data
            if (typeof cacheRef?.current === 'object') cacheRef.current.timestamp = null;
          }}
        />
      )}

      {/* Toast notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 ${toastMsg.type === 'success' ? 'bg-emerald-600' :
            toastMsg.type === 'error' ? 'bg-red-600' :
              'bg-blue-600'
            }`}
        >
          {toastMsg.type === 'success' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          {toastMsg.type === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
          {toastMsg.text}
        </div>
      )}

    </div>
  );
} 