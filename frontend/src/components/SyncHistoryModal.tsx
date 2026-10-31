import React, { useState, useEffect } from 'react';
import { X, History, CheckCircle2, AlertTriangle, Layers, Clock, RefreshCw, Radio } from 'lucide-react';
import type { JobSyncLogRecord, JobDiscoveryStats } from '../types';
import { client } from '../api/client';
import { formatTimeAgo, formatDateTime } from './JobDetailsModal';

interface SyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: JobDiscoveryStats | null;
}

export const SyncHistoryModal: React.FC<SyncHistoryModalProps> = ({ isOpen, onClose, stats }) => {
  const [logs, setLogs] = useState<JobSyncLogRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await client.getJobSyncHistory(30);
      if (res.ok) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.error('Failed to load sync logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          maxWidth: 860,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#e0f2fe', color: '#0369a1', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Job Discovery Activity & Synchronization Log
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Detailed audit trail of automated background runs and on-demand crawler syncs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Discovery Summary Cards */}
        {stats && (
          <div style={{ background: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Discovered Today</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>{stats.totalDiscoveredToday}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Yesterday</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7' }}>{stats.totalDiscoveredYesterday}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>This Week</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>{stats.totalDiscoveredThisWeek}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Duplicates Skipped</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#64748b' }}>{stats.totalDuplicatesSkipped}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Active Database</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed' }}>{stats.totalMatchingJobs}</div>
            </div>
          </div>
        )}

        {/* Sync History Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              Loading activity history…
            </div>
          ) : logs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          background: log.status === 'success' ? '#dcfce7' : '#fee2e2',
                          color: log.status === 'success' ? '#16a34a' : '#dc2626',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {log.status === 'success' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {log.status}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                        {log.triggerType} Crawl
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {formatDateTime(log.completedAt)} ({formatTimeAgo(log.completedAt)})
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#334155', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span><strong>Total Fetched:</strong> {log.totalFetched}</span>
                      <span><strong style={{ color: '#16a34a' }}>New Added:</strong> +{log.newSaved}</span>
                      <span><strong>Duplicates Skipped:</strong> {log.duplicatesSkipped}</span>
                    </div>

                    {log.sourcesChecked && log.sourcesChecked.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                        Sources: {log.sourcesChecked.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic' }}>
              No synchronization activity recorded yet.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 6, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
