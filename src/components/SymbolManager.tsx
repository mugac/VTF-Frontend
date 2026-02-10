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
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
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
        <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
          Správa symbolů
        </h2>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '1rem' }}>
          Správa ISF symbol souborů pro analýzu Linux memory dumpů
        </p>
      </div>

      {error && (
        <div className="vtf-alert vtf-alert-danger" style={{ marginBottom: '1.5rem' }}>
          <span className="vtf-alert-icon">⚠️</span>
          <div className="vtf-alert-content">
            <div className="vtf-alert-title">Chyba</div>
            <div className="vtf-alert-description">{error}</div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="vtf-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-slate-900)' }}>
          Nahrát ISF symbol file
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginBottom: '1.5rem' }}>
          Pokud již máte vygenerovaný ISF soubor, můžete ho nahrát přímo zde.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-700)' }}>
              ISF soubor (.json)
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              disabled={isUploading}
              style={{
                display: 'block',
                width: '100%',
                fontSize: '0.875rem',
                border: '1px solid var(--color-slate-300)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: 'white',
                padding: '0.625rem'
              }}
            />
            {uploadFile && (
              <div className="vtf-alert vtf-alert-info" style={{ marginTop: '0.75rem' }}>
                <span className="vtf-alert-icon">📄</span>
                <div className="vtf-alert-content" style={{ fontSize: '0.8125rem' }}>
                  {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-slate-700)' }}>
              Kernel verze (volitelné)
            </label>
            <input
              type="text"
              value={kernelVersion}
              onChange={(e) => setKernelVersion(e.target.value)}
              placeholder="např. 5.15.0-76-generic"
              disabled={isUploading}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.625rem 1rem',
                border: '1px solid var(--color-slate-300)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9375rem'
              }}
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!uploadFile || isUploading}
          className="vtf-btn vtf-btn-primary"
          style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
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
            <>⬆️ Nahrát ISF</>
          )}
        </button>
      </div>

      {/* Symbols List */}
      <div className="vtf-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-slate-900)' }}>
            Dostupné symboly
          </h3>
          <span className="vtf-badge vtf-badge-slate" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            {symbols.length} {symbols.length === 1 ? 'symbol' : symbols.length < 5 ? 'symboly' : 'symbolů'}
          </span>
        </div>

        {isLoading ? (
          <div className="vtf-loading" style={{ minHeight: '300px' }}>
            <div className="vtf-spinner"></div>
            <p style={{ color: 'var(--color-slate-600)', marginTop: '1rem' }}>Načítám symboly...</p>
          </div>
        ) : symbols.length === 0 ? (
          <div className="vtf-empty-state">
            <div className="vtf-empty-state-icon">⚙️</div>
            <h3 className="vtf-empty-state-title">Žádné symboly nenalezeny</h3>
            <p className="vtf-empty-state-description">
              Nahrajte vmlinux při uploadu Linux dumpu nebo nahrajte ISF soubor výše.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-slate-50)', borderBottom: '2px solid var(--color-slate-200)' }}>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Symbol ID
                  </th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Kernel Verze
                  </th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Velikost
                  </th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Vytvořeno
                  </th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody>
                {symbols.map((symbol) => (
                  <tr key={symbol.symbol_id} style={{ 
                    borderBottom: '1px solid var(--color-slate-200)',
                    transition: 'background var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-slate-50)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--color-slate-900)' }}>
                      <span className="vtf-badge vtf-badge-slate" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {symbol.symbol_id.substring(0, 16)}...
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--color-slate-900)' }}>
                      {symbol.kernel_version || <span style={{ color: 'var(--color-slate-400)' }}>N/A</span>}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--color-slate-900)' }}>
                      <span className="vtf-badge vtf-badge-primary" style={{ fontSize: '0.75rem' }}>
                        {symbol.size_mb.toFixed(2)} MB
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--color-slate-600)' }}>
                      {new Date(symbol.created_at).toLocaleString('cs-CZ', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>
                      <button
                        onClick={() => handleDelete(symbol.symbol_id)}
                        className="vtf-btn"
                        style={{ 
                          padding: '0.375rem 0.875rem',
                          fontSize: '0.8125rem',
                          background: 'var(--color-danger)',
                          color: 'white'
                        }}
                      >
                        🗑️ Smazat
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
