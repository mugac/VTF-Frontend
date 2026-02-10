import { useState, useEffect, useCallback } from 'react';
import UploadForm from './components/UploadForm';
import ProjectList from './components/ProjectList';
import PluginSelector from './components/PluginSelector';
import ResultsGrid from './components/ResultsGrid';
import { 
  getPlugins, 
  runAnalysis,
  runBatchAnalysis,
  checkPluginStatus, 
  checkAllStatus,
  getPluginResults,
  getProjects
} from './api/vtfApi';
import type { PluginInfo, ProjectInfo } from './api/vtfApi';

type AppState = 'project-selection' | 'upload' | 'plugin-selection' | 'processing' | 'results' | 'error';

interface BatchProgress {
  plugin: string;
  status: 'running' | 'completed' | 'failed' | 'not_started';
  error?: string;
}

function App() {
  const [appState, setAppState] = useState<AppState>('project-selection');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

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

  // Polling pro kontrolu stavu analýzy (single plugin)
  useEffect(() => {
    if (appState !== 'processing' || !analysisId) return;

    // Batch mode polling
    if (isBatchMode && selectedPlugins.length > 0) {
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await checkAllStatus(analysisId);
          const newProgress: BatchProgress[] = selectedPlugins.map(p => {
            const status = statusResponse.plugins[p] || 'not_started';
            return { plugin: p, status: status as BatchProgress['status'] };
          });
          setBatchProgress(newProgress);

          // Check if all done (completed or failed)
          const allDone = newProgress.every(p => p.status === 'completed' || p.status === 'failed');
          if (allDone) {
            clearInterval(pollInterval);
            const firstCompleted = newProgress.find(p => p.status === 'completed');
            if (firstCompleted) {
              setSelectedPlugin(firstCompleted.plugin);
              const resultsData = await getPluginResults(analysisId, firstCompleted.plugin);
              setResults(resultsData);
              setAppState('results');
            } else {
              setError('Všechny pluginy selhaly.');
              setAppState('error');
            }
          }
        } catch (err) {
          clearInterval(pollInterval);
          setError(err instanceof Error ? err.message : 'Chyba při kontrole stavu');
          setAppState('error');
        }
      }, 2000);
      return () => clearInterval(pollInterval);
    }

    // Single plugin polling
    if (!selectedPlugin) return;
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await checkPluginStatus(analysisId, selectedPlugin);
        
        if (statusResponse.status === 'completed') {
          clearInterval(pollInterval);
          const resultsData = await getPluginResults(analysisId, selectedPlugin);
          setResults(resultsData);
          setAppState('results');
        } else if (statusResponse.status === 'failed') {
          clearInterval(pollInterval);
          setError(
            `Plugin ${selectedPlugin.split('.').pop()} selhal: ${statusResponse.error || 'Neznámá chyba'}` 
          );
          setAppState('error');
        }
      } catch (err) {
        clearInterval(pollInterval);
        setError(err instanceof Error ? err.message : 'Chyba při kontrole stavu');
        setAppState('error');
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [appState, analysisId, selectedPlugin, selectedPlugins, isBatchMode]);

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
    setIsBatchMode(false);
    try {
      await runAnalysis(analysisId, plugin);
      setAppState('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při spuštění analýzy');
      setAppState('error');
    }
  };

  const handleBatchRun = async (pluginList: string[]) => {
    if (!analysisId || pluginList.length === 0) return;

    setSelectedPlugins(pluginList);
    setIsBatchMode(true);
    setBatchProgress(pluginList.map(p => ({ plugin: p, status: 'not_started' })));
    
    try {
      await runBatchAnalysis(analysisId, pluginList);
      setAppState('processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při spuštění batch analýzy');
      setAppState('error');
    }
  };

  const handleViewBatchResult = async (plugin: string) => {
    if (!analysisId) return;
    try {
      setSelectedPlugin(plugin);
      const resultsData = await getPluginResults(analysisId, plugin);
      setResults(resultsData);
      setAppState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání výsledků');
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
    setSelectedPlugins([]);
    setPlugins([]);
    setResults([]);
    setError(null);
    setIsBatchMode(false);
    setBatchProgress([]);
  };

  const handleBackToPluginSelection = () => {
    setAppState('plugin-selection');
    setSelectedPlugin(null);
    setSelectedPlugins([]);
    setResults([]);
    setError(null);
    setIsBatchMode(false);
    setBatchProgress([]);
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
          onBatchRun={handleBatchRun}
          onBackToUpload={handleBackToUpload}
        />
      )}

      {appState === 'processing' && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-lg">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Probíhá analýza...</h2>
            
            {isBatchMode ? (
              <div className="mt-4 text-left bg-white rounded-lg shadow-md p-4">
                <p className="text-sm text-gray-500 mb-3">
                  Batch analýza: {batchProgress.filter(p => p.status === 'completed').length} / {batchProgress.length} dokončeno
                </p>
                {batchProgress.map(bp => (
                  <div key={bp.plugin} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{bp.plugin.split('.').pop()}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      bp.status === 'completed' ? 'bg-green-100 text-green-700' :
                      bp.status === 'running' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      bp.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {bp.status === 'completed' ? 'Dokončeno' :
                       bp.status === 'running' ? 'Běží...' :
                       bp.status === 'failed' ? 'Selhalo' : 'Čeká'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-gray-600">Plugin: {selectedPlugin}</p>
                <p className="text-gray-500 mt-2">Prosím čekejte, může to trvat několik minut.</p>
              </>
            )}
            
            <p className="text-gray-400 text-sm mt-4">ID analýzy: {analysisId}</p>
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
                {/* Batch results switcher */}
                {isBatchMode && batchProgress.filter(p => p.status === 'completed').length > 1 && (
                  <select
                    value={selectedPlugin || ''}
                    onChange={(e) => handleViewBatchResult(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {batchProgress
                      .filter(p => p.status === 'completed')
                      .map(p => (
                        <option key={p.plugin} value={p.plugin}>
                          {p.plugin.split('.').pop()}
                        </option>
                      ))
                    }
                  </select>
                )}
                <button
                  onClick={handleBackToPluginSelection}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Spustit jiný plugin
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
            analysisId={analysisId!}
            pluginName={selectedPlugin!}
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
