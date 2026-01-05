import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export interface UploadResponse {
  message: string;
  analysis_id: string;
  filename: string;
  size_bytes: number;
}

export interface DetectOSResponse {
  success: boolean;
  os_type?: string;
  kernel_version?: string;
  architecture?: string;
  banners_output?: Array<{Banner: string}>;
  error?: string;
}

export interface ProjectInfo {
  analysis_id: string;
  filename: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface PluginInfo {
  name: string;
  category: string;
  description: string;
  supported_os: string[];
}

export interface PluginsResponse {
  plugins: PluginInfo[];
  filtered_by_os?: string;
  categories: string[];
}

export interface RunAnalysisResponse {
  message: string;
  analysis_id: string;
  plugin: string;
  status: 'in_progress' | 'completed';
}

export interface StatusResponse {
  plugin: string;
  status: 'completed' | 'not_started';
}

export interface AllStatusResponse {
  analysis_id: string;
  plugins: {
    [pluginName: string]: 'completed' | 'not_started';
  };
}

export interface ResultRow {
  [key: string]: any;
}

/**
 * Nahraje soubor na backend a vrátí analysis_id
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post<UploadResponse>(
    `${API_BASE_URL}/api/v1/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

/**
 * Spustí banners plugin pro detekci OS
 */
export async function detectOS(analysisId: string): Promise<DetectOSResponse> {
  const response = await axios.post<DetectOSResponse>(
    `${API_BASE_URL}/api/v1/detect-os/${analysisId}`
  );
  return response.data;
}

/**
 * Získá seznam dostupných pluginů
 */
export async function getPlugins(): Promise<PluginsResponse> {
  const response = await axios.get<PluginsResponse>(
    `${API_BASE_URL}/api/v1/plugins`
  );

  return response.data;
}

/**
 * Spustí analýzu s vybraným pluginem
 */
export async function runAnalysis(analysisId: string, plugin: string): Promise<RunAnalysisResponse> {
  const response = await axios.post<RunAnalysisResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/run`,
    { plugin }
  );

  return response.data;
}

/**
 * Zkontroluje stav analýzy pro konkrétní plugin
 */
export async function checkPluginStatus(analysisId: string, plugin: string): Promise<StatusResponse> {
  const response = await axios.get<StatusResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/status?plugin=${encodeURIComponent(plugin)}`
  );

  return response.data;
}

/**
 * Zkontroluje stav všech pluginů pro danou analýzu
 */
export async function checkAllStatus(analysisId: string): Promise<AllStatusResponse> {
  const response = await axios.get<AllStatusResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/status`
  );

  return response.data;
}

/**
 * Stáhne výsledky analýzy pro konkrétní plugin
 */
export async function getPluginResults(analysisId: string, plugin: string): Promise<ResultRow[]> {
  const response = await axios.get<ResultRow[]>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/results/${encodeURIComponent(plugin)}`
  );
  
  return response.data;
}

/**
 * Získá seznam všech projektů (nahraných memory dumpů)
 */
export async function getProjects(): Promise<ProjectInfo[]> {
  const response = await axios.get<ProjectInfo[]>(
    `${API_BASE_URL}/api/v1/uploads`
  );

  return response.data;
}

/**
 * Získá detail projektu
 */
export async function getProjectInfo(analysisId: string): Promise<any> {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/uploads/${analysisId}`
  );

  return response.data;
}

// ========== Symbol Management API ==========

export interface SymbolJob {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  vmlinux_hash?: string;
  kernel_version?: string;
  created_at: string;
  completed_at?: string;
  error?: string;
  isf_size_bytes?: number;
  duration_seconds?: number;
}

export interface SymbolInfo {
  symbol_id: string;
  kernel_version?: string;
  size_bytes: number;
  size_mb: number;
  created_at: string;
  file_path: string;
}

/**
 * Upload vmlinux file for ISF generation
 */
export async function uploadVmlinux(
  vmlinuxFile: File,
  systemMapFile?: File,
  kernelVersion?: string
): Promise<SymbolJob> {
  const formData = new FormData();
  formData.append('vmlinux', vmlinuxFile);
  if (systemMapFile) {
    formData.append('system_map', systemMapFile);
  }
  if (kernelVersion) {
    formData.append('kernel_version', kernelVersion);
  }

  const response = await axios.post<SymbolJob>(
    `${API_BASE_URL}/api/v1/symbols/upload-vmlinux`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

/**
 * Check symbol generation job status
 */
export async function getSymbolJobStatus(jobId: string): Promise<SymbolJob> {
  const response = await axios.get<SymbolJob>(
    `${API_BASE_URL}/api/v1/symbols/job/${jobId}`
  );

  return response.data;
}

/**
 * List available symbol files
 */
export async function getSymbols(): Promise<SymbolInfo[]> {
  const response = await axios.get<SymbolInfo[]>(
    `${API_BASE_URL}/api/v1/symbols/`
  );

  return response.data;
}

/**
 * Upload pre-generated ISF file
 */
export async function uploadISF(
  isfFile: File,
  kernelVersion?: string
): Promise<{ success: boolean; symbol_id: string; size_mb: number }> {
  const formData = new FormData();
  formData.append('isf_file', isfFile);
  if (kernelVersion) {
    formData.append('kernel_version', kernelVersion);
  }

  const response = await axios.post(
    `${API_BASE_URL}/api/v1/symbols/upload-isf`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

/**
 * Delete symbol file
 */
export async function deleteSymbol(symbolId: string): Promise<{ success: boolean; message: string }> {
  const response = await axios.delete(
    `${API_BASE_URL}/api/v1/symbols/${symbolId}`
  );

  return response.data;
}
