/**
 * HomeDealSlideIn
 * ─────────────────────────────────────────────────────────────────────────────
 * A self-contained deal detail / edit slide-in panel that can be used on any
 * page (Home, Reports, …) without navigating away.
 *
 * Props
 * ──────
 * dealId    {string|number}  ID of the deal to load (null = closed)
 * onClose   {function}       Called when the panel should close
 * userName  {string}         Current logged-in user name
 * userRole  {string}         Current logged-in user role ('Admin'|'Manager'|'User')
 * onToast   {function}       (msg, type) to show toast notifications (optional)
 * onSaved   {function}       Called after a successful save so parent can refresh (optional)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import { cleanCurrencyValue } from '../utils/currency';

// ── helpers ──────────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  'New Lead', 'Need Analysis', 'Under Review', 'Demo',
  'Proposal/Price Quote', 'Hold', 'Negotiation/Review', 'Follow Up',
  'PO Received', 'Won', 'Lost',
];

const stageColors = {
  'New Lead':            'bg-blue-100 text-blue-700',
  'Need Analysis':       'bg-cyan-100 text-cyan-700',
  'Under Review':        'bg-indigo-100 text-indigo-700',
  'Demo':                'bg-purple-100 text-purple-700',
  'Proposal/Price Quote':'bg-amber-100 text-amber-700',
  'Hold':                'bg-stone-100 text-stone-700',
  'Negotiation/Review':  'bg-orange-100 text-orange-700',
  'Follow Up':           'bg-yellow-100 text-yellow-700',
  'PO Received':         'bg-sky-100 text-sky-700',
  'Won':                 'bg-emerald-100 text-emerald-700',
  'Lost':                'bg-rose-100 text-rose-700',
};

function fmt(v) {
  if (v == null || v === '') return '—';
  return String(v);
}

function formatByCurrency(value, currency = 'INR') {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || isNaN(n)) return '—';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const options = {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  };
  try {
    return new Intl.NumberFormat(locale, options).format(n);
  } catch (e) {
    return `${currency} ${Number(value).toFixed(Number.isInteger(n) ? 0 : 2)}`;
  }
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];   // yyyy-mm-dd for date inputs
}

function fmtDateDisplay(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getF(obj, ...keys) {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function HomeDealSlideIn({ dealId, onClose, userName, userRole, onToast, onSaved }) {
  const isAdmin   = ['Admin', 'admin', 'Manager', 'manager'].includes(userRole);
  const isManager = ['Manager', 'manager'].includes(userRole);

  const [deal, setDeal]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [notes, setNotes]     = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const panelRef = useRef(null);

  // Who can edit this deal?
  const canEdit = useCallback((d) => {
    if (!d) return false;
    if (isAdmin || isManager) return true;
    const creator = d.createdBy || d.CreatedBy || '';
    return creator === userName;
  }, [isAdmin, isManager, userName]);

  // ── fetch deal ──────────────────────────────────────────────────────────────
  const fetchDeal = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/Deal/${dealId}`);
      const data = res.data || {};
      const rawDealValue = data.dealValue ?? data.DealValue ?? data.originalDealValue ?? null;
      data.originalDealValue = rawDealValue;
      data.originalCurrency = cleanCurrencyValue(data.currency || data.Currency || data.originalCurrency || 'INR');
      data.dealValueInBaseCurrency = data.dealValueInBaseCurrency ?? data.DealValueInBaseCurrency ?? data.dealValueInINR ?? data.DealValueInINR ?? 0;
      data.dealValue = data.dealValueInBaseCurrency || rawDealValue || 0;
      setDeal(data);
    } catch (err) {
      setError(`Failed to load deal (${err?.response?.status ?? 'network error'})`);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchDeal(); }, [fetchDeal]);

  // ── fetch notes ─────────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get(`/Notes/deal/${dealId}`);
      const raw = res.data;
      setNotes(Array.isArray(raw) ? raw : []);
    } catch {
      setNotes([]);
    }
  }, [dealId]);

  useEffect(() => {
    if (showNotes) fetchNotes();
  }, [showNotes, fetchNotes]);

  // ── close on Escape ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── save deal ───────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!deal || !canEdit(deal)) return;
    const id = getF(deal, 'id', 'Id', 'dealId', 'DealId');
    if (!id) { onToast?.('Deal ID not found', 'error'); return; }

    setSaving(true);
    try {
      const payload = { ...deal };
      delete payload.createdAt; delete payload.CreatedAt;
      delete payload.updatedAt; delete payload.UpdatedAt;
      delete payload.createdBy; delete payload.CreatedBy;
      delete payload.id;        delete payload.Id;
      delete payload.dealId;    delete payload.DealId;
      payload.UpdatedBy = userName;

      try {
        if (payload.originalDealValue != null) payload.dealValue = payload.originalDealValue;
        if (payload.originalCurrency) payload.currency = payload.originalCurrency;
      } catch (e) {}
      // Preserve the existing base currency value and do not recalculate historical deal values.

      await apiClient.put(`/Deal/${id}`, payload);
      onToast?.('Deal updated successfully', 'success');
      onSaved?.();
      fetchDeal();
    } catch (err) {
      const msg = err?.response?.data?.title || err?.response?.data?.message || 'Update failed';
      onToast?.(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── add note ────────────────────────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const id = getF(deal, 'id', 'Id', 'dealId', 'DealId');
    if (!id) return;
    setSavingNote(true);
    try {
      await apiClient.post('/Notes', {
        DealId: id,
        Description: newNote.trim(),
        CreatedBy: userName,
      });
      setNewNote('');
      fetchNotes();
      onToast?.('Note added', 'success');
    } catch {
      onToast?.('Failed to add note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // ── field updater ────────────────────────────────────────────────────────────
  const set = (key, value) => setDeal(prev => ({ ...prev, [key]: value }));

  // ── render ───────────────────────────────────────────────────────────────────
  if (!dealId) return null;

  const editable = deal ? canEdit(deal) : false;

  return (
    <>
      {/* Backdrop — semi-transparent, home page still visible behind */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Deal Details"
      >
        {/* ─ Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-0.5">Deal Details</p>
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-md">
              {loading ? 'Loading…' : (getF(deal, 'dealName', 'name', 'Name') ?? '—')}
            </h2>
            {deal && (
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${stageColors[deal.dealStage] ?? 'bg-gray-100 text-gray-600'}`}>
                {deal.dealStage ?? '—'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowNotes(v => !v)}
              className="px-3 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center gap-1"
              title="View Notes"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8M8 16h6M6 6h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
              </svg>
              Notes {notes.length > 0 ? `(${notes.length})` : ''}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/80 text-gray-500 hover:text-gray-700 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─ Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          )}
          {error && (
            <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && deal && (
            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* Permission badge */}
              {!editable && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View-only — you can only edit deals you created.
                </div>
              )}

              {/* ── Stage picker ─────────────────────────────────────────────── */}
              <section className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deal Stage</p>
                <div className="flex flex-wrap gap-2">
                  {DEAL_STAGES.map(s => (
                    <button
                      key={s}
                      type="button"
                      disabled={!editable}
                      onClick={() => editable && set('dealStage', s)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        deal.dealStage === s
                          ? 'bg-blue-600 text-white shadow-md scale-105 ring-2 ring-blue-300'
                          : editable
                            ? 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                            : 'bg-white border border-gray-100 text-gray-400 cursor-default',
                      ].join(' ')}
                    >
                      {deal.dealStage === s && <span className="mr-1">✓</span>}
                      {s}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Core Info ────────────────────────────────────────────────── */}
              <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Deal Name" required>
                    <input
                      type="text"
                      disabled={!editable}
                      value={getF(deal, 'dealName', 'name', 'Name') ?? ''}
                      onChange={e => { set('name', e.target.value); set('dealName', e.target.value); }}
                      className={inputCls(editable)}
                      placeholder="Deal name"
                    />
                  </Field>
                  <Field label="Deal Value">
                    <input
                      type="text"
                      disabled
                      value={formatByCurrency(deal.originalDealValue ?? 0, deal.originalCurrency ?? deal.currency ?? deal.Currency ?? 'INR')}
                      className={inputCls(false)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Currency">
                    <input
                      type="text"
                      disabled
                      value={deal.originalCurrency ?? deal.currency ?? deal.Currency ?? 'INR'}
                      className={inputCls(false)}
                    />
                  </Field>
                  <Field label="Account">
                    <input
                      type="text"
                      disabled={!editable}
                      value={getF(deal, 'accountName', 'AccountName') ?? ''}
                      onChange={e => set('accountName', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Probability (%)">
                    <input
                      type="number"
                      min="0" max="100"
                      disabled={!editable}
                      value={deal.probability ?? ''}
                      onChange={e => set('probability', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Sales Owner">
                    <input
                      type="text"
                      disabled={!editable}
                      value={getF(deal, 'salesOwner', 'SalesOwner') ?? ''}
                      onChange={e => set('salesOwner', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Territory">
                    <input
                      type="text"
                      disabled={!editable}
                      value={getF(deal, 'territory', 'Territory') ?? ''}
                      onChange={e => set('territory', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Expected Close Date">
                    <input
                      type="date"
                      disabled={!editable}
                      value={fmtDate(deal.expectedCloseDate)}
                      onChange={e => set('expectedCloseDate', e.target.value || null)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Closed Date">
                    <input
                      type="date"
                      disabled={!editable}
                      value={fmtDate(deal.closedDate)}
                      onChange={e => set('closedDate', e.target.value || null)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Industry">
                    <input
                      type="text"
                      disabled={!editable}
                      value={getF(deal, 'industryType', 'IndustryType') ?? ''}
                      onChange={e => set('industryType', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Payment Status">
                    <select
                      disabled={!editable}
                      value={deal.paymentStatus ?? ''}
                      onChange={e => set('paymentStatus', e.target.value)}
                      className={inputCls(editable)}
                    >
                      <option value="">Select</option>
                      <option value="Pending">Pending</option>
                      <option value="Partial">Partial</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </Field>
                  <Field label="Lost Reason">
                    <input
                      type="text"
                      disabled={!editable}
                      value={deal.lostReason ?? ''}
                      onChange={e => set('lostReason', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Won Reasons">
                    <input
                      type="text"
                      disabled={!editable}
                      value={deal.wonReasons ?? ''}
                      onChange={e => set('wonReasons', e.target.value)}
                      className={inputCls(editable)}
                    />
                  </Field>
                  <Field label="Recent Note" fullWidth>
                    <textarea
                      rows={2}
                      disabled={!editable}
                      value={deal.recentNote ?? deal.dealRecentNote ?? ''}
                      onChange={e => set('recentNote', e.target.value)}
                      className={inputCls(editable) + ' resize-none'}
                      placeholder="Quick note…"
                    />
                  </Field>
                </div>
              </section>

              {/* ── Read-only Metadata ───────────────────────────────────────── */}
              <section className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metadata</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <MetaRow label="Created By"   value={fmt(getF(deal, 'createdBy', 'CreatedBy'))} />
                  <MetaRow label="Created At"   value={fmtDateDisplay(deal.createdAt)} />
                  <MetaRow label="Updated By"   value={fmt(getF(deal, 'updatedBy', 'UpdatedBy'))} />
                  <MetaRow label="Updated At"   value={fmtDateDisplay(deal.updatedAt)} />
                  <MetaRow label="Deal Source"  value={fmt(getF(deal, 'source', 'dealSource'))} />
                  <MetaRow label="Pipeline"     value={fmt(getF(deal, 'dealPipeline', 'DealPipeline'))} />
                  <MetaRow label="Tags"         value={fmt(getF(deal, 'tags', 'dealTags'))} />
                  <MetaRow label="Enquiry No."  value={fmt(deal.enquiryNumber)} />
                </div>
              </section>

              {/* ── Save / value summary bar ─────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{formatByCurrency(deal.originalDealValue ?? deal.dealValue ?? 0, deal.originalCurrency ?? deal.currency ?? deal.Currency ?? 'INR')}</span>
                  {deal.probability != null && (
                    <span className="ml-2 text-xs text-gray-400">· {deal.probability}% close prob.</span>
                  )}
                </div>
                {editable && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {saving ? (
                      <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block" /> Saving…</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Save Changes</>
                    )}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* ─ Notes panel (slides over from right inside the slide-in) ────────── */}
        {showNotes && (
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white border-l border-gray-200 shadow-xl z-10 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50 flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Deal Notes</h3>
                <p className="text-xs text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowNotes(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Add note */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Write a note…"
                  className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="w-full py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNote ? 'Adding…' : '+ Add Note'}
                </button>
              </div>

              {/* Note list */}
              {notes.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8 border border-dashed rounded-xl">No notes yet</p>
              ) : notes.map((note, i) => (
                <div key={note.id ?? note.Id ?? i} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.description ?? note.Description}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{note.createdBy ?? note.CreatedBy ?? ''}</span>
                    <span>{note.createdAt ? new Date(note.createdAt).toLocaleString('en-IN') : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── tiny sub-components ───────────────────────────────────────────────────────

function Field({ label, children, fullWidth = false, required }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <>
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium truncate">{value}</span>
    </>
  );
}

function inputCls(editable) {
  return [
    'w-full rounded-lg px-3 py-2 text-sm border-2 text-gray-800 outline-none transition-all',
    editable
      ? 'bg-white border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
      : 'bg-gray-50 border-gray-100 text-gray-500 cursor-default',
  ].join(' ');
}
