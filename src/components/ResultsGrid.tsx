import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellClickedEvent } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { useMemo, useState, useCallback } from 'react';
import { getExportUrl, correlateByPid } from '../api/vtfApi';
import type { CorrelationResponse } from '../api/vtfApi';
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

  return (
    <div className="h-screen flex flex-col p-6 pt-2">
      {/* Export toolbar */}
      <div className="flex gap-2 mb-2 justify-end items-center">
        {hasPidColumn && (
          <span className="text-xs text-gray-500 mr-auto">
            Tip: Klikněte na PID pro cross-plugin korelaci
          </span>
        )}
        <a
          href={getExportUrl(analysisId, pluginName, 'csv')}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-1.5 px-3 rounded transition-colors"
          download
        >
          Export CSV
        </a>
        <a
          href={getExportUrl(analysisId, pluginName, 'json')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-3 rounded transition-colors"
          download
        >
          Export JSON
        </a>
      </div>

      {!data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-lg shadow-md">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-2">Žádná data k zobrazení</p>
            <p className="text-gray-400 text-sm">Analýza nevrátila žádné výsledky</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 gap-4">
          {/* Main grid */}
          <div className={`ag-theme-alpine ${correlation ? 'flex-1' : 'w-full'}`} style={{ height: 'calc(100vh - 180px)' }}>
            <AgGridReact
              rowData={data}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={50}
              animateRows={true}
              onCellClicked={handleCellClicked}
            />
          </div>

          {/* Correlation panel */}
          {isLoadingCorrelation && (
            <div className="w-80 bg-white rounded-lg shadow-md p-4 flex items-center justify-center" style={{ height: 'calc(100vh - 180px)' }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {correlation && !isLoadingCorrelation && (
            <div className="w-96 bg-white rounded-lg shadow-md overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
              <div className="p-4 border-b sticky top-0 bg-white z-10">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-lg">PID {correlation.pid}</h4>
                  <button
                    onClick={() => setCorrelation(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-500">Cross-plugin korelace</p>
              </div>
              
              <div className="p-4 space-y-4">
                {Object.entries(correlation.data).map(([label, info]) => (
                  <div key={label} className="border rounded-lg p-3">
                    <h5 className="font-semibold text-sm mb-2 flex justify-between">
                      {label}
                      <span className="text-xs text-gray-400 font-normal">{info.count} záznamů</span>
                    </h5>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {info.rows.slice(0, 10).map((row, idx) => (
                        <pre key={idx} className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(row, null, 1).substring(0, 200)}
                        </pre>
                      ))}
                      {info.count > 10 && (
                        <p className="text-xs text-gray-400">... a dalších {info.count - 10}</p>
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
