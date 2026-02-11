import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getProcessTimeline } from '../api/vtfApi';
import type { ProcessTimelineEntry } from '../api/vtfApi';
import { useInvestigation } from '../context/InvestigationContext';

interface ProcessTimelineProps {
  analysisId: string;
  onSelectProcess?: (pid: number, processName: string) => void;
}

export default function ProcessTimeline({ analysisId, onSelectProcess }: ProcessTimelineProps) {
  const [processes, setProcesses] = useState<ProcessTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPid, setHoveredPid] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'tracked' | 'malfind'>('all');
  const svgRef = useRef<SVGSVGElement>(null);
  const { isTracked: _isTracked } = useInvestigation();

  useEffect(() => {
    loadTimeline();
  }, [analysisId]);

  const loadTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProcessTimeline(analysisId);
      setProcesses(response.processes);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Nepodařilo se načíst timeline.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProcesses = useMemo(() => {
    switch (filter) {
      case 'tracked':
        return processes.filter(p => p.is_tracked);
      case 'malfind':
        return processes.filter(p => p.has_malfind);
      default:
        return processes;
    }
  }, [processes, filter]);

  // Parse time boundaries
  const { minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of processes) {
      if (p.create_time) {
        const t = new Date(p.create_time).getTime();
        if (!isNaN(t)) { min = Math.min(min, t); max = Math.max(max, t); }
      }
      if (p.exit_time) {
        const t = new Date(p.exit_time).getTime();
        if (!isNaN(t)) { max = Math.max(max, t); }
      }
    }
    if (min === Infinity) { min = 0; max = 1; }
    if (max <= min) { max = min + 1000; }
    // Add 5% padding
    const range = max - min;
    return { minTime: min - range * 0.02, maxTime: max + range * 0.02 };
  }, [processes]);

  // Layout
  const leftMargin = 180;
  const rightMargin = 20;
  const rowHeight = 28;
  const topMargin = 40;
  const svgWidth = 1200;
  const svgHeight = topMargin + filteredProcesses.length * rowHeight + 20;
  const timeWidth = svgWidth - leftMargin - rightMargin;

  const timeToX = useCallback((t: number) => {
    return leftMargin + ((t - minTime) / (maxTime - minTime)) * timeWidth;
  }, [minTime, maxTime, leftMargin, timeWidth]);

  // Time axis ticks
  const ticks = useMemo(() => {
    const tickCount = 8;
    const step = (maxTime - minTime) / tickCount;
    return Array.from({ length: tickCount + 1 }, (_, i) => {
      const t = minTime + i * step;
      return {
        x: timeToX(t),
        label: new Date(t).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    });
  }, [minTime, maxTime, timeToX]);

  const getBarColor = (p: ProcessTimelineEntry) => {
    if (p.has_malfind) return '#ef4444';
    if (p.is_tracked) return '#f59e0b';
    return '#60a5fa';
  };

  if (loading) {
    return (
      <div className="vtf-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="vtf-spinner" />
        <p style={{ color: 'var(--color-slate-500)', marginTop: '1rem' }}>Načítám timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vtf-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem',
        borderBottom: '1px solid var(--color-slate-200)', background: 'var(--color-slate-50)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }}>
        <span style={{ fontSize: '1.125rem' }}>📅</span>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>Časová osa procesů</h3>
        
        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '1rem' }}>
          {(['all', 'tracked', 'malfind'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 500,
                borderRadius: 'var(--radius-md)',
                border: filter === f ? '1px solid var(--color-primary)' : '1px solid var(--color-slate-300)',
                background: filter === f ? 'var(--color-primary)' : 'white',
                color: filter === f ? 'white' : 'var(--color-slate-700)',
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? `Vše (${processes.length})` : 
               f === 'tracked' ? `Sledované (${processes.filter(p => p.is_tracked).length})` :
               `Malfind (${processes.filter(p => p.has_malfind).length})`}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-slate-600)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#60a5fa', marginRight: 4 }} />Normální</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />Sledovaný</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ef4444', marginRight: 4 }} />Malfind</span>
        </div>
      </div>

      {/* Timeline SVG */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <svg ref={svgRef} width={svgWidth} height={svgHeight} style={{ fontFamily: 'var(--font-mono)', minWidth: svgWidth }}>
          {/* Background */}
          <rect width={svgWidth} height={svgHeight} fill="white" />

          {/* Time axis */}
          <line x1={leftMargin} y1={topMargin - 10} x2={svgWidth - rightMargin} y2={topMargin - 10}
            stroke="var(--color-slate-300)" strokeWidth={1} />
          {ticks.map((tick, i) => (
            <g key={i}>
              <line x1={tick.x} y1={topMargin - 14} x2={tick.x} y2={topMargin - 6}
                stroke="var(--color-slate-300)" strokeWidth={1} />
              <text x={tick.x} y={topMargin - 18} textAnchor="middle" fontSize="9" fill="var(--color-slate-500)">
                {tick.label}
              </text>
              {/* Gridline */}
              <line x1={tick.x} y1={topMargin} x2={tick.x} y2={svgHeight}
                stroke="var(--color-slate-100)" strokeWidth={1} strokeDasharray="2,3" />
            </g>
          ))}

          {/* Process bars */}
          {filteredProcesses.map((p, idx) => {
            const y = topMargin + idx * rowHeight;
            const createT = p.create_time ? new Date(p.create_time).getTime() : minTime;
            const exitT = p.exit_time ? new Date(p.exit_time).getTime() : maxTime;
            const x1 = timeToX(isNaN(createT) ? minTime : createT);
            const x2 = timeToX(isNaN(exitT) ? maxTime : exitT);
            const barWidth = Math.max(x2 - x1, 3);
            const barColor = getBarColor(p);
            const isHovered = hoveredPid === p.pid;

            return (
              <g
                key={`${p.pid}-${idx}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectProcess?.(p.pid, p.name)}
                onMouseEnter={() => setHoveredPid(p.pid)}
                onMouseLeave={() => setHoveredPid(null)}
              >
                {/* Hover highlight */}
                {isHovered && (
                  <rect x={0} y={y} width={svgWidth} height={rowHeight} fill="var(--color-slate-50)" />
                )}
                
                {/* Process name label */}
                <text
                  x={leftMargin - 8} y={y + rowHeight / 2 + 4}
                  textAnchor="end" fontSize="10.5"
                  fill={p.is_tracked ? '#b45309' : p.has_malfind ? '#dc2626' : 'var(--color-slate-700)'}
                  fontWeight={p.is_tracked || p.has_malfind || isHovered ? 600 : 400}
                >
                  {p.name.length > 18 ? p.name.substring(0, 18) + '…' : p.name} ({p.pid})
                </text>

                {/* Bar */}
                <rect
                  x={x1} y={y + 4} width={barWidth} height={rowHeight - 8}
                  rx={3} ry={3}
                  fill={barColor}
                  opacity={isHovered ? 1 : 0.75}
                  stroke={isHovered ? barColor : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                />

                {/* Tracking star */}
                {p.is_tracked && (
                  <text x={x1 - 14} y={y + rowHeight / 2 + 4} fontSize="10" fill="#f59e0b">⭐</text>
                )}

                {/* Tooltip on hover */}
                {isHovered && (
                  <foreignObject x={Math.min(x1 + barWidth + 8, svgWidth - 220)} y={y - 10} width={210} height={60}>
                    <div style={{
                      background: 'var(--color-slate-900)', color: 'white', padding: '0.375rem 0.5rem',
                      borderRadius: '6px', fontSize: '0.6875rem', lineHeight: 1.4, boxShadow: 'var(--shadow-lg)',
                    }}>
                      <strong>{p.name}</strong> (PID {p.pid}, PPID {p.ppid})<br />
                      {p.create_time && `Vytvořen: ${new Date(p.create_time).toLocaleString('cs-CZ')}`}
                      {p.exit_time && <><br />Ukončen: {new Date(p.exit_time).toLocaleString('cs-CZ')}</>}
                      {p.has_malfind && <><br /><span style={{ color: '#fca5a5' }}>⚠ Malfind detekce</span></>}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
