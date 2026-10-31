import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, Layers, Globe, Play, Pause, History, Calendar } from 'lucide-react';
import type { JobSyncStatusInfo, JobDiscoveryStats } from '../types';
import { formatTimeAgo, formatDateTime } from './JobDetailsModal';

interface SyncStatusCardProps {
  status: JobSyncStatusInfo | null;
  stats?: JobDiscoveryStats | null;
  syncing: boolean;
  onSyncManual: () => void;
  onToggleScheduler?: (enabled: boolean, intervalHours?: number) => void;
  onViewHistory?: () => void;
}

export const SyncStatusCard: React.FC<SyncStatusCardProps> = ({
  status,
  stats,
  syncing,
  onSyncManual,
  onToggleScheduler,
  onViewHistory,
}) => {
  const isRunning = syncing || status?.isSyncing;
  const isAutoEnabled = stats ? stats.autoSyncEnabled : (status ? status.autoSyncEnabled : true);
  const currentInterval = stats ? stats.intervalHours : (status ? status.intervalHours : 6);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              background: isRunning ? '#e0f2fe' : isAutoEnabled ? '#dcfce7' : '#fef3c7',
              color: isRunning ? '#0284c7' : isAutoEnabled ? '#15803d' : '#b45309',
              borderRadius: 10,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={18} className={isRunning ? 'spin' : ''} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Job Discovery Feeds & Scheduler
              </h4>
              <span
                style={{
                  background: isRunning ? '#e0f2fe' : isAutoEnabled ? '#dcfce7' : '#fef3c7',
                  color: isRunning ? '#0369a1' : isAutoEnabled ? '#15803d' : '#b45309',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isRunning ? (
                  <>
                    <RefreshCw size={11} className="spin" /> Syncing Feeds Now…
                  </>
                ) : isAutoEnabled ? (
                  <>
                    <CheckCircle2 size={11} /> Scheduler Active (Every {currentInterval}h)
                  </>
                ) : (
                  <>
                    <Pause size={11} /> Scheduler Paused
                  </>
                )}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Autonomous background crawler queries Arbeitnow, Jobicy, Remote OK & job boards every {currentInterval} hours.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onToggleScheduler && (
            <button
              type="button"
              onClick={() => onToggleScheduler(!isAutoEnabled)}
              style={{
                background: isAutoEnabled ? '#f8fafc' : '#eff6ff',
                color: isAutoEnabled ? '#475569' : '#1d4ed8',
                border: '1px solid #cbd5e1',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {isAutoEnabled ? <Pause size={13} /> : <Play size={13} />}
              {isAutoEnabled ? 'Pause Scheduler' : 'Resume Scheduler'}
            </button>
          )}

          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              style={{
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <History size={13} /> View Sync History
            </button>
          )}

          <button
            type="button"
            onClick={onSyncManual}
            disabled={isRunning}
            style={{
              background: isRunning ? '#94a3b8' : 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#fff',
              border: 'none',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
            }}
          >
            <RefreshCw size={14} className={isRunning ? 'spin' : ''} />
            {isRunning ? 'Synchronizing…' : 'Sync Live Jobs Now'}
          </button>
        </div>
      </div>

      {/* Metric Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          paddingTop: 12,
          borderTop: '1px solid #f1f5f9',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Clock size={13} /> Last Crawl
          </span>
          <strong style={{ color: '#0f172a' }}>
            {status?.lastSyncAt ? `${formatDateTime(status.lastSyncAt)} (${formatTimeAgo(status.lastSyncAt)})` : 'Just completed'}
          </strong>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Clock size={13} /> Next Scheduled Run
          </span>
          <strong style={{ color: '#0f172a' }}>
            {status?.nextSyncAt ? formatDateTime(status.nextSyncAt) : (isAutoEnabled ? 'In background schedule' : 'Scheduler paused')}
          </strong>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Layers size={13} /> Today's Discoveries
          </span>
          <strong style={{ color: '#0f172a' }}>
            <span style={{ color: '#16a34a' }}>+{stats ? stats.totalDiscoveredToday : status?.lastDiscoveredCount ?? 0} new jobs</span>
          </strong>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Calendar size={13} /> Yesterday / This Week
          </span>
          <strong style={{ color: '#0f172a' }}>
            {stats ? `${stats.totalDiscoveredYesterday} yest • ${stats.totalDiscoveredThisWeek} week` : 'Updated live'}
          </strong>
        </div>

        <div>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Globe size={13} /> Crawled Portals
          </span>
          <strong style={{ color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {status?.sourcesChecked && status.sourcesChecked.length > 0
              ? status.sourcesChecked.join(', ')
              : 'Arbeitnow, Jobicy, Remote OK, Portals'}
          </strong>
        </div>
      </div>

      {status?.sourcesFailed && status.sourcesFailed.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '6px 12px', borderRadius: 6, fontSize: '11px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} />
          Some external source endpoints were rate-limited or delayed: {status.sourcesFailed.join(', ')}. Cached listings remain active.
        </div>
      )}
    </div>
  );
};
