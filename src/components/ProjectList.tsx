import type { ProjectInfo } from '../api/vtfApi';

interface ProjectListProps {
  projects: ProjectInfo[];
  onProjectSelect: (analysisId: string) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
}

export default function ProjectList({ 
  projects, 
  onProjectSelect, 
  onCreateNew,
  isLoading = false 
}: ProjectListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('cs-CZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">VTF - Volatility Forensics Platform</h1>
        <p className="text-gray-600">Vyberte existující projekt nebo vytvořte nový</p>
      </div>

      {/* Tlačítko pro vytvoření nového projektu */}
      <button
        onClick={onCreateNew}
        className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
        disabled={isLoading}
      >
        <span className="text-2xl">+</span>
        <span>Vytvořit nový projekt (nahrát memory dump)</span>
      </button>

      {/* Seznam existujících projektů */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Načítám projekty...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-gray-400 text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Zatím žádné projekty
          </h3>
          <p className="text-gray-500">
            Vytvořte nový projekt nahráním memory dump souboru
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold mb-4">Existující projekty ({projects.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.analysis_id}
                onClick={() => onProjectSelect(project.analysis_id)}
                className="bg-white rounded-lg shadow-md p-5 cursor-pointer hover:shadow-xl transition-all hover:scale-105 border-2 border-transparent hover:border-blue-500"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">💾</div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {formatFileSize(project.size_bytes)}
                  </span>
                </div>
                
                <h3 className="font-bold text-lg mb-2 truncate" title={project.filename}>
                  {project.filename}
                </h3>
                
                <p className="text-sm text-gray-500 mb-2">
                  {formatDate(project.uploaded_at)}
                </p>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400 font-mono truncate" title={project.analysis_id}>
                    ID: {project.analysis_id.substring(0, 16)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
