import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface UploadResponse {
  message: string;
  analysis_id: string;
  filename: string;
  size_bytes: number;
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
}

export interface PluginsResponse {
  plugins: PluginInfo[];
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
