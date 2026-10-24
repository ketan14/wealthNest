import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Lock,
} from 'lucide-react';

import { AdminHeader } from '../../components/admin/AdminHeader';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { AdminAuditLogEntry } from '@wealthnest/domain';

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Metadata inspect modal
  const [activeLog, setActiveLog] = useState<AdminAuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAdapter.listLogs({
        page,
        limit,
        action: actionFilter || undefined,
      });
      setLogs(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Immutable Security &amp; Audit Trail"
        subtitle="Forensic telemetry of all administrative operations, status modifications, and RBAC events"
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Immutability Banner */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">
              Append-Only Immutability Guarantee
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Every audit record is tamper-proof and strictly append-only. Modification (<code className="text-purple-300">UPDATE</code>)
              and removal (<code className="text-purple-300">DELETE</code>) are prohibited by automated database triggers.
              Sensitive identifiers and tokens are sanitized prior to ingestion.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="">All Administrative Actions</option>
              <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
              <option value="PASSWORD_RESET_REQUESTED">PASSWORD_RESET_REQUESTED</option>
              <option value="ROLE_GRANTED">ROLE_GRANTED</option>
              <option value="ROLE_REVOKED">ROLE_REVOKED</option>
              <option value="USER_INVITED">USER_INVITED</option>
              <option value="SYSTEM_BOOTSTRAP">SYSTEM_BOOTSTRAP</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            {total} Total Audit Records
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3.5 pl-6">Timestamp</th>
                  <th className="py-3.5">Action</th>
                  <th className="py-3.5">Actor</th>
                  <th className="py-3.5">Target</th>
                  <th className="py-3.5">Outcome</th>
                  <th className="py-3.5">Reason Code</th>
                  <th className="py-3.5 pr-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Loading audit telemetry...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No audit events match the selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pl-6 text-slate-400 font-mono">
                        {new Date(l.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 font-bold text-white font-mono">{l.action}</td>
                      <td className="py-3.5 text-slate-200">{l.actorName}</td>
                      <td className="py-3.5 text-slate-200">{l.targetName}</td>

                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            l.outcome === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : l.outcome === 'denied'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {l.outcome}
                        </span>
                      </td>

                      <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                        {l.reasonCode || '—'}
                      </td>

                      <td className="py-3.5 pr-6 text-right">
                        <button
                          onClick={() => setActiveLog(l)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all inline-flex items-center gap-1 text-[11px]"
                          title="Inspect Metadata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Payload</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Previous
              </button>
              <span className="px-2 text-slate-500 font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payload Modal */}
      {activeLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-white text-base">
                  Audit Event Payload ({activeLog.action})
                </h3>
              </div>
              <button onClick={() => setActiveLog(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500">Event ID:</span>{' '}
                  <span className="font-mono text-slate-300 text-[10px]">{activeLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Outcome:</span>{' '}
                  <span className="font-semibold uppercase text-emerald-400">{activeLog.outcome}</span>
                </div>
                <div>
                  <span className="text-slate-500">Actor:</span>{' '}
                  <span className="text-slate-300">{activeLog.actorName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Target:</span>{' '}
                  <span className="text-slate-300">{activeLog.targetName}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Sanitized Metadata JSON
                </label>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                  {JSON.stringify(activeLog.safeMetadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setActiveLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
