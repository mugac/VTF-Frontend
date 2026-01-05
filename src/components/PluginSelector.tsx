import { useState, useEffect } from 'react';
import type { PluginInfo } from '../api/vtfApi';
import { getProjectInfo, getSymbols } from '../api/vtfApi';

interface PluginSelectorProps {
  plugins: PluginInfo[];
  analysisId: string;
  onPluginSelect: (plugin: string) => void;
  onBackToUpload: () => void;
  isAnalyzing?: boolean;
}

export default function PluginSelector({ 
  plugins,
  analysisId,
  onPluginSelect, 
  onBackToUpload,
  isAnalyzing = false 
}: PluginSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [projectMetadata, setProjectMetadata] = useState<any>(null);
  const [hasSymbols, setHasSymbols] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const metadata = await getProjectInfo(analysisId);
        setProjectMetadata(metadata);

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
    if (selectedPlugin) {
      // Varování pokud je Linux bez symbolů
      if (projectMetadata?.os_type === 'linux' && !hasSymbols) {
        if (!confirm('⚠️ Nemáte nahrané žádné symboly. Analýza pravděpodobně selže.\n\nOpravdu pokračovat?')) {
          return;
        }
      }
      onPluginSelect(selectedPlugin);
    }
  };

  if (isLoadingMetadata) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Načítám informace o projektu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-3xl font-bold">Vyberte plugin pro analýzu</h2>
        <button
          onClick={onBackToUpload}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          disabled={isAnalyzing}
        >
          ← Zpět na projekty
        </button>
      </div>

      {/* OS Info Banner */}
      {projectMetadata && projectMetadata.os_detected && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-2">Detekovaný operační systém:</h3>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  projectMetadata.os_type === 'windows' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {projectMetadata.os_type?.toUpperCase()}
                  {projectMetadata.kernel_version && ` ${projectMetadata.kernel_version}`}
                </span>
                {projectMetadata.architecture && (
                  <span className="text-sm text-gray-600">
                    {projectMetadata.architecture}
                  </span>
                )}
              </div>
            </div>
            {projectMetadata.os_type === 'linux' && (
              <div className={`px-4 py-2 rounded-lg ${
                hasSymbols 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {hasSymbols ? '✓ Symboly dostupné' : '⚠️ Chybí symboly'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning for Linux without symbols */}
      {projectMetadata?.os_type === 'linux' && !hasSymbols && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h4 className="font-semibold text-yellow-800 mb-1">
                Chybí symbol soubory
              </h4>
              <p className="text-sm text-yellow-700 mb-2">
                Pro analýzu Linux memory dumpů jsou vyžadovány custom symboly (ISF soubory).
                Bez nich analýza pravděpodobně selže.
              </p>
              <p className="text-sm text-yellow-700">
                Nahrajte vmlinux s debug info nebo ISF soubor přes "Správa symbolů".
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtr kategorií */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtrovat podle kategorie:
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={isAnalyzing}
            >
              {category === 'all' ? 'Všechny' : category}
            </button>
          ))}
        </div>
        {osFilteredPlugins.length < plugins.length && (
          <p className="text-sm text-gray-500 mt-2">
            Zobrazeny pluginy pro: {projectMetadata?.os_type?.toUpperCase()} 
            ({osFilteredPlugins.length} z {plugins.length})
          </p>
        )}
      </div>

      {/* Seznam pluginů */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {filteredPlugins.map(plugin => (
          <div
            key={plugin.name}
            onClick={() => !isAnalyzing && setSelectedPlugin(plugin.name)}
            className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all ${
              selectedPlugin === plugin.name
                ? 'ring-2 ring-blue-600 bg-blue-50'
                : 'hover:shadow-lg'
            } ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {plugin.category}
              </span>
              <span className="text-xs text-gray-500">
                {plugin.supported_os.join(', ')}
              </span>
            </div>
            <h3 className="font-bold text-lg mb-2">
              {plugin.name.split('.').pop()}
            </h3>
            <p className="text-sm text-gray-600">{plugin.description}</p>
          </div>
        ))}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg">
            Žádné pluginy v této kategorii
          </p>
        </div>
      )}

      {/* Tlačítko pro spuštění */}
      {selectedPlugin && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg mb-1">Vybraný plugin:</h3>
              <p className="text-gray-600">{selectedPlugin}</p>
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isAnalyzing ? 'Spouštím...' : 'Spustit analýzu'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
