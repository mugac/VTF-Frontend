import { useState, useCallback, useEffect } from 'react';
import ProcessTree from './ProcessTree';
import ProcessTimeline from './ProcessTimeline';
import { useInvestigation } from '../context/InvestigationContext';
import {
  correlateByPid,
  runAnalysisForPid,
  checkPluginStatusForPid,
  getPluginResultsForPid,
} from '../api/vtfApi';
import type { CorrelationResponse, ResultRow } from '../api/vtfApi';

interface ProcessInvestigationProps {
  analysisId: string;
  onNavigateToResults?: (plugin: string, data: ResultRow[]) => void;
  onNavigateToRegistry?: () => void;
}

type InvestigationTab = 'tree' | 'timeline' | 'watchlist' | 'detail';

interface PerPidResult {
  plugin: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  data?: ResultRow[];
  error?: string;
}

const PID_PLUGINS = [
  { key: 'windows.dlllist.DllList', label: 'DLL List', icon: '📚' },
  { key: 'windows.handles.Handles', label: 'Handles', icon: '🔗' },
  { key: 'windows.malfind.Malfind', label: 'Malfind', icon: '🔍' },
  { key: 'windows.envars.Envars', label: 'Env Vars', icon: '🌍' },
  { key: 'windows.cmdline.CmdLine', label: 'CmdLine', icon: '💻' },
  { key: 'windows.privileges.Privs', label: 'Privileges', icon: '🔑' },
  { key: 'windows.vadinfo.VadInfo', label: 'VAD Info', icon: '🧠' },
  { key: 'windows.memmap.Memmap', label: 'MemMap', icon: '🗺️' },
  { key: 'windows.ldrmodules.LdrModules', label: 'LdrModules', icon: '📦' },
  { key: 'windows.getsids.GetSIDs', label: 'SIDs', icon: '🏷️' },
];

