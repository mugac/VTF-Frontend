import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellClickedEvent, RowClassParams } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { useMemo, useState, useCallback } from 'react';
import { getExportUrl, correlateByPid } from '../api/vtfApi';
import type { CorrelationResponse } from '../api/vtfApi';
import { useInvestigation } from '../context/InvestigationContext';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Registrace AG Grid modulů
ModuleRegistry.registerModules([AllCommunityModule]);

interface ResultsGridProps {
  data: any[];
  analysisId: string;
  pluginName: string;
  onBackToUpload: () => void;
}

export default function ResultsGrid({ data, analysisId, pluginName, onBackToUpload }: ResultsGridProps) {
  const [correlation, setCorrelation] = useState<CorrelationResponse | null>(null);
  const [isLoadingCorrelation, setIsLoadingCorrelation] = useState(false);
  const { isTracked, addTrackedPid, removeTrackedPid, trackedPids } = useInvestigation();

  // Automaticky vygenerujeme sloupce na základě klíčů prvního řádku dat
  const columnDefs: ColDef[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    const firstRow = data[0];
    return Object.keys(firstRow)
      .filter(key => key !== '__children')  // Filter out Volatility internal field
      .map((key) => ({
        field: key,
        headerName: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        minWidth: 150,
      }));
  }, [data]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  // Check if data has PID column for correlation
  const hasPidColumn = useMemo(() => {
    if (!data || data.length === 0) return false;
    return 'PID' in data[0] || 'Pid' in data[0] || 'pid' in data[0];
  }, [data]);

  const handleCellClicked = useCallback(async (event: CellClickedEvent) => {
    const field = event.colDef.field;
    if (!field) return;
    
    // If user clicks on a PID cell, show correlation
    if (['PID', 'Pid', 'pid'].includes(field) && event.value != null) {
      setIsLoadingCorrelation(true);
      try {
        const result = await correlateByPid(analysisId, Number(event.value));
        setCorrelation(result);
      } catch {
        // No correlation data found — that's OK
        setCorrelation(null);
      } finally {
        setIsLoadingCorrelation(false);
      }
    }
  }, [analysisId]);

  // Track/untrack PID handler
  const handleTrackPid = useCallback(async (pid: number, processName?: string) => {
    if (isTracked(pid)) {
      await removeTrackedPid(pid);
    } else {
      await addTrackedPid({
        pid,
        process_name: processName || '',
        tags: ['interesting'],
        source_plugin: pluginName,
      });
    }
  }, [isTracked, addTrackedPid, removeTrackedPid, pluginName]);

  // Row styling for tracked PIDs
  const getRowStyle = useCallback((params: RowClassParams) => {
    if (!params.data) return undefined;
    const pid = params.data.PID ?? params.data.Pid ?? params.data.pid;
    if (pid != null && isTracked(Number(pid))) {
      return { background: 'rgba(250, 204, 21, 0.1)', borderLeft: '3px solid #f59e0b' };
    }
    return undefined;
  }, [isTracked, trackedPids]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Export toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end' }}>
        {hasPidColumn && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginRight: 'auto' }}>
            💡 Tip: Klikněte na PID pro cross-plugin korelaci
            {correlation && (
              <button
                onClick={() => handleTrackPid(correlation.pid)}
                style={{
                  marginLeft: '0.75rem', padding: '0.25rem 0.625rem', fontSize: '0.75rem',
                  border: '1px solid #f59e0b', borderRadius: 'var(--radius-md)',
                  background: isTracked(correlation.pid) ? '#fef3c7' : 'white',
                  color: '#b45309', cursor: 'pointer', fontWeight: 500,
                }}
              >
                {isTracked(correlation.pid) ? '⭐ Sledován' : '☆ Sledovat PID ' + correlation.pid}
              </button>
            )}
          </span>
        )}
        <a
          href={getExportUrl(analysisId, pluginName, 'csv')}
          className="vtf-btn"
          style={{ 
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            background: 'var(--color-success)',
            color: 'white',
            textDecoration: 'none'
          }}
          download
        >
          📊 Export CSV
        </a>
        <a
          href={getExportUrl(analysisId, pluginName, 'json')}
          className="vtf-btn vtf-btn-primary"
          style={{ 
            padding: '0.5rem 1rem',
            fontSize: '0.875rem'
          }}
          download
        >
          📄 Export JSON
        </a>
      </div>

      {!data || data.length === 0 ? (
        <div className="vtf-card" style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '400px'
        }}>
          <div className="vtf-empty-state">
            <div className="vtf-empty-state-icon">📊</div>
            <h3 className="vtf-empty-state-title">Žádná data k zobrazení</h3>
            <p className="vtf-empty-state-description">
              Analýza nevrátila žádné výsledky
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, gap: '1rem', minHeight: 0 }}>
          {/* Main grid */}
          <div 
            className={`ag-theme-alpine ${correlation ? '' : ''}`} 
            style={{ 
              flex: correlation ? '1' : '1',
              height: '100%',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--color-slate-200)'
            }}
          >
            <AgGridReact
              rowData={data}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={50}
              animateRows={true}
              onCellClicked={handleCellClicked}
              getRowStyle={getRowStyle}
            />
          </div>

          {/* Correlation panel */}
          {isLoadingCorrelation && (
            <div className="vtf-card" style={{ 
              width: '400px', 
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <div className="vtf-loading">
                <div className="vtf-spinner"></div>
                <p style={{ color: 'var(--color-slate-600)', marginTop: '1rem', fontSize: '0.875rem' }}>
                  Načítám korelaci...
                </p>
              </div>
            </div>
          )}
          
          {correlation && !isLoadingCorrelation && (
            <div className="vtf-card" style={{ 
              width: '450px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <div style={{ 
                padding: '1.25rem',
                borderBottom: '1px solid var(--color-slate-200)',
                background: 'var(--color-slate-50)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-slate-900)' }}>
                    PID {correlation.pid}
                  </h4>
                  <button
                    onClick={() => setCorrelation(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-slate-400)',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      lineHeight: 1
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
                  Cross-plugin korelace
                </p>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(correlation.data).map(([label, info]) => (
                  <div key={label} className="vtf-card" style={{ padding: '1rem', background: 'var(--color-slate-50)' }}>
                    <h5 style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 600, 
                      marginBottom: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: 'var(--color-slate-900)'
                    }}>
                      <span>{label}</span>
                      <span className="vtf-badge vtf-badge-slate" style={{ fontSize: '0.6875rem' }}>
                        {info.count} {info.count === 1 ? 'záznam' : info.count < 5 ? 'záznamy' : 'záznamů'}
                      </span>
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {info.rows.slice(0, 10).map((row, idx) => (
                        <pre key={idx} style={{ 
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          background: 'white',
                          padding: '0.625rem',
                          borderRadius: 'var(--radius-md)',
                          overflowX: 'auto',
                          border: '1px solid var(--color-slate-200)',
                          margin: 0,
                          color: 'var(--color-slate-700)'
                        }}>
                          {JSON.stringify(row, null, 1).substring(0, 200)}
                        </pre>
                      ))}
                      {info.count > 10 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', textAlign: 'center', marginTop: '0.25rem' }}>
                          ... a dalších {info.count - 10}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
