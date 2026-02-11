import { useEffect, useState } from 'react';
import { getDashboard } from '../api/vtfApi';
import type { DashboardData } from '../api/vtfApi';
import { useInvestigation } from '../context/InvestigationContext';

interface DashboardProps {
  analysisId: string;
  onNavigateToInvestigation?: () => void;
  onNavigateToRegistry?: () => void;
  onNavigateToPlugins?: () => void;
  onNavigateToPlugin?: (plugin: string) => void;
}

export default function Dashboard({ analysisId, onNavigateToInvestigation, onNavigateToRegistry: _onNavigateToRegistry, onNavigateToPlugins: _onNavigateToPlugins, onNavigateToPlugin }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { trackedPids } = useInvestigation();

  useEffect(() => {
    loadDashboard();
  }, [analysisId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const result = await getDashboard(analysisId);
      setData(result);
    } catch {
      // Dashboard might not have enough data yet
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="vtf-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="vtf-spinner" />
        <p style={{ color: 'var(--color-slate-500)', marginTop: '1rem' }}>Načítám dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="vtf-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-slate-500)' }}>Dashboard zatím nemá dostatek dat.</p>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
      {/* Top stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <StatCard icon="📄" label="Procesy" value={s.total_processes ?? '—'} sub={`${s.unique_process_names ?? 0} unikátních`} />
        <StatCard icon="🌐" label="Síťová spojení" value={s.total_connections ?? '—'} sub={`${s.unique_foreign_addresses ?? 0} ext. adres`} />
        <StatCard icon="🔍" label="Malfind detekce" value={s.malfind_detections ?? '—'} sub={`${s.suspicious_process_count ?? 0} podezřelých PID`}
          color={s.malfind_detections ? 'var(--color-danger)' : undefined} />
        <StatCard icon="⭐" label="Sledované PID" value={trackedPids.length} sub={`${trackedPids.filter(t => t.tags.includes('suspicious')).length} podezřelých`}
          color="#f59e0b" />
        <StatCard icon="📁" label="Soubory v paměti" value={s.total_files_in_memory ?? '—'} />
        <StatCard icon="🔌" label="Dokončené pluginy" value={data.completed_plugins.length}
          sub={data.failed_plugins.length > 0 ? `${data.failed_plugins.length} selhalo` : undefined} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {/* Top processes */}
        {s.top_processes && s.top_processes.length > 0 && (
          <div className="vtf-card" style={{ padding: '1rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              🏆 Nejčastější procesy
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {s.top_processes.map(([name, count]: [string, number]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0' }}>
                  <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', background: 'var(--color-slate-100)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                    {count}×
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracked PIDs quick view */}
        <div className="vtf-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>⭐ Sledované procesy</h4>
            {onNavigateToInvestigation && (
              <button onClick={onNavigateToInvestigation} className="vtf-btn vtf-btn-primary"
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                Otevřít investigaci →
              </button>
            )}
          </div>
          {trackedPids.length === 0 ? (
            <p style={{ color: 'var(--color-slate-500)', fontSize: '0.8125rem' }}>
              Zatím žádné sledované procesy. Přejděte do investigačního režimu.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {trackedPids.slice(0, 8).map(tp => (
                <div key={tp.pid} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0',
                  borderBottom: '1px solid var(--color-slate-100)',
                }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                    {tp.process_name}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>PID {tp.pid}</span>
                  {tp.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: '0.5625rem', fontWeight: 600, padding: '0.0625rem 0.375rem',
                      borderRadius: '9999px', textTransform: 'uppercase',
                      background: tag === 'suspicious' || tag === 'malware' ? '#fef2f2' : '#fefce8',
                      color: tag === 'suspicious' || tag === 'malware' ? '#dc2626' : '#ca8a04',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed plugins */}
        <div className="vtf-card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            🔌 Dokončené pluginy
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {data.completed_plugins.map(p => (
              <span
                key={p}
                onClick={() => onNavigateToPlugin?.(p)}
                style={{
                  fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                  background: 'var(--color-slate-100)', borderRadius: 'var(--radius-md)',
                  cursor: onNavigateToPlugin ? 'pointer' : 'default',
                  fontFamily: 'var(--font-mono)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--color-slate-200)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--color-slate-100)'; }}
              >
                {p}
              </span>
            ))}
            {data.failed_plugins.map(p => (
              <span key={p} style={{
                fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                background: '#fef2f2', color: '#dc2626', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
              }}>
                ✗ {p}
              </span>
            ))}
          </div>
        </div>

        {/* Foreign addresses */}
        {s.foreign_addresses && s.foreign_addresses.length > 0 && (
          <div className="vtf-card" style={{ padding: '1rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              🌐 Externí IP adresy
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: '150px', overflowY: 'auto' }}>
              {s.foreign_addresses.map((addr: string) => (
                <span key={addr} style={{
                  fontSize: '0.6875rem', padding: '0.125rem 0.5rem',
                  background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)',
                  borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)',
                }}>
                  {addr}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project info footer */}
      <div style={{
        display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-slate-500)',
        padding: '0.5rem 0', borderTop: '1px solid var(--color-slate-100)',
      }}>
        <span>📋 {data.project_name}</span>
        <span>💾 {data.dump_size_mb} MB</span>
        {data.os_type && <span>🖥️ {data.os_type}</span>}
        {data.kernel_version && <span>🐧 {data.kernel_version}</span>}
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="vtf-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ fontSize: '1.5rem' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.375rem', fontWeight: 700, color: color || 'var(--color-slate-800)', lineHeight: 1.2 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.6875rem', color: 'var(--color-slate-400)' }}>{sub}</div>}
      </div>
    </div>
  );
}