export default function ProcessInvestigation({
  analysisId,
  onNavigateToResults,
  onNavigateToRegistry,
}: ProcessInvestigationProps) {
  const [activeTab, setActiveTab] = useState<InvestigationTab>('tree');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [selectedProcessName, setSelectedProcessName] = useState<string>('');
  const [correlation, setCorrelation] = useState<CorrelationResponse | null>(null);
  const [isLoadingCorrelation, setIsLoadingCorrelation] = useState(false);
  const [pidResults, setPidResults] = useState<Record<string, PerPidResult>>({});
  const [activeDetailTab, setActiveDetailTab] = useState<string>('correlation');
  const { trackedPids, addTrackedPid, removeTrackedPid, isTracked } = useInvestigation();

  const handleSelectProcess = useCallback(async (pid: number, name: string) => {
    setSelectedPid(pid);
    setSelectedProcessName(name);
    setActiveTab('detail');
    setActiveDetailTab('correlation');
    setPidResults({});

    // Load correlation
    setIsLoadingCorrelation(true);
    try {
      const result = await correlateByPid(analysisId, pid);
      setCorrelation(result);
    } catch {
      setCorrelation(null);
    } finally {
      setIsLoadingCorrelation(false);
    }
  }, [analysisId]);

  const handleRunForPid = useCallback(async (pluginKey: string) => {
    if (selectedPid === null) return;

    setPidResults(prev => ({
      ...prev,
      [pluginKey]: { plugin: pluginKey, status: 'running' },
    }));

    try {
      await runAnalysisForPid(analysisId, pluginKey, selectedPid);

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const status = await checkPluginStatusForPid(analysisId, pluginKey, selectedPid);
          if (status.status === 'completed') {
            clearInterval(poll);
            const data = await getPluginResultsForPid(analysisId, pluginKey, selectedPid);
            setPidResults(prev => ({
              ...prev,
              [pluginKey]: { plugin: pluginKey, status: 'completed', data },
            }));
          } else if (status.status === 'failed') {
            clearInterval(poll);
            setPidResults(prev => ({
              ...prev,
              [pluginKey]: { plugin: pluginKey, status: 'failed', error: status.error },
            }));
          }
        } catch {
          clearInterval(poll);
          setPidResults(prev => ({
            ...prev,
            [pluginKey]: { plugin: pluginKey, status: 'failed', error: 'Status check failed' },
          }));
        }
      }, 2000);
    } catch (err: any) {
      setPidResults(prev => ({
        ...prev,
        [pluginKey]: { plugin: pluginKey, status: 'failed', error: err?.message || 'Failed to start' },
      }));
    }
  }, [analysisId, selectedPid]);

  const handleTrackToggle = useCallback(async () => {
    if (selectedPid === null) return;
    if (isTracked(selectedPid)) {
      await removeTrackedPid(selectedPid);
    } else {
      await addTrackedPid({
        pid: selectedPid,
        process_name: selectedProcessName,
        tags: ['interesting'],
        source_plugin: 'investigation',
      });
    }
  }, [selectedPid, selectedProcessName, isTracked, addTrackedPid, removeTrackedPid]);

  // Try loading already-existing per-PID results when switching to a process
  useEffect(() => {
    if (selectedPid === null) return;
    const loadExisting = async () => {
      for (const p of PID_PLUGINS) {
        try {
          const data = await getPluginResultsForPid(analysisId, p.key, selectedPid);
          if (data && Array.isArray(data) && data.length > 0) {
            setPidResults(prev => ({
              ...prev,
              [p.key]: { plugin: p.key, status: 'completed', data },
            }));
          }
        } catch {
          // Not available yet — that's fine
        }
      }
    };
    loadExisting();
  }, [selectedPid, analysisId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '0', borderBottom: '2px solid var(--color-slate-200)',
        background: 'white', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }}>
        {([
          { id: 'tree' as const, label: '🌳 Strom procesů', },
          { id: 'timeline' as const, label: '📅 Časová osa' },
          { id: 'watchlist' as const, label: `⭐ Sledované (${trackedPids.length})` },
          ...(selectedPid !== null ? [{
            id: 'detail' as const,
            label: `🔍 ${selectedProcessName || 'Proces'} (${selectedPid})`,
          }] : []),
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 500,
              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: activeTab === tab.id ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-slate-600)',
              cursor: 'pointer', marginBottom: '-2px', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}

        {/* Right-side actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '0.75rem' }}>
          {onNavigateToRegistry && (
            <button onClick={onNavigateToRegistry} className="vtf-btn vtf-btn-secondary"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
              🗝️ Registry
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'tree' && (
          <ProcessTree analysisId={analysisId} onSelectProcess={handleSelectProcess} />
        )}

        {activeTab === 'timeline' && (
          <ProcessTimeline analysisId={analysisId} onSelectProcess={handleSelectProcess} />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            trackedPids={trackedPids}
            onSelectProcess={handleSelectProcess}
            onRemove={removeTrackedPid}
          />
        )}

        {activeTab === 'detail' && selectedPid !== null && (
          <ProcessDetailView
            pid={selectedPid}
            processName={selectedProcessName}
            correlation={correlation}
            isLoadingCorrelation={isLoadingCorrelation}
            pidResults={pidResults}
            activeDetailTab={activeDetailTab}
            isTracked={isTracked(selectedPid)}
            onDetailTabChange={setActiveDetailTab}
            onRunPlugin={handleRunForPid}
            onTrackToggle={handleTrackToggle}
            onNavigateToResults={onNavigateToResults}
          />
        )}
      </div>
    </div>
  );
}


// ─── Watchlist Sub-view ────────────────────────────────────────────────

function WatchlistView({
  trackedPids,
  onSelectProcess,
  onRemove,
}: {
  trackedPids: import('../api/vtfApi').TrackedProcess[];
  onSelectProcess: (pid: number, name: string) => void;
  onRemove: (pid: number) => Promise<void>;
}) {
  if (trackedPids.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
          Žádné sledované procesy
        </h3>
        <p style={{ color: 'var(--color-slate-500)', marginTop: '0.5rem' }}>
          Klikněte na ☆ u procesu ve stromu pro přidání do sledovaných.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
        {trackedPids.map(tp => (
          <div
            key={tp.pid}
            className="vtf-card"
            onClick={() => onSelectProcess(tp.pid, tp.process_name)}
            style={{
              padding: '1rem', cursor: 'pointer',
              borderLeft: '4px solid #f59e0b',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {tp.process_name || '?'} <span style={{ color: 'var(--color-slate-500)', fontWeight: 400 }}>PID {tp.pid}</span>
                </div>
                {tp.reason && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: '0.25rem' }}>
                    {tp.reason}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(tp.pid); }}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--color-slate-400)', fontSize: '1rem',
                }}
                title="Odebrat ze sledovaných"
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {tp.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem',
                  borderRadius: '9999px', textTransform: 'uppercase',
                  background: tag === 'suspicious' || tag === 'malware' ? '#fef2f2' :
                              tag === 'cleared' || tag === 'benign' ? '#f0fdf4' : '#fefce8',
                  color: tag === 'suspicious' || tag === 'malware' ? '#dc2626' :
                         tag === 'cleared' || tag === 'benign' ? '#16a34a' : '#ca8a04',
                }}>
                  {tag}
                </span>
              ))}
            </div>
            {tp.notes && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '0.375rem', fontStyle: 'italic' }}>
                📝 {tp.notes}
              </p>
            )}
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-slate-400)', marginTop: '0.375rem' }}>
              Zdroj: {tp.source_plugin || '—'} • Přidáno: {tp.added_at ? new Date(tp.added_at).toLocaleString('cs-CZ') : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Process Detail Sub-view ───────────────────────────────────────────

function ProcessDetailView({
  pid,
  processName,
  correlation,
  isLoadingCorrelation,
  pidResults,
  activeDetailTab,
  isTracked,
  onDetailTabChange,
  onRunPlugin,
  onTrackToggle,
  onNavigateToResults,
}: {
  pid: number;
  processName: string;
  correlation: CorrelationResponse | null;
  isLoadingCorrelation: boolean;
  pidResults: Record<string, PerPidResult>;
  activeDetailTab: string;
  isTracked: boolean;
  onDetailTabChange: (tab: string) => void;
  onRunPlugin: (plugin: string) => void;
  onTrackToggle: () => void;
  onNavigateToResults?: (plugin: string, data: ResultRow[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Process header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
        background: 'var(--color-slate-50)', borderBottom: '1px solid var(--color-slate-200)',
      }}>
        <div style={{ fontSize: '1.5rem' }}>📄</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            {processName} <span style={{ color: 'var(--color-slate-500)', fontWeight: 400 }}>PID {pid}</span>
          </h3>
        </div>
        <button
          onClick={onTrackToggle}
          className={`vtf-btn ${isTracked ? 'vtf-btn-secondary' : 'vtf-btn-primary'}`}
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
        >
          {isTracked ? '⭐ Sledován' : '☆ Sledovat'}
        </button>
      </div>

      {/* Detail sub-tabs */}
      <div style={{
        display: 'flex', gap: '0', overflowX: 'auto',
        borderBottom: '1px solid var(--color-slate-200)', background: 'white',
        flexShrink: 0,
      }}>
        <DetailTabBtn id="correlation" label="📊 Korelace" active={activeDetailTab} onClick={onDetailTabChange} />
        {PID_PLUGINS.map(p => (
          <DetailTabBtn
            key={p.key}
            id={p.key}
            label={`${p.icon} ${p.label}`}
            active={activeDetailTab}
            onClick={onDetailTabChange}
            badge={pidResults[p.key]?.status === 'completed' ? pidResults[p.key]?.data?.length : undefined}
            isRunning={pidResults[p.key]?.status === 'running'}
          />
        ))}
      </div>

      {/* Detail content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {activeDetailTab === 'correlation' && (
          <CorrelationView
            correlation={correlation}
            isLoading={isLoadingCorrelation}
          />
        )}

        {PID_PLUGINS.map(p => (
          activeDetailTab === p.key && (
            <PerPidPluginView
              key={p.key}
              pluginKey={p.key}
              label={p.label}
              result={pidResults[p.key]}
              onRun={() => onRunPlugin(p.key)}
              pid={pid}
              onNavigateToResults={onNavigateToResults}
            />
          )
        ))}
      </div>
    </div>
  );
}

function DetailTabBtn({
  id, label, active, onClick, badge, isRunning,
}: {
  id: string; label: string; active: string;
  onClick: (id: string) => void;
  badge?: number; isRunning?: boolean;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        padding: '0.5rem 0.875rem', fontSize: '0.75rem', fontWeight: 500,
        border: 'none', borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
        background: isActive ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
        color: isActive ? 'var(--color-primary)' : 'var(--color-slate-500)',
        cursor: 'pointer', marginBottom: '-1px', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: '0.375rem',
      }}
    >
      {label}
      {isRunning && <span className="vtf-spinner" style={{ width: 12, height: 12 }} />}
      {badge !== undefined && (
        <span style={{
          background: 'var(--color-slate-200)', color: 'var(--color-slate-700)',
          fontSize: '0.625rem', fontWeight: 600, padding: '0.0625rem 0.375rem',
          borderRadius: '9999px',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}


// ─── Correlation View ──────────────────────────────────────────────────

function CorrelationView({
  correlation,
  isLoading,
}: {
  correlation: CorrelationResponse | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="vtf-spinner" />
        <p style={{ color: 'var(--color-slate-500)', marginTop: '0.75rem' }}>Načítám korelaci...</p>
      </div>
    );
  }

  if (!correlation || Object.keys(correlation.data).length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-slate-500)' }}>
        Žádná korelační data. Spusťte více pluginů pro lepší přehled.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Object.entries(correlation.data).map(([label, info]) => (
        <div key={label} className="vtf-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>{label}</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
              {info.count} {info.count === 1 ? 'záznam' : info.count < 5 ? 'záznamy' : 'záznamů'} • {info.plugin}
            </span>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {info.rows.slice(0, 10).map((row, idx) => (
              <pre key={idx} style={{
                fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                background: 'var(--color-slate-50)', padding: '0.5rem',
                borderRadius: 'var(--radius-md)', margin: 0, overflowX: 'auto',
                border: '1px solid var(--color-slate-100)',
              }}>
                {JSON.stringify(row, null, 1).substring(0, 300)}
              </pre>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── Per-PID Plugin View ───────────────────────────────────────────────

function PerPidPluginView({
  pluginKey,
  label,
  result,
  onRun,
  pid,
  onNavigateToResults,
}: {
  pluginKey: string;
  label: string;
  result?: PerPidResult;
  onRun: () => void;
  pid: number;
  onNavigateToResults?: (plugin: string, data: ResultRow[]) => void;
}) {
  if (!result || result.status === 'idle') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚀</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
          {label} pro PID {pid}
        </h3>
        <p style={{ color: 'var(--color-slate-500)', margin: '0.5rem 0 1.5rem' }}>
          Výsledky ještě nejsou k dispozici.
        </p>
        <button onClick={onRun} className="vtf-btn vtf-btn-primary" style={{ padding: '0.625rem 1.5rem' }}>
          ▶ Spustit {label}
        </button>
      </div>
    );
  }

  if (result.status === 'running') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="vtf-spinner" />
        <p style={{ color: 'var(--color-slate-600)', marginTop: '1rem' }}>
          Spouštím {label} pro PID {pid}...
        </p>
      </div>
    );
  }

  if (result.status === 'failed') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
        <p style={{ color: 'var(--color-danger)' }}>{result.error || 'Plugin selhal.'}</p>
        <button onClick={onRun} className="vtf-btn vtf-btn-secondary" style={{ marginTop: '1rem' }}>
          🔄 Zkusit znovu
        </button>
      </div>
    );
  }

  // Completed — show results in a simple table
  const data = result.data || [];
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-slate-500)' }}>
        Plugin nevrátil žádná data pro PID {pid}.
      </div>
    );
  }

  const columns = Object.keys(data[0]).filter(k => k !== '__children' && !k.startsWith('_'));
  const displayData = data.slice(0, 200); // Show first 200 rows inline

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
          {data.length} {data.length === 1 ? 'záznam' : data.length < 5 ? 'záznamy' : 'záznamů'}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onNavigateToResults && (
            <button
              onClick={() => onNavigateToResults(pluginKey, data)}
              className="vtf-btn vtf-btn-secondary"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              📊 Zobrazit v tabulce
            </button>
          )}
          <button onClick={onRun} className="vtf-btn vtf-btn-secondary"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
            🔄 Obnovit
          </button>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-md)' }}>
        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'var(--color-slate-50)' }}>
              {columns.map(col => (
                <th key={col} style={{
                  padding: '0.5rem 0.625rem', textAlign: 'left',
                  borderBottom: '2px solid var(--color-slate-200)', fontWeight: 600,
                  whiteSpace: 'nowrap', color: 'var(--color-slate-700)',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                {columns.map(col => (
                  <td key={col} style={{
                    padding: '0.375rem 0.625rem', maxWidth: '300px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--color-slate-700)',
                  }}>
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 200 && (
        <p style={{ textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
          Zobrazeno 200 z {data.length} záznamů. Klikněte "Zobrazit v tabulce" pro celý dataset.
        </p>
      )}
    </div>
  );
}
