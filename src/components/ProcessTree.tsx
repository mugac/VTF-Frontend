import { useEffect, useState, useCallback, useMemo } from 'react';
import { getProcessTree } from '../api/vtfApi';
import type { ProcessTreeNode } from '../api/vtfApi';
import { useInvestigation } from '../context/InvestigationContext';

interface ProcessTreeProps {
  analysisId: string;
  onSelectProcess?: (pid: number, processName: string) => void;
}

interface FlatTreeRow {
  node: ProcessTreeNode;
  depth: number;
  pid: number;
  ppid: number;
  name: string;
  hasChildren: boolean;
  isExpanded: boolean;
}

export default function ProcessTree({ analysisId, onSelectProcess }: ProcessTreeProps) {
  const [treeData, setTreeData] = useState<ProcessTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isTracked, addTrackedPid, removeTrackedPid } = useInvestigation();

  useEffect(() => {
    loadTree();
  }, [analysisId]);

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProcessTree(analysisId);
      setTreeData(response.tree);
      // Auto-expand first two levels
      const initialExpanded = new Set<number>();
      const expandLevel = (nodes: ProcessTreeNode[], depth: number) => {
        for (const node of nodes) {
          const pid = node.PID ?? node.Pid ?? 0;
          if (depth < 2) {
            initialExpanded.add(pid);
          }
          if (node.__children) {
            expandLevel(node.__children, depth + 1);
          }
        }
      };
      expandLevel(response.tree, 0);
      setExpandedPids(initialExpanded);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Nepodařilo se načíst strom procesů.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = useCallback((pid: number) => {
    setExpandedPids(prev => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<number>();
    const collect = (nodes: ProcessTreeNode[]) => {
      for (const node of nodes) {
        const pid = node.PID ?? node.Pid ?? 0;
        all.add(pid);
        if (node.__children) collect(node.__children);
      }
    };
    collect(treeData);
    setExpandedPids(all);
  }, [treeData]);

  const collapseAll = useCallback(() => {
    setExpandedPids(new Set());
  }, []);

  // Flatten tree into visible rows
  const flatRows = useMemo<FlatTreeRow[]>(() => {
    const rows: FlatTreeRow[] = [];
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = (node: ProcessTreeNode): boolean => {
      if (!searchTerm) return true;
      const name = (node.ImageFileName || node.COMM || node.Name || '').toLowerCase();
      const pid = String(node.PID ?? node.Pid ?? '');
      return name.includes(searchLower) || pid.includes(searchLower);
    };

    const hasMatchingDescendant = (node: ProcessTreeNode): boolean => {
      if (matchesSearch(node)) return true;
      for (const child of node.__children || []) {
        if (hasMatchingDescendant(child)) return true;
      }
      return false;
    };

    const flatten = (nodes: ProcessTreeNode[], depth: number) => {
      for (const node of nodes) {
        const pid = node.PID ?? node.Pid ?? 0;
        const ppid = node.PPID ?? node.PPid ?? 0;
        const name = node.ImageFileName || node.COMM || node.Name || '?';
        const children = node.__children || [];
        const hasChildren = children.length > 0;

        if (searchTerm && !hasMatchingDescendant(node)) continue;

        rows.push({
          node,
          depth,
          pid,
          ppid,
          name,
          hasChildren,
          isExpanded: expandedPids.has(pid),
        });

        if (hasChildren && (expandedPids.has(pid) || searchTerm)) {
          flatten(children, depth + 1);
        }
      }
    };

    flatten(treeData, 0);
    return rows;
  }, [treeData, expandedPids, searchTerm]);

  const handleSelect = useCallback((pid: number, name: string) => {
    setSelectedPid(pid);
    onSelectProcess?.(pid, name);
  }, [onSelectProcess]);

  const handleTrackToggle = useCallback(async (pid: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTracked(pid)) {
      await removeTrackedPid(pid);
    } else {
      await addTrackedPid({ pid, process_name: name, tags: ['interesting'], source_plugin: 'pstree' });
    }
  }, [isTracked, addTrackedPid, removeTrackedPid]);

  if (loading) {
    return (
      <div className="vtf-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="vtf-spinner" />
        <p style={{ color: 'var(--color-slate-500)', marginTop: '1rem' }}>Načítám strom procesů...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vtf-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        <p style={{ color: 'var(--color-slate-500)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Spusťte plugin PsTree, PsList nebo PsScan.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem',
        borderBottom: '1px solid var(--color-slate-200)', background: 'var(--color-slate-50)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
      }}>
        <span style={{ fontSize: '1.125rem' }}>🌳</span>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, marginRight: 'auto' }}>
          Strom procesů
        </h3>
        <input
          type="text"
          placeholder="Hledat PID nebo jméno..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-slate-300)', fontSize: '0.8125rem', width: '200px'
          }}
        />
        <button onClick={expandAll} className="vtf-btn vtf-btn-secondary" style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}>
          Rozbalit vše
        </button>
        <button onClick={collapseAll} className="vtf-btn vtf-btn-secondary" style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}>
          Sbalit vše
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
          {flatRows.length} procesů
        </span>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
        {flatRows.map((row) => {
          const tracked = isTracked(row.pid);
          const hasTrackedInfo = row.node._tracked;
          const isSelected = selectedPid === row.pid;

          return (
            <div
              key={`${row.pid}-${row.depth}`}
              onClick={() => handleSelect(row.pid, row.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.375rem 0.75rem',
                paddingLeft: `${row.depth * 1.5 + 0.75}rem`,
                cursor: 'pointer',
                background: isSelected
                  ? 'var(--color-primary-50, #eff6ff)'
                  : tracked
                    ? 'rgba(250, 204, 21, 0.08)'
                    : 'transparent',
                borderBottom: '1px solid var(--color-slate-100)',
                borderLeft: tracked
                  ? '3px solid #f59e0b'
                  : hasTrackedInfo?.tags?.includes('suspicious') || hasTrackedInfo?.tags?.includes('malware')
                    ? '3px solid var(--color-danger)'
                    : '3px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-slate-50)';
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.background = tracked ? 'rgba(250, 204, 21, 0.08)' : 'transparent';
                }
              }}
            >
              {/* Expand/collapse toggle */}
              <span
                onClick={(e) => { e.stopPropagation(); toggleExpand(row.pid); }}
                style={{
                  width: '1.25rem', textAlign: 'center', flexShrink: 0,
                  cursor: row.hasChildren ? 'pointer' : 'default',
                  color: 'var(--color-slate-400)',
                  userSelect: 'none',
                }}
              >
                {row.hasChildren ? (row.isExpanded ? '▼' : '▶') : '•'}
              </span>

              {/* Process icon + name */}
              <span style={{ marginLeft: '0.375rem', flexShrink: 0, fontSize: '0.875rem' }}>
                {row.pid === 4 || row.pid === 0 ? '🖥️' : row.name.toLowerCase().includes('svchost') ? '⚙️' : '📄'}
              </span>
              
              <span style={{
                marginLeft: '0.5rem', fontWeight: isSelected ? 600 : 400,
                color: tracked ? '#b45309' : 'var(--color-slate-800)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {row.name}
              </span>

              {/* PID badge */}
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.6875rem', fontWeight: 500,
                color: 'var(--color-slate-500)', background: 'var(--color-slate-100)',
                padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-sm)',
                flexShrink: 0,
              }}>
                PID {row.pid}
              </span>

              {/* Tags */}
              {tracked && hasTrackedInfo?.tags?.map((tag: string) => (
                <span key={tag} style={{
                  marginLeft: '0.25rem', fontSize: '0.625rem', fontWeight: 600,
                  padding: '0.125rem 0.375rem', borderRadius: '9999px',
                  background: tag === 'suspicious' || tag === 'malware' ? '#fef2f2' :
                              tag === 'cleared' || tag === 'benign' ? '#f0fdf4' : '#fefce8',
                  color: tag === 'suspicious' || tag === 'malware' ? '#dc2626' :
                         tag === 'cleared' || tag === 'benign' ? '#16a34a' : '#ca8a04',
                  textTransform: 'uppercase',
                }}>
                  {tag}
                </span>
              ))}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* CreateTime */}
              {row.node.CreateTime && (
                <span style={{
                  fontSize: '0.6875rem', color: 'var(--color-slate-400)',
                  marginRight: '0.75rem', flexShrink: 0,
                }}>
                  {new Date(row.node.CreateTime).toLocaleString('cs-CZ', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </span>
              )}

              {/* Track button */}
              <button
                onClick={(e) => handleTrackToggle(row.pid, row.name, e)}
                title={tracked ? 'Odebrat ze sledovaných' : 'Sledovat proces'}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '1rem', padding: '0.125rem', lineHeight: 1,
                  opacity: tracked ? 1 : 0.3, flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={e => { if (!tracked) (e.target as HTMLElement).style.opacity = '0.3'; }}
              >
                {tracked ? '⭐' : '☆'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
