import { useEffect, useState, useCallback } from 'react';
import { getRegistryHives, getRegistryKeys } from '../api/vtfApi';
import type { RegistryHive, RegistryKeysResponse } from '../api/vtfApi';

interface RegistryBrowserProps {
  analysisId: string;
}

interface BreadcrumbItem {
  label: string;
  keyPath: string | null;
  hiveOffset: number | null;
}

export default function RegistryBrowser({ analysisId }: RegistryBrowserProps) {
  const [hives, setHives] = useState<RegistryHive[]>([]);
  const [selectedHive, setSelectedHive] = useState<RegistryHive | null>(null);
  const [keysData, setKeysData] = useState<RegistryKeysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKey, setSelectedKey] = useState<any>(null);

  useEffect(() => {
    loadHives();
  }, [analysisId]);

  const loadHives = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRegistryHives(analysisId);
      setHives(result.hives);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Nepodařilo se načíst registry hivy. Spusťte HiveList plugin.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHive = useCallback(async (hive: RegistryHive) => {
    setSelectedHive(hive);
    setSelectedKey(null);
    setBreadcrumbs([{ label: hive.short_name, keyPath: null, hiveOffset: hive.offset }]);
    await loadKeys(hive.offset, undefined);
  }, [analysisId]);

  const loadKeys = async (hiveOffset?: number, keyPath?: string) => {
    setLoadingKeys(true);
    try {
      const result = await getRegistryKeys(analysisId, hiveOffset, keyPath);
      setKeysData(result);
    } catch {
      setKeysData(null);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleNavigateKey = useCallback(async (key: any) => {
    const keyName = key.Name || key.name;
    const parentPath = key.Key || key.key || '';
    const newPath = parentPath ? `${parentPath}\\${keyName}` : keyName;

    const hiveOffset = selectedHive?.offset;
    setBreadcrumbs(prev => [...prev, { label: keyName, keyPath: newPath, hiveOffset: hiveOffset ?? null }]);
    await loadKeys(hiveOffset, newPath);
    setSelectedKey(null);
  }, [selectedHive, analysisId]);

  const handleBreadcrumbClick = useCallback(async (index: number) => {
    const bc = breadcrumbs[index];
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    await loadKeys(bc.hiveOffset ?? undefined, bc.keyPath ?? undefined);
    setSelectedKey(null);
  }, [breadcrumbs, analysisId]);

  // Filter keys and values by search
  const filteredKeys = keysData?.keys.filter(k => {
    if (!searchTerm) return true;
    const name = (k.Name || k.name || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  }) || [];

  const filteredValues = keysData?.values.filter(v => {
    if (!searchTerm) return true;
    const name = (v.Name || v.name || '').toLowerCase();
    const data = String(v.Data || v.data || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase()) || data.includes(searchTerm.toLowerCase());
  }) || [];

  if (loading) {
    return (
      <div className="vtf-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="vtf-spinner" />
        <p style={{ color: 'var(--color-slate-500)', marginTop: '1rem' }}>Načítám registry hivy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vtf-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗝️</div>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        <p style={{ color: 'var(--color-slate-500)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          Spusťte pluginy HiveList a PrintKey.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: '0' }}>
      {/* Left: Hive list */}
      <div style={{
        width: '260px', flexShrink: 0, borderRight: '1px solid var(--color-slate-200)',
        display: 'flex', flexDirection: 'column', background: 'var(--color-slate-50)',
      }}>
        <div style={{
          padding: '0.75rem', borderBottom: '1px solid var(--color-slate-200)',
          fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          🗝️ Registry Hivy
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {hives.map((hive, idx) => {
            const isSelected = selectedHive?.offset === hive.offset;
            const icon = getHiveIcon(hive.file_path);
            return (
              <div
                key={idx}
                onClick={() => handleSelectHive(hive)}
                style={{
                  padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8125rem',
                  background: isSelected ? 'white' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  borderBottom: '1px solid var(--color-slate-100)',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-slate-100)'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span>{icon}</span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {hive.short_name}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--color-slate-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {hive.file_path}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Key browser */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedHive ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--color-slate-500)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Vyberte hive</h3>
              <p style={{ fontSize: '0.875rem' }}>Klikněte na hive vlevo pro procházení registrů.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Breadcrumbs */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.75rem',
              borderBottom: '1px solid var(--color-slate-200)', background: 'var(--color-slate-50)',
              fontSize: '0.8125rem', flexWrap: 'wrap',
            }}>
              {breadcrumbs.map((bc, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {i > 0 && <span style={{ color: 'var(--color-slate-400)' }}>›</span>}
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: i === breadcrumbs.length - 1 ? 'var(--color-slate-800)' : 'var(--color-primary)',
                      fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                      fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
                      textDecoration: i === breadcrumbs.length - 1 ? 'none' : 'underline',
                      padding: '0.125rem 0.25rem',
                    }}
                  >
                    {bc.label}
                  </button>
                </span>
              ))}
            </div>

            {/* Search */}
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-slate-200)' }}>
              <input
                type="text"
                placeholder="Filtrovat klíče a hodnoty..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem',
                  border: '1px solid var(--color-slate-300)', borderRadius: 'var(--radius-md)',
                }}
              />
            </div>

            {/* Content */}
            {loadingKeys ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="vtf-spinner" />
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* Subkeys */}
                {filteredKeys.length > 0 && (
                  <div style={{ borderBottom: '1px solid var(--color-slate-200)' }}>
                    <div style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                      color: 'var(--color-slate-500)', background: 'var(--color-slate-50)',
                    }}>
                      📁 Klíče ({filteredKeys.length})
                    </div>
                    {filteredKeys.map((key, idx) => (
                      <div
                        key={idx}
                        onDoubleClick={() => handleNavigateKey(key)}
                        onClick={() => setSelectedKey(key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.375rem 0.75rem', cursor: 'pointer',
                          borderBottom: '1px solid var(--color-slate-50)',
                          background: selectedKey === key ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
                          fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
                        }}
                        onMouseEnter={e => { if (selectedKey !== key) (e.currentTarget as HTMLElement).style.background = 'var(--color-slate-50)'; }}
                        onMouseLeave={e => { if (selectedKey !== key) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span>📁</span>
                        <span style={{ fontWeight: 500 }}>{key.Name || key.name}</span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-400)', marginLeft: 'auto' }}>
                          {key['Last Write Time'] ? new Date(key['Last Write Time']).toLocaleString('cs-CZ') : ''}
                        </span>
                        <span
                          onClick={(e) => { e.stopPropagation(); handleNavigateKey(key); }}
                          style={{ cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.75rem' }}
                        >
                          →
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Values */}
                {filteredValues.length > 0 && (
                  <div>
                    <div style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                      color: 'var(--color-slate-500)', background: 'var(--color-slate-50)',
                    }}>
                      📄 Hodnoty ({filteredValues.length})
                    </div>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-slate-50)' }}>
                          <th style={{ textAlign: 'left', padding: '0.375rem 0.75rem', fontWeight: 600, borderBottom: '1px solid var(--color-slate-200)' }}>Název</th>
                          <th style={{ textAlign: 'left', padding: '0.375rem 0.75rem', fontWeight: 600, borderBottom: '1px solid var(--color-slate-200)' }}>Typ</th>
                          <th style={{ textAlign: 'left', padding: '0.375rem 0.75rem', fontWeight: 600, borderBottom: '1px solid var(--color-slate-200)' }}>Data</th>
                          <th style={{ textAlign: 'left', padding: '0.375rem 0.75rem', fontWeight: 600, borderBottom: '1px solid var(--color-slate-200)' }}>Čas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredValues.map((val, idx) => (
                          <tr key={idx}
                            onClick={() => setSelectedKey(val)}
                            style={{
                              cursor: 'pointer', borderBottom: '1px solid var(--color-slate-50)',
                              background: selectedKey === val ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
                            }}
                            onMouseEnter={e => { if (selectedKey !== val) (e.currentTarget as HTMLElement).style.background = 'var(--color-slate-50)'; }}
                            onMouseLeave={e => { if (selectedKey !== val) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '0.375rem 0.75rem', fontWeight: 500 }}>
                              📄 {val.Name || val.name || '(Default)'}
                            </td>
                            <td style={{ padding: '0.375rem 0.75rem', color: 'var(--color-slate-500)' }}>
                              {val.Type || val.type || '—'}
                            </td>
                            <td style={{
                              padding: '0.375rem 0.75rem', maxWidth: '400px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {String(val.Data || val.data || '').substring(0, 200)}
                            </td>
                            <td style={{ padding: '0.375rem 0.75rem', color: 'var(--color-slate-400)', whiteSpace: 'nowrap' }}>
                              {val['Last Write Time'] ? new Date(val['Last Write Time']).toLocaleString('cs-CZ') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredKeys.length === 0 && filteredValues.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-slate-500)' }}>
                    {searchTerm ? 'Žádné výsledky pro hledaný výraz.' : 'Tento klíč neobsahuje žádné podklíče ani hodnoty.'}
                  </div>
                )}
              </div>
            )}

            {/* Selected item detail */}
            {selectedKey && (
              <div style={{
                borderTop: '1px solid var(--color-slate-200)', padding: '0.75rem',
                background: 'var(--color-slate-50)', maxHeight: '200px', overflowY: 'auto',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0 }}>
                    Detail: {selectedKey.Name || selectedKey.name}
                  </h4>
                  <button onClick={() => setSelectedKey(null)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-slate-400)',
                  }}>✕</button>
                </div>
                <pre style={{
                  fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
                  background: 'white', padding: '0.5rem', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)', margin: 0, overflowX: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {JSON.stringify(selectedKey, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getHiveIcon(path: string): string {
  const p = path.toUpperCase();
  if (p.includes('SYSTEM')) return '⚙️';
  if (p.includes('SOFTWARE')) return '💿';
  if (p.includes('SAM')) return '🔐';
  if (p.includes('SECURITY')) return '🛡️';
  if (p.includes('NTUSER')) return '👤';
  if (p.includes('USRCLASS')) return '📋';
  if (p.includes('DEFAULT')) return '📃';
  if (p.includes('HARDWARE')) return '🖥️';
  if (p.includes('BCD')) return '🔧';
  return '📁';
}
