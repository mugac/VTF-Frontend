import { useState } from 'react';
import type { PluginInfo } from '../api/vtfApi';

interface PluginSelectorProps {
  plugins: PluginInfo[];
  onPluginSelect: (plugin: string) => void;
  onBackToUpload: () => void;
  isAnalyzing?: boolean;
}

export default function PluginSelector({ 
  plugins, 
  onPluginSelect, 
  onBackToUpload,
  isAnalyzing = false 
}: PluginSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  // Získáme unikátní kategorie
  const categories = ['all', ...Array.from(new Set(plugins.map(p => p.category)))];

  // Filtrované pluginy podle kategorie
  const filteredPlugins = selectedCategory === 'all' 
    ? plugins 
    : plugins.filter(p => p.category === selectedCategory);

  const handleRunAnalysis = () => {
    if (selectedPlugin) {
      onPluginSelect(selectedPlugin);
    }
  };

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
            <div className="mb-2">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {plugin.category}
              </span>
            </div>
            <h3 className="font-bold text-lg mb-2">
              {plugin.name.split('.').pop()}
            </h3>
            <p className="text-sm text-gray-600">{plugin.description}</p>
          </div>
        ))}
      </div>

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
