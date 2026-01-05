import { useState, useEffect } from 'react';
import UploadForm from './components/UploadForm';
import ProjectList from './components/ProjectList';
import PluginSelector from './components/PluginSelector';
import ResultsGrid from './components/ResultsGrid';
import { 
  getPlugins, 
  runAnalysis, 
  checkPluginStatus, 
  getPluginResults,
  getProjects
} from './api/vtfApi';
import type { PluginInfo, ProjectInfo } from './api/vtfApi';

type AppState = 'project-selection' | 'upload' | 'plugin-selection' | 'processing' | 'results' | 'error';

function App() {
  const [appState, setAppState] = useState<AppState>('project-selection');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Načtení projektů při startu
  useEffect(() => {
    if (appState === 'project-selection') {
      loadProjects();
    }
  }, [appState]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const projectsData = await getProjects();
      setProjects(projectsData);
    } catch (err) {
      console.error('Chyba při načítání projektů:', err);
      // Necháme seznam prázdný, ale nezobrazíme chybu
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Načtení pluginů po uploadu
  useEffect(() => {
    if (appState === 'plugin-selection' && plugins.length === 0) {
      loadPlugins();
    }
  }, [appState]);

  const loadPlugins = async () => {
    try {
      const pluginsData = await getPlugins();
      setPlugins(pluginsData.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání pluginů');
      setAppState('error');
    }
  };

  // Polling pro kontrolu stavu analýzy
  useEffect(() => {
    if (appState !== 'processing' || !analysisId || !selectedPlugin) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await checkPluginStatus(analysisId, selectedPlugin);
        
        if (statusResponse.status === 'completed') {
          clearInterval(pollInterval);
          
          // Stáhnout výsledky
          const resultsData = await getPluginResults(analysisId, selectedPlugin);
          setResults(resultsData);
          setAppState('results');
        }
      } catch (err) {
        clearInterval(pollInterval);
        setError(err instanceof Error ? err.message : 'Chyba při kontrole stavu');
        setAppState('error');
      }
    }, 2000); // Kontrola každé 2 sekundy

    return () => clearInterval(pollInterval);
  }, [appState, analysisId, selectedPlugin]);

  const handleUploadSuccess = (id: string) => {
    setAnalysisId(id);
    setAppState('plugin-selection');
    setError(null);
  };

  const handleProjectSelect = (id: string) => {
    setAnalysisId(id);
    setAppState('plugin-selection');
    setError(null);
  };

  const handleCreateNewProject = () => {
    setAppState('upload');
  };

  const handlePluginSelect = async (plugin: string) => {
    if (!analysisId) return;
    
    setSelectedPlugin(plugin);
    try {
      await runAnalysis(analysisId, plugin);
      setAppState('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při spuštění analýzy');
      setAppState('error');
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setAppState('error');
  };

  const handleBackToUpload = () => {
    setAppState('project-selection');
    setAnalysisId(null);
    setSelectedPlugin(null);
    setPlugins([]);
    setResults([]);
    setError(null);
  };

  const handleBackToPluginSelection = () => {
    setAppState('plugin-selection');
    setSelectedPlugin(null);
    setResults([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {appState === 'project-selection' && (
        <ProjectList
          projects={projects}
          onProjectSelect={handleProjectSelect}
          onCreateNew={handleCreateNewProject}
          isLoading={isLoadingProjects}
        />
      )}

      {appState === 'upload' && (
        <UploadForm 
          onUploadSuccess={handleUploadSuccess}
          onError={handleError}
          onBack={handleBackToUpload}
        />
      )}

      {appState === 'plugin-selection' && (
        <PluginSelector
          plugins={plugins}
          analysisId={analysisId!}
          onPluginSelect={handlePluginSelect}
          onBackToUpload={handleBackToUpload}
        />
      )}

      {appState === 'processing' && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Probíhá analýza...</h2>
            <p className="text-gray-600">Plugin: {selectedPlugin}</p>
            <p className="text-gray-600">ID analýzy: {analysisId}</p>
            <p className="text-gray-500 mt-2">Prosím čekejte, může to trvat několik minut.</p>
          </div>
        </div>
      )}

      {appState === 'results' && (
        <div>
          <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-3">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Výsledky: {selectedPlugin?.split('.').pop()}
                </h3>
                <p className="text-sm text-gray-500">ID analýzy: {analysisId}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBackToPluginSelection}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  ← Spustit jiný plugin
                </button>
                <button
                  onClick={handleBackToUpload}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Zpět na projekty
                </button>
              </div>
            </div>
          </div>
          <ResultsGrid 
            data={results}
            onBackToUpload={handleBackToUpload}
          />
        </div>
      )}

      {appState === 'error' && (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2 text-red-600">Chyba</h2>
            <p className="text-gray-700 mb-4">{error}</p>
            <button
              onClick={handleBackToUpload}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Zpět na projekty
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
