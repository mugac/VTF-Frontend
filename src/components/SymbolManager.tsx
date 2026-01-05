import { useState, useEffect } from 'react';
import { getSymbols, uploadISF, deleteSymbol, type SymbolInfo } from '../api/vtfApi';

export default function SymbolManager() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [kernelVersion, setKernelVersion] = useState('');

  const loadSymbols = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSymbols();
      setSymbols(data);
    } catch (err) {
      setError('Nepodařilo se načíst symboly');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSymbols();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    setError(null);

    try {
      await uploadISF(uploadFile, kernelVersion || undefined);
      setUploadFile(null);
      setKernelVersion('');
      await loadSymbols();
    } catch (err) {
      setError('Nepodařilo se nahrát ISF soubor');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (symbolId: string) => {
    if (!confirm('Opravdu chcete smazat tento symbol file?')) {
      return;
    }

    try {
      await deleteSymbol(symbolId);
      await loadSymbols();
    } catch (err) {
      setError('Nepodařilo se smazat symbol');
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6">Správa symbolů</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Nahrát ISF symbol file</h3>
        <p className="text-sm text-gray-600 mb-4">
          Pokud již máte vygenerovaný ISF soubor, můžete ho nahrát přímo zde.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ISF soubor (.json)
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 p-2"
            />
            {uploadFile && (
              <p className="mt-1 text-sm text-gray-600">
                {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kernel verze (volitelné)
            </label>
            <input
              type="text"
              value={kernelVersion}
              onChange={(e) => setKernelVersion(e.target.value)}
              placeholder="např. 5.15.0-76-generic"
              disabled={isUploading}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!uploadFile || isUploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
        >
          {isUploading ? 'Nahrávám...' : 'Nahrát ISF'}
        </button>
      </div>

      {/* Symbols List */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">
          Dostupné symboly ({symbols.length})
        </h3>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Načítám symboly...</p>
          </div>
        ) : symbols.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Žádné symboly nenalezeny</p>
            <p className="text-sm mt-2">Nahrajte vmlinux při uploadu Linux dumpu nebo nahrajte ISF soubor výše.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kernel Verze
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Velikost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vytvořeno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {symbols.map((symbol) => (
                  <tr key={symbol.symbol_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {symbol.symbol_id.substring(0, 12)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {symbol.kernel_version || <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {symbol.size_mb.toFixed(2)} MB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(symbol.created_at).toLocaleString('cs-CZ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDelete(symbol.symbol_id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
