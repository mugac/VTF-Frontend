import { useState } from 'react';
import type { FormEvent } from 'react';
import type { UploadResponse, DetectOSResponse } from '../api/vtfApi';

interface UploadFormProps {
  onUploadSuccess: (analysisId: string) => void;
  onError: (error: string) => void;
  onBack?: () => void;
}

export default function UploadForm({ onUploadSuccess, onError, onBack }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  
  // OS detection state
  const [selectedOS, setSelectedOS] = useState<'windows' | 'linux'>('windows');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectOSResponse | null>(null);
  
  // Linux symbols state
  const [vmlinuxFile, setVmlinuxFile] = useState<File | null>(null);
  const [isUploadingSymbols, setIsUploadingSymbols] = useState(false);
  const [symbolJobId, setSymbolJobId] = useState<string | null>(null);
  const [symbolStatus, setSymbolStatus] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      // Automaticky nastavíme název projektu podle jména souboru (bez přípony)
      if (!projectName) {
        const fileName = e.target.files[0].name;
        const nameWithoutExt = fileName.replace(/\.(vmem|raw|mem|dmp)$/i, '');
        setProjectName(nameWithoutExt);
      }
    }
  };

  const handleVmlinuxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVmlinuxFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      onError('Prosím vyberte soubor');
      return;
    }

    setIsUploading(true);

    try {
      const { uploadFile } = await import('../api/vtfApi');
      const response = await uploadFile(selectedFile, projectName || undefined);
      setUploadResponse(response);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Nahrávání selhalo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDetectOS = async () => {
    if (!uploadResponse) return;
    
    setIsDetecting(true);
    setDetectionResult(null);
    
    try {
      const { detectOS } = await import('../api/vtfApi');
      const result = await detectOS(uploadResponse.analysis_id);
      setDetectionResult(result);
      
      // Pokud byla detekce úspěšná, automaticky nastavíme OS
      if (result.success && result.os_type) {
        setSelectedOS(result.os_type as 'windows' | 'linux');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Detekce OS selhala');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleVmlinuxUpload = async () => {
    if (!vmlinuxFile || !uploadResponse) return;

    setIsUploadingSymbols(true);
    setSymbolStatus('Uploading vmlinux...');

    try {
      const { uploadVmlinux, getSymbolJobStatus } = await import('../api/vtfApi');
      const kernelVersion = detectionResult?.kernel_version;
      const job = await uploadVmlinux(vmlinuxFile, undefined, kernelVersion);
      setSymbolJobId(job.job_id);
      setSymbolStatus(`Generování ISF symbolů... (${job.status})`);

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const status = await getSymbolJobStatus(job.job_id);
          setSymbolStatus(`Stav: ${status.status}${status.error ? ` - ${status.error}` : ''}`);
          
          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setSymbolStatus('Symboly úspěšně vygenerovány!');
            setTimeout(() => {
              onUploadSuccess(uploadResponse.analysis_id);
            }, 1500);
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setSymbolStatus(`Chyba: ${status.error}`);
            setIsUploadingSymbols(false);
          }
        } catch (error) {
          clearInterval(pollInterval);
          setSymbolStatus('Chyba při kontrole statusu');
          setIsUploadingSymbols(false);
        }
      }, 3000);

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Nepodařilo se nahrát vmlinux');
      setIsUploadingSymbols(false);
    }
  };

  const handleContinue = () => {
    if (selectedOS === 'windows' && uploadResponse) {
      onUploadSuccess(uploadResponse.analysis_id);
    }
  };

  // Pokud není soubor nahrán, zobrazíme upload form
  if (!uploadResponse) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">Nahrát Memory Dump</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Název projektu
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="např. Windows10_Investigation"
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Pokud nevyplníte, použije se název souboru
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Vyberte soubor memory dumpu
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2"
              accept=".vmem,.raw,.mem,.dmp"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Vybraný soubor: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
            >
              {isUploading ? 'Nahrávám...' : 'Nahrát'}
            </button>
            
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Zpět
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // Pokud probíhá generování symbolů, zobrazíme progress
  if (isUploadingSymbols || symbolJobId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-center">Generování Symbolů</h2>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
          
          <p className="text-center text-gray-700 font-medium">{symbolStatus}</p>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              ⏱️ Generování ISF symbolů může trvat několik minut...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Hlavní konfigurace - výběr OS a další kroky
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-center">Konfigurace Projektu</h2>
      
      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        {/* Info o nahraném souboru */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-lg mb-2">Nahraný soubor</h3>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Název:</span> {uploadResponse.filename}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Velikost:</span> {(uploadResponse.size_bytes / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>

        {/* Výběr OS */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Operační systém
          </label>
          <select
            value={selectedOS}
            onChange={(e) => setSelectedOS(e.target.value as 'windows' | 'linux')}
            className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
          </select>
        </div>

        {/* Tlačítko pro detekci OS */}
        <div>
          <button
            onClick={handleDetectOS}
            disabled={isDetecting}
            className="w-full bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
          >
            {isDetecting ? 'Detekovám...' : '🔍 Spustit Banners Plugin'}
          </button>
          <p className="mt-2 text-xs text-gray-500 text-center">
            Použije Volatility plugin pro automatickou detekci OS
          </p>
        </div>

        {/* Výsledky detekce */}
        {detectionResult && (
          <div className={`p-4 rounded-lg ${detectionResult.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <h4 className="font-semibold mb-2">
              {detectionResult.success ? '✅ Detekce úspěšná' : '⚠️ Detekce selhala'}
            </h4>
            
            {detectionResult.success ? (
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">OS:</span> {detectionResult.os_type}</p>
                {detectionResult.kernel_version && (
                  <p><span className="font-medium">Kernel:</span> {detectionResult.kernel_version}</p>
                )}
                {detectionResult.architecture && (
                  <p><span className="font-medium">Architektura:</span> {detectionResult.architecture}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-yellow-800">{detectionResult.error}</p>
            )}

            {/* Výstup z banners */}
            {detectionResult.banners_output && detectionResult.banners_output.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Zobrazit výstup z Banners plugin
                </summary>
                <div className="mt-2 p-3 bg-white rounded border border-gray-200 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                    {detectionResult.banners_output.map((item, idx) => (
                      <div key={idx}>{item.Banner}</div>
                    ))}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Linux workflow - upload vmlinux */}
        {selectedOS === 'linux' && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2">⚙️ Linux - Symboly</h4>
            <p className="text-sm text-gray-700 mb-4">
              Pro analýzu Linux dumpů jsou potřeba ISF symbol soubory. Nahrajte vmlinux soubor pro automatické generování symbolů.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nahrát vmlinux soubor
                </label>
                <input
                  type="file"
                  onChange={handleVmlinuxChange}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none p-2"
                />
              </div>
              
              <button
                onClick={handleVmlinuxUpload}
                disabled={!vmlinuxFile}
                className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
              >
                Nahrát vmlinux a generovat symboly
              </button>
              
              <button
                onClick={() => onUploadSuccess(uploadResponse.analysis_id)}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-semibold transition"
              >
                Pokračovat bez symbolů (omezená funkcionalita)
              </button>
            </div>
          </div>
        )}

        {/* Windows workflow - pokračovat */}
        {selectedOS === 'windows' && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-semibold mb-2">✅ Windows</h4>
            <p className="text-sm text-gray-700 mb-4">
              Windows dumpy nepotřebují dodatečné symboly. Můžete pokračovat k analýze.
            </p>
            
            <button
              onClick={handleContinue}
              className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 font-semibold transition"
            >
              Pokračovat k analýze
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
