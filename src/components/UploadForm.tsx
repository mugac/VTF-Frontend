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

  const handleContinue = async () => {
    if (!uploadResponse) return;
    
    try {
      // Uložíme vybraný OS do metadat
      const { updateProject } = await import('../api/vtfApi');
      await updateProject(uploadResponse.analysis_id, { osType: selectedOS });
      
      // Pokračujeme dál
      onUploadSuccess(uploadResponse.analysis_id);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Nepodařilo se aktualizovat OS');
    }
  };
  
  const handleLinuxContinueWithoutSymbols = async () => {
    if (!uploadResponse) return;
    
    try {
      // Uložíme vybraný OS do metadat
      const { updateProject } = await import('../api/vtfApi');
      await updateProject(uploadResponse.analysis_id, { osType: selectedOS });
      
      // Pokračujeme dál
      onUploadSuccess(uploadResponse.analysis_id);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Nepodařilo se aktualizovat OS');
    }
  };

  // Pokud není soubor nahrán, zobrazíme upload form
  if (!uploadResponse) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '64px', 
            height: '64px',
            background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-primary-500))',
            borderRadius: 'var(--radius-xl)',
            fontSize: '2rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            ⬆️
          </div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
            Nahrát Memory Dump
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="vtf-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-700)' }}>
              Název projektu
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="např. Windows10_Investigation"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid var(--color-slate-300)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9375rem',
                transition: 'all var(--transition-fast)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-500)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-slate-300)'}
            />
            <p style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
              Pokud nevyplníte, použije se název souboru
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-700)' }}>
              Vyberte soubor memory dumpu
            </label>
            <div style={{
              position: 'relative',
              border: '2px dashed var(--color-slate-300)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              textAlign: 'center',
              background: 'var(--color-slate-50)',
              transition: 'all var(--transition-base)',
              cursor: 'pointer'
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'var(--color-primary-500)';
              e.currentTarget.style.background = 'var(--color-primary-50)';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-slate-300)';
              e.currentTarget.style.background = 'var(--color-slate-50)';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'var(--color-slate-300)';
              e.currentTarget.style.background = 'var(--color-slate-50)';
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                setSelectedFile(file);
                if (!projectName) {
                  const fileName = file.name;
                  const nameWithoutExt = fileName.replace(/\.(vmem|raw|mem|dmp)$/i, '');
                  setProjectName(nameWithoutExt);
                }
              }
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📁</div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-slate-700)', marginBottom: '0.5rem' }}>
                <strong>Přetáhněte soubor sem</strong> nebo klikněte pro výběr
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
                Podporované formáty: .vmem, .raw, .mem, .dmp
              </p>
              <input
                type="file"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
                accept=".vmem,.raw,.mem,.dmp"
              />
            </div>
            {selectedFile && (
              <div className="vtf-alert vtf-alert-success" style={{ marginTop: '1rem' }}>
                <span className="vtf-alert-icon">✓</span>
                <div className="vtf-alert-content">
                  <div className="vtf-alert-title">{selectedFile.name}</div>
                  <div style={{ fontSize: '0.8125rem' }}>
                    Velikost: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="vtf-btn vtf-btn-primary"
              style={{ flex: 1, padding: '0.875rem 1.5rem', fontSize: '1rem' }}
            >
              {isUploading ? (
                <>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid white', 
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></div>
                  Nahrávám...
                </>
              ) : (
                <>⬆️ Nahrát</>
              )}
            </button>
            
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="vtf-btn vtf-btn-secondary"
                style={{ padding: '0.875rem 1.5rem' }}
              >
                ← Zpět
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
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
            Generování Symbolů
          </h2>
        </div>
        
        <div className="vtf-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="vtf-spinner" style={{ margin: '0 auto' }}></div>
          </div>
          
          <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-slate-700)', marginBottom: '1.5rem' }}>
            {symbolStatus}
          </p>
          
          <div className="vtf-alert vtf-alert-info">
            <span className="vtf-alert-icon">⏱️</span>
            <div className="vtf-alert-content">
              <div className="vtf-alert-description">
                Generování ISF symbolů může trvat několik minut...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hlavní konfigurace - výběr OS a další kroky
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '64px', 
          height: '64px',
          background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-primary-500))',
          borderRadius: 'var(--radius-xl)',
          fontSize: '2rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-lg)'
        }}>
          ⚙️
        </div>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
          Konfigurace Projektu
        </h2>
      </div>
      
      <div className="vtf-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Info o nahraném souboru */}
          <div style={{ padding: '1.25rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-slate-200)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-slate-900)' }}>
              ✓ Nahraný soubor
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--color-slate-700)' }}>
              <p><span style={{ fontWeight: 500 }}>Název:</span> {uploadResponse.filename}</p>
              <p><span style={{ fontWeight: 500 }}>Velikost:</span> {(uploadResponse.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>

          {/* Výběr OS */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-700)' }}>
              Operační systém
            </label>
            <select
              value={selectedOS}
              onChange={async (e) => {
                const newOS = e.target.value as 'windows' | 'linux';
                setSelectedOS(newOS);
                
                if (uploadResponse) {
                  try {
                    const { updateProject } = await import('../api/vtfApi');
                    await updateProject(uploadResponse.analysis_id, { osType: newOS });
                  } catch (error) {
                    console.error('Nepodařilo se aktualizovat OS:', error);
                  }
                }
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid var(--color-slate-300)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9375rem',
                background: 'white'
              }}
            >
              <option value="windows">🪟 Windows</option>
              <option value="linux">🐧 Linux</option>
            </select>
            <p style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
              OS se automaticky uloží do projektu
            </p>
          </div>

          {/* Tlačítko pro detekci OS */}
          <div>
            <button
              onClick={handleDetectOS}
              disabled={isDetecting}
              className="vtf-btn vtf-btn-accent"
              style={{ width: '100%', padding: '0.875rem 1.5rem', fontSize: '1rem' }}
            >
              {isDetecting ? (
                <>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid white', 
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></div>
                  Detekovám...
                </>
              ) : (
                <>🔍 Spustit Banners Plugin</>
              )}
            </button>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-slate-500)', textAlign: 'center' }}>
              Použije Volatility plugin pro automatickou detekci OS
            </p>
          </div>

          {/* Výsledky detekce */}
          {detectionResult && (
            <div className={`vtf-alert ${detectionResult.success ? 'vtf-alert-success' : 'vtf-alert-warning'}`}>
              <span className="vtf-alert-icon">{detectionResult.success ? '✅' : '⚠️'}</span>
              <div className="vtf-alert-content">
                <div className="vtf-alert-title">
                  {detectionResult.success ? 'Detekce úspěšná' : 'Detekce selhala'}
                </div>
                
                {detectionResult.success ? (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <p><span style={{ fontWeight: 500 }}>OS:</span> {detectionResult.os_type}</p>
                    {detectionResult.kernel_version && (
                      <p><span style={{ fontWeight: 500 }}>Kernel:</span> {detectionResult.kernel_version}</p>
                    )}
                    {detectionResult.architecture && (
                      <p><span style={{ fontWeight: 500 }}>Architektura:</span> {detectionResult.architecture}</p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{detectionResult.error}</p>
                )}

                {detectionResult.banners_output && detectionResult.banners_output.length > 0 && (
                  <details style={{ marginTop: '0.75rem' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-slate-700)' }}>
                      Zobrazit výstup z Banners plugin
                    </summary>
                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', maxHeight: '160px', overflowY: 'auto' }}>
                      <pre style={{ fontSize: '0.75rem', color: 'var(--color-slate-800)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                        {detectionResult.banners_output.map((item, idx) => (
                          <div key={idx}>{item.Banner}</div>
                        ))}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Linux workflow - upload vmlinux */}
          {selectedOS === 'linux' && (
            <div className="vtf-alert vtf-alert-info">
              <span className="vtf-alert-icon">⚙️</span>
              <div className="vtf-alert-content">
                <div className="vtf-alert-title">Linux - Symboly</div>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                  Pro analýzu Linux dumpů jsou potřeba ISF symbol soubory. Nahrajte vmlinux soubor pro automatické generování symbolů.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-slate-700)' }}>
                      Nahrát vmlinux soubor
                    </label>
                    <input
                      type="file"
                      onChange={handleVmlinuxChange}
                      style={{
                        display: 'block',
                        width: '100%',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-slate-300)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: 'white',
                        padding: '0.5rem'
                      }}
                    />
                  </div>
                  
                  <button
                    onClick={handleVmlinuxUpload}
                    disabled={!vmlinuxFile}
                    className="vtf-btn vtf-btn-primary"
                    style={{ fontSize: '0.875rem' }}
                  >
                    Nahrát vmlinux a generovat symboly
                  </button>
                  
                  <button
                    onClick={handleLinuxContinueWithoutSymbols}
                    className="vtf-btn vtf-btn-secondary"
                    style={{ fontSize: '0.875rem' }}
                  >
                    Pokračovat bez symbolů (omezená funkcionalita)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Windows workflow - pokračovat */}
          {selectedOS === 'windows' && (
            <div className="vtf-alert vtf-alert-success">
              <span className="vtf-alert-icon">✅</span>
              <div className="vtf-alert-content">
                <div className="vtf-alert-title">Windows</div>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                  Windows dumpy nepotřebují dodatečné symboly. Můžete pokračovat k analýze.
                </p>
                
                <button
                  onClick={handleContinue}
                  className="vtf-btn vtf-btn-primary"
                  style={{ fontSize: '0.875rem' }}
                >
                  Pokračovat k analýze →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
