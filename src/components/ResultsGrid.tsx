import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { useMemo } from 'react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Registrace AG Grid modulů
ModuleRegistry.registerModules([AllCommunityModule]);

interface ResultsGridProps {
  data: any[];
  onBackToUpload: () => void;
}

export default function ResultsGrid({ data, onBackToUpload }: ResultsGridProps) {
  // Automaticky vygenerujeme sloupce na základě klíčů prvního řádku dat
  const columnDefs: ColDef[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    const firstRow = data[0];
    return Object.keys(firstRow).map((key) => ({
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

  return (
    <div className="h-screen flex flex-col p-6 pt-2">
      {!data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-lg shadow-md">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-2">Žádná data k zobrazení</p>
            <p className="text-gray-400 text-sm">Analýza nevrátila žádné výsledky</p>
          </div>
        </div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 150px)', width: '100%' }}>
          <AgGridReact
            rowData={data}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={50}
            animateRows={true}
          />
        </div>
      )}
    </div>
  );
}
