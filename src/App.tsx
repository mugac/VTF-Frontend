import { useState, useEffect } from 'react';
import UploadForm from './components/UploadForm';
import ResultsGrid from './components/ResultsGrid';
import { checkStatus, getResults } from './api/vtfApi';

type AppState = 'upload' | 'processing' | 'results' | 'error';

function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Polling pro kontrolu stavu analýzy
  useEffect(() => {
    if (appState !== 'processing' || !analysisId) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await checkStatus(analysisId);
        
        if (statusResponse.status === 'completed') {
          clearInterval(pollInterval);
          
          // Stáhnout výsledky
          const resultsData = await getResults(analysisId);
          console.log('Načtená data z API:', resultsData);
          console.log('Počet řádků:', resultsData?.length || 0);
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
  }, [appState, analysisId]);

  const handleUploadSuccess = (id: string) => {
    setAnalysisId(id);
    setAppState('processing');
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setAppState('error');
  };

  const handleBackToUpload = () => {
    setAppState('upload');
    setAnalysisId(null);
    setResults([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {appState === 'upload' && (
        <UploadForm 
          onUploadSuccess={handleUploadSuccess}
          onError={handleError}
        />
      )}

      {appState === 'processing' && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Probíhá analýza...</h2>
            <p className="text-gray-600">ID analýzy: {analysisId}</p>
            <p className="text-gray-500 mt-2">Prosím čekejte, může to trvat několik minut.</p>
          </div>
        </div>
      )}

      {appState === 'results' && (
        <ResultsGrid 
          data={results}
          onBackToUpload={handleBackToUpload}
        />
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
              Zkusit znovu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
