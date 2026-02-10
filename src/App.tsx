import { useState, useEffect, useCallback } from 'react';
import UploadForm from './components/UploadForm';
import ProjectList from './components/ProjectList';
import PluginSelector from './components/PluginSelector';
import ResultsGrid from './components/ResultsGrid';
import SymbolManager from './components/SymbolManager';
import './App.css';
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

type AppState = 'project-selection' | 'upload' | 'plugin-selection' | 'processing' | 'results' | 'symbols' | 'error';

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
    <div className="vtf-app-container">
      {/* Professional Sidebar Navigation */}
      <aside className="vtf-sidebar">
        <div className="vtf-sidebar-header">
          <div className="vtf-sidebar-logo">
            <div className="vtf-sidebar-logo-icon">🔍</div>
            <div>
              <div>VTF</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-slate-400)' }}>
                Forensics Platform
              </div>
            </div>
          </div>
        </div>
        
        <nav className="vtf-sidebar-nav">
          <div 
            className={`vtf-sidebar-nav-item ${appState === 'project-selection' || appState === 'upload' ? 'active' : ''}`}
            onClick={handleBackToUpload}
          >
            <span className="vtf-sidebar-nav-icon">📁</span>
            <span>Projekty</span>
          </div>
          
          {analysisId && (
            <div 
              className={`vtf-sidebar-nav-item ${appState === 'plugin-selection' || appState === 'processing' ? 'active' : ''}`}
              onClick={handleBackToPluginSelection}
            >
              <span className="vtf-sidebar-nav-icon">🔌</span>
              <span>Analýza</span>
            </div>
          )}
          
          {analysisId && selectedPlugin && (
            <div 
              className={`vtf-sidebar-nav-item ${appState === 'results' ? 'active' : ''}`}
            >
              <span className="vtf-sidebar-nav-icon">📊</span>
              <span>Výsledky</span>
            </div>
          )}
          
          <div 
            className={`vtf-sidebar-nav-item ${appState === 'symbols' ? 'active' : ''}`}
            onClick={() => {
              setAppState('symbols');
              setError(null);
            }}
          >
            <span className="vtf-sidebar-nav-icon">⚙️</span>
            <span>Správa symbolů</span>
          </div>
        </nav>
        
        <div className="vtf-sidebar-footer">
          <div>Version 2.0.0</div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem' }}>
            Powered by Volatility 3
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="vtf-main-content">
        {/* Top Header */}
        {appState !== 'project-selection' && appState !== 'error' && (
          <header className="vtf-header">
            <div className="vtf-header-title">
              <div>
                <h1>
                  {appState === 'upload' && 'Nahrát Memory Dump'}
                  {appState === 'plugin-selection' && 'Vybrat Plugin'}
                  {appState === 'processing' && 'Probíhá Analýza'}
                  {appState === 'results' && `Výsledky: ${selectedPlugin?.split('.').pop()}`}
                  {appState === 'symbols' && 'Správa Symbolů'}
                </h1>
                {analysisId && appState !== 'symbols' && (
                  <p className="vtf-header-subtitle">ID: {analysisId.substring(0, 24)}...</p>
                )}
              </div>
            </div>
            <div className="vtf-header-actions">
              {analysisId && appState !== 'symbols' && (
                <button 
                  onClick={handleBackToUpload} 
                  className="vtf-btn vtf-btn-secondary"
                >
                  ← Projekty
                </button>
              )}
            </div>
          </header>
        )}

        {/* Content Area */}
        <div className="vtf-content">
          {appState === 'project-selection' && (
            <ProjectList
              projects={projects}
              onProjectSelect={handleProjectSelect}
              onCreateNew={handleCreateNewProject}
              isLoading={isLoadingProjects}
            />
          )}

          {appState === 'upload' && (
            <div className="vtf-content-narrow">
              <UploadForm 
                onUploadSuccess={handleUploadSuccess}
                onError={handleError}
                onBack={handleBackToUpload}
              />
            </div>
          )}

          {appState === 'plugin-selection' && (
            <div className="vtf-content-wide">
              <PluginSelector
                plugins={plugins}
                analysisId={analysisId!}
                onPluginSelect={handlePluginSelect}
                onBatchRun={handleBatchRun}
              />
            </div>
          )}

          {appState === 'processing' && (
            <div className="vtf-loading">
              <div className="vtf-spinner"></div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '1rem' }}>
                Probíhá analýza...
              </h2>
              
              {isBatchMode ? (
                <div className="vtf-card" style={{ maxWidth: '600px', width: '100%', padding: '1.5rem', marginTop: '1.5rem' }}>
                  <p className="text-sm text-gray-500 mb-3">
                    Batch analýza: {batchProgress.filter(p => p.status === 'completed').length} / {batchProgress.length} dokončeno
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {batchProgress.map(bp => (
                      <div key={bp.plugin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{bp.plugin.split('.').pop()}</span>
                        <span className={`vtf-status-badge vtf-status-${bp.status === 'completed' ? 'completed' : bp.status === 'running' ? 'running' : bp.status === 'failed' ? 'failed' : 'pending'}`}>
                          {bp.status === 'completed' ? '✓ Dokončeno' :
                           bp.status === 'running' ? '● Běží...' :
                           bp.status === 'failed' ? '✗ Selhalo' : '○ Čeká'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-slate-600)', marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Plugin: <strong>{selectedPlugin}</strong></p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)' }}>
                    Prosím čekejte, může to trvat několik minut.
                  </p>
                </div>
              )}
            </div>
          )}

          {appState === 'results' && (
            <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
              {/* Batch results switcher in content area */}
              {isBatchMode && batchProgress.filter(p => p.status === 'completed').length > 1 && (
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
                    Zobrazit výsledky:
                  </label>
                  <select
                    value={selectedPlugin || ''}
                    onChange={(e) => handleViewBatchResult(e.target.value)}
                    style={{ 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--color-slate-300)',
                      fontSize: '0.875rem',
                      background: 'white'
                    }}
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
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleBackToPluginSelection}
                      className="vtf-btn vtf-btn-primary"
                    >
                      Spustit jiný plugin
                    </button>
                  </div>
                </div>
              )}
              <ResultsGrid 
                data={results}
                analysisId={analysisId!}
                pluginName={selectedPlugin!}
                onBackToUpload={handleBackToUpload}
              />
            </div>
          )}

          {appState === 'symbols' && (
            <div className="vtf-content-wide">
              <SymbolManager />
            </div>
          )}

          {appState === 'error' && (
            <div className="vtf-loading">
              <div style={{ 
                background: 'white', 
                borderRadius: 'var(--radius-xl)', 
                padding: '3rem', 
                maxWidth: '500px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-slate-200)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '1rem' }}>
                  Chyba
                </h2>
                <p style={{ color: 'var(--color-slate-700)', marginBottom: '2rem', fontSize: '1rem' }}>
                  {error}
                </p>
                <button
                  onClick={handleBackToUpload}
                  className="vtf-btn vtf-btn-primary"
                  style={{ padding: '0.75rem 2rem' }}
                >
                  Zpět na projekty
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
