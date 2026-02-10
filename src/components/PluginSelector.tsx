import { useState, useEffect } from 'react';
import type { PluginInfo, PresetInfo } from '../api/vtfApi';
import { getProjectInfo, getSymbols, getPluginPresets, checkAllStatus } from '../api/vtfApi';

interface PluginSelectorProps {
  plugins: PluginInfo[];
  analysisId: string;
  onPluginSelect: (plugin: string) => void;
  onBatchRun: (plugins: string[]) => void;
  isAnalyzing?: boolean;
}

export default function PluginSelector({ 
  plugins,
  analysisId,
  onPluginSelect,
  onBatchRun,
  isAnalyzing = false 
}: PluginSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>(new Set());
  const [projectMetadata, setProjectMetadata] = useState<any>(null);
  const [hasSymbols, setHasSymbols] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [presets, setPresets] = useState<{ [name: string]: PresetInfo }>({});
  const [completedPlugins, setCompletedPlugins] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const metadata = await getProjectInfo(analysisId);
        setProjectMetadata(metadata);

        // Load presets for this OS
        try {
          const presetsData = await getPluginPresets(metadata.os_type || undefined);
          setPresets(presetsData.presets);
        } catch { /* presets are optional */ }

        // Load already completed plugins
        try {
          const statusData = await checkAllStatus(analysisId);
          const completed = new Set<string>();
          for (const [name, status] of Object.entries(statusData.plugins)) {
            if (status === 'completed') completed.add(name);
          }
          setCompletedPlugins(completed);
        } catch { /* status checking optional */ }

        // Pokud je to Linux, zkontrolujeme dostupnost symbolů
        if (metadata.os_type === 'linux') {
          const symbols = await getSymbols();
          setHasSymbols(symbols.length > 0);
        }
      } catch (error) {
        console.error('Failed to load metadata:', error);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, [analysisId]);

  // Filtrovat pluginy podle detekovaného OS
  const osFilteredPlugins = projectMetadata?.os_type
    ? plugins.filter(p => p.supported_os.includes(projectMetadata.os_type))
    : plugins;

  // Získáme unikátní kategorie z filtrovaných pluginů
  const categories = ['all', ...Array.from(new Set(osFilteredPlugins.map(p => p.category)))];

  // Filtrované pluginy podle kategorie
  const filteredPlugins = selectedCategory === 'all' 
    ? osFilteredPlugins 
    : osFilteredPlugins.filter(p => p.category === selectedCategory);

  const handleRunAnalysis = () => {
    if (isBatchMode && selectedPlugins.size > 0) {
      // Varování pokud je Linux bez symbolů
      if (projectMetadata?.os_type === 'linux' && !hasSymbols) {
        if (!confirm('⚠️ Nemáte nahrané žádné symboly. Analýza pravděpodobně selže.\n\nOpravdu pokračovat?')) {
          return;
        }
      }
      onBatchRun(Array.from(selectedPlugins));
    } else if (selectedPlugin) {
      if (projectMetadata?.os_type === 'linux' && !hasSymbols) {
        if (!confirm('⚠️ Nemáte nahrané žádné symboly. Analýza pravděpodobně selže.\n\nOpravdu pokračovat?')) {
          return;
        }
      }
      onPluginSelect(selectedPlugin);
    }
  };

  const togglePluginSelection = (pluginName: string) => {
    setSelectedPlugins(prev => {
      const next = new Set(prev);
      if (next.has(pluginName)) {
        next.delete(pluginName);
      } else {
        next.add(pluginName);
      }
      return next;
    });
  };

  const applyPreset = (presetPlugins: string[]) => {
    setSelectedPlugins(new Set(presetPlugins.filter(p => 
      osFilteredPlugins.some(op => op.name === p)
    )));
    setIsBatchMode(true);
  };

  if (isLoadingMetadata) {
    return (
      <div className="vtf-loading" style={{ minHeight: '400px' }}>
        <div className="vtf-spinner"></div>
        <p style={{ color: 'var(--color-slate-600)', marginTop: '1rem' }}>
          Načítám informace o projektu...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* OS Info Banner */}
      {projectMetadata && projectMetadata.os_detected && (
        <div className="vtf-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-slate-700)' }}>
                Detekovaný operační systém
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`vtf-badge ${
                  projectMetadata.os_type === 'windows' ? 'vtf-badge-primary' : 'vtf-badge-success'
                }`} style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                  {projectMetadata.os_type === 'windows' ? '🪟' : '🐧'} {projectMetadata.os_type?.toUpperCase()}
                  {projectMetadata.kernel_version && ` ${projectMetadata.kernel_version}`}
                </span>
                {projectMetadata.architecture && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                    {projectMetadata.architecture}
                  </span>
                )}
              </div>
            </div>
            {projectMetadata.os_type === 'linux' && (
              <div className={`vtf-badge ${hasSymbols ? 'vtf-badge-success' : 'vtf-badge-warning'}`} style={{ padding: '0.75rem 1rem' }}>
                {hasSymbols ? '✓ Symboly dostupné' : '⚠️ Chybí symboly'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning for Linux without symbols */}
      {projectMetadata?.os_type === 'linux' && !hasSymbols && (
        <div className="vtf-alert vtf-alert-warning">
          <span className="vtf-alert-icon">⚠️</span>
          <div className="vtf-alert-content">
            <div className="vtf-alert-title">Chybí symbol soubory</div>
            <div className="vtf-alert-description">
              Pro analýzu Linux memory dumpů jsou vyžadovány custom symboly (ISF soubory).
              Bez nich analýza pravděpodobně selže. Nahrajte vmlinux s debug info nebo ISF soubor přes "Správa symbolů".
            </div>
          </div>
        </div>
      )}

      {/* Batch mode toggle + Presets */}
      <div className="vtf-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={isBatchMode}
              onChange={(e) => {
                setIsBatchMode(e.target.checked);
                if (!e.target.checked) setSelectedPlugins(new Set());
              }}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span>Batch režim (vybrat více pluginů)</span>
          </label>
          {isBatchMode && selectedPlugins.size > 0 && (
            <span className="vtf-badge vtf-badge-primary" style={{ fontSize: '0.875rem' }}>
              {selectedPlugins.size} {selectedPlugins.size === 1 ? 'plugin' : selectedPlugins.size < 5 ? 'pluginy' : 'pluginů'} vybráno
            </span>
          )}
        </div>

        {/* Presets */}
        {Object.keys(presets).length > 0 && (
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--color-slate-200)' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)', marginBottom: '0.75rem' }}>
              Rychlé presety:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {Object.entries(presets).map(([name, preset]) => (
                <button
                  key={name}
                  onClick={() => applyPreset(preset.plugins)}
                  className="vtf-btn vtf-btn-accent"
                  style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
                  title={preset.description}
                  disabled={isAnalyzing}
                >
                  {name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtr kategorií */}
      <div className="vtf-card" style={{ padding: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)', marginBottom: '0.75rem' }}>
          Filtrovat podle kategorie:
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`vtf-btn ${selectedCategory === category ? 'vtf-btn-primary' : 'vtf-btn-secondary'}`}
              style={{ 
                fontSize: '0.875rem', 
                padding: '0.625rem 1rem',
                background: selectedCategory === category ? undefined : 'var(--color-slate-200)',
                color: selectedCategory === category ? undefined : 'var(--color-slate-700)'
              }}
              disabled={isAnalyzing}
            >
              {category === 'all' ? 'Všechny' : category}
            </button>
          ))}
        </div>
        {osFilteredPlugins.length < plugins.length && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: '0.75rem' }}>
            Zobrazeny pluginy pro: <strong>{projectMetadata?.os_type?.toUpperCase()}</strong> 
            ({osFilteredPlugins.length} z {plugins.length})
          </p>
        )}
      </div>

      {/* Seznam pluginů */}
      {filteredPlugins.length === 0 ? (
        <div className="vtf-empty-state">
          <div className="vtf-empty-state-icon">🔌</div>
          <h3 className="vtf-empty-state-title">Žádné pluginy v této kategorii</h3>
          <p className="vtf-empty-state-description">
            Vyberte jinou kategorii nebo zkuste režim "Všechny"
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '1rem' 
        }}>
          {filteredPlugins.map(plugin => {
            const isCompleted = completedPlugins.has(plugin.name);
            const isSelected = isBatchMode 
              ? selectedPlugins.has(plugin.name)
              : selectedPlugin === plugin.name;

            return (
              <div
                key={plugin.name}
                onClick={() => {
                  if (isAnalyzing) return;
                  if (isBatchMode) {
                    togglePluginSelection(plugin.name);
                  } else {
                    setSelectedPlugin(plugin.name);
                  }
                }}
                className="vtf-card"
                style={{
                  padding: '1.25rem',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  opacity: isAnalyzing ? 0.5 : 1,
                  border: isSelected ? '2px solid var(--color-primary-500)' : '1px solid var(--color-slate-200)',
                  background: isSelected ? 'var(--color-primary-50)' : 'white',
                  transition: 'all var(--transition-base)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isBatchMode && (
                      <input
                        type="checkbox"
                        checked={selectedPlugins.has(plugin.name)}
                        onChange={() => togglePluginSelection(plugin.name)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className="vtf-badge vtf-badge-primary" style={{ fontSize: '0.6875rem' }}>
                      {plugin.category}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {isCompleted && (
                      <span className="vtf-badge vtf-badge-success" style={{ fontSize: '0.6875rem' }}>
                        ✓ Hotovo
                      </span>
                    )}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)' }}>
                      {plugin.supported_os.join(', ')}
                    </span>
                  </div>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-900)' }}>
                  {plugin.name.split('.').pop()}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', lineHeight: 1.5 }}>
                  {plugin.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tlačítko pro spuštění */}
      {(selectedPlugin || (isBatchMode && selectedPlugins.size > 0)) && (
        <div className="vtf-card" style={{ padding: '1.5rem', position: 'sticky', bottom: '1rem', boxShadow: 'var(--shadow-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-900)' }}>
                {isBatchMode ? `Vybrané pluginy (${selectedPlugins.size}):` : 'Vybraný plugin:'}
              </h3>
              {isBatchMode ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {Array.from(selectedPlugins).map(p => (
                    <span key={p} className="vtf-badge vtf-badge-primary" style={{ fontSize: '0.75rem' }}>
                      {p.split('.').pop()}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', fontFamily: 'var(--font-mono)' }}>
                  {selectedPlugin}
                </p>
              )}
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="vtf-btn vtf-btn-primary"
              style={{ padding: '0.875rem 2rem', fontSize: '1rem', boxShadow: 'var(--shadow-lg)' }}
            >
              {isAnalyzing ? (
                <>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid white', 
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></div>
                  Spouštím...
                </>
              ) : (
                <>▶️ {isBatchMode ? 'Spustit batch analýzu' : 'Spustit analýzu'}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
