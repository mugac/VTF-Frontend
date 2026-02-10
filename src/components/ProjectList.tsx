import type { ProjectInfo } from '../api/vtfApi';

interface ProjectListProps {
  projects: ProjectInfo[];
  onProjectSelect: (analysisId: string) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
}

export default function ProjectList({ 
  projects, 
  onProjectSelect, 
  onCreateNew,
  isLoading = false 
}: ProjectListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('cs-CZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getOSIcon = (osType?: string): string => {
    if (osType === 'windows') return '🪟';
    if (osType === 'linux') return '🐧';
    return '💾';
  };

  return (
    <div className="vtf-content-wide">
      {/* Hero Section */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '80px', 
          height: '80px',
          background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500))',
          borderRadius: 'var(--radius-xl)',
          fontSize: '2.5rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-xl)'
        }}>
          🔍
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-slate-900)' }}>
          Volatility Forensics Platform
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--color-slate-600)', maxWidth: '600px', margin: '0 auto' }}>
          Profesionální nástroj pro forensickou analýzu memory dumpů
        </p>
      </div>

      {/* Create New Project Button */}
      <button
        onClick={onCreateNew}
        className="vtf-btn vtf-btn-primary"
        disabled={isLoading}
        style={{ 
          width: '100%', 
          padding: '1.25rem 1.5rem',
          fontSize: '1rem',
          marginBottom: '3rem',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>+</span>
        <span>Vytvořit nový projekt</span>
      </button>

      {/* Projects List */}
      {isLoading ? (
        <div className="vtf-loading" style={{ minHeight: '300px' }}>
          <div className="vtf-spinner"></div>
          <p style={{ color: 'var(--color-slate-600)', marginTop: '1rem' }}>Načítám projekty...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="vtf-empty-state">
          <div className="vtf-empty-state-icon">📁</div>
          <h3 className="vtf-empty-state-title">Zatím žádné projekty</h3>
          <p className="vtf-empty-state-description">
            Vytvořte nový projekt nahráním memory dump souboru
          </p>
        </div>
      ) : (
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid var(--color-slate-200)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-slate-900)' }}>
              Moje projekty
            </h2>
            <span className="vtf-badge vtf-badge-slate" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              {projects.length} {projects.length === 1 ? 'projekt' : projects.length < 5 ? 'projekty' : 'projektů'}
            </span>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {projects.map(project => (
              <div
                key={project.analysis_id}
                onClick={() => onProjectSelect(project.analysis_id)}
                className="vtf-card"
                style={{ 
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition-base)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px',
                    background: project.os_type === 'windows' 
                      ? 'linear-gradient(135deg, #3b82f6, #2563eb)' 
                      : project.os_type === 'linux'
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #64748b, #475569)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    boxShadow: 'var(--shadow-md)'
                  }}>
                    {getOSIcon(project.os_type)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'flex-end' }}>
                    {project.os_type && (
                      <span className={`vtf-badge ${
                        project.os_type === 'windows' ? 'vtf-badge-primary' :
                        project.os_type === 'linux' ? 'vtf-badge-success' : 'vtf-badge-slate'
                      }`}>
                        {project.os_type.toUpperCase()}
                      </span>
                    )}
                    <span className="vtf-badge vtf-badge-slate" style={{ fontSize: '0.6875rem' }}>
                      {formatFileSize(project.size_bytes)}
                    </span>
                  </div>
                </div>
                
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: 600, 
                  marginBottom: '0.5rem',
                  color: 'var(--color-slate-900)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={project.project_name || project.filename}>
                  {project.project_name || project.filename}
                </h3>
                
                {project.project_name && project.project_name !== project.filename && (
                  <p style={{ 
                    fontSize: '0.8125rem',
                    color: 'var(--color-slate-500)',
                    marginBottom: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={project.filename}>
                    {project.filename}
                  </p>
                )}
                
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
                  {formatDate(project.uploaded_at)}
                </p>
                
                <div style={{ 
                  paddingTop: '1rem', 
                  borderTop: '1px solid var(--color-slate-200)'
                }}>
                  <p style={{ 
                    fontSize: '0.75rem',
                    color: 'var(--color-slate-400)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={project.analysis_id}>
                    ID: {project.analysis_id.substring(0, 20)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
