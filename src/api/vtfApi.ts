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
  project_name?: string;
  os_type?: string;
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
  status: 'running' | 'completed';
}

export interface StatusResponse {
  plugin: string;
  status: 'completed' | 'not_started' | 'running' | 'failed';
  error?: string;
  started_at?: string;
  exit_code?: number;
  failed_at?: string;
}

export interface AllStatusResponse {
  analysis_id: string;
  plugins: {
    [pluginName: string]: 'completed' | 'not_started' | 'running' | 'failed';
  };
}

export interface ResultRow {
  [key: string]: any;
}

export interface PresetInfo {
  description: string;
  plugins: string[];
}

export interface PresetsResponse {
  presets: { [name: string]: PresetInfo };
  filtered_by_os?: string;
}

export interface BatchAnalysisResponse {
  message: string;
  analysis_id: string;
  started: string[];
  skipped: Array<{ plugin: string; reason: string }>;
}

export interface CorrelationResponse {
  pid: number;
  data: {
    [label: string]: {
      plugin: string;
      count: number;
      rows: ResultRow[];
    };
  };
}

/**
 * Nahraje soubor na backend a vrátí analysis_id
 */
export async function uploadFile(file: File, projectName?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (projectName) {
    formData.append('project_name', projectName);
  }

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
 * Aktualizuje název projektu a/nebo OS typu
 */
export async function updateProject(
  analysisId: string, 
  updates: { projectName?: string; osType?: string }
): Promise<void> {
  const payload: { project_name?: string; os_type?: string } = {};
  if (updates.projectName !== undefined) {
    payload.project_name = updates.projectName;
  }
  if (updates.osType !== undefined) {
    payload.os_type = updates.osType;
  }
  await axios.patch(
    `${API_BASE_URL}/api/v1/uploads/${analysisId}`,
    payload
  );
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
export async function runAnalysis(analysisId: string, plugin: string, force: boolean = false): Promise<RunAnalysisResponse> {
  const response = await axios.post<RunAnalysisResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/run`,
    { plugin, force }
  );

  return response.data;
}

/**
 * Spustí batch analýzu pro více pluginů najednou
 */
export async function runBatchAnalysis(
  analysisId: string,
  plugins: string[],
  force: boolean = false
): Promise<BatchAnalysisResponse> {
  const response = await axios.post<BatchAnalysisResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/run-batch`,
    { plugins, force }
  );
  return response.data;
}

/**
 * Získá dostupné plugin presety
 */
export async function getPluginPresets(osType?: string): Promise<PresetsResponse> {
  const params = osType ? `?os_type=${osType}` : '';
  const response = await axios.get<PresetsResponse>(
    `${API_BASE_URL}/api/v1/plugins/presets${params}`
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

/**
 * Exportuje výsledky pluginu jako soubor ke stažení
 */
export function getExportUrl(analysisId: string, plugin: string, format: 'json' | 'csv' = 'json'): string {
  return `${API_BASE_URL}/api/v1/analysis/${analysisId}/export/${encodeURIComponent(plugin)}?format=${format}`;
}

/**
 * Cross-plugin korelace podle PID
 */
export async function correlateByPid(analysisId: string, pid: number): Promise<CorrelationResponse> {
  const response = await axios.get<CorrelationResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/correlate/${pid}`
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

// ========== IOC Scanner API ==========

export interface IOCList {
  ips: string[];
  domains: string[];
  hashes: string[];
  filenames: string[];
  process_names: string[];
  registry_keys: string[];
  custom_patterns: string[];
}

export interface IOCMatch {
  ioc_type: string;
  ioc_value: string;
  plugin: string;
  field: string;
  row_index: number;
  row_data: Record<string, any>;
}

export interface IOCScanResponse {
  total_matches: number;
  matches_by_type: Record<string, number>;
  matches: IOCMatch[];
}

export async function scanIOCs(analysisId: string, iocList: IOCList): Promise<IOCScanResponse> {
  const response = await axios.post<IOCScanResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/ioc-scan`,
    iocList
  );
  return response.data;
}

export async function saveIOCList(analysisId: string, iocList: IOCList): Promise<void> {
  await axios.post(`${API_BASE_URL}/api/v1/analysis/${analysisId}/ioc-list`, iocList);
}

export async function getIOCList(analysisId: string): Promise<IOCList> {
  const response = await axios.get<IOCList>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/ioc-list`
  );
  return response.data;
}

// ========== Annotations API ==========

export interface Annotation {
  plugin: string;
  row_index: number;
  tag: string;
  note?: string;
  created_at?: string;
}

export interface AnnotationsResponse {
  analysis_id: string;
  annotations: Annotation[];
  total: number;
}

export async function getAnnotations(analysisId: string, plugin?: string): Promise<AnnotationsResponse> {
  const params = plugin ? `?plugin=${encodeURIComponent(plugin)}` : '';
  const response = await axios.get<AnnotationsResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/annotations${params}`
  );
  return response.data;
}

export async function addAnnotation(
  analysisId: string,
  annotation: { plugin: string; row_index: number; tag: string; note?: string }
): Promise<void> {
  await axios.post(`${API_BASE_URL}/api/v1/analysis/${analysisId}/annotations`, annotation);
}

export async function deleteAnnotation(analysisId: string, plugin: string, rowIndex: number): Promise<void> {
  await axios.delete(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/annotations?plugin=${encodeURIComponent(plugin)}&row_index=${rowIndex}`
  );
}

// ========== Dashboard API ==========

export interface DashboardData {
  analysis_id: string;
  project_name: string;
  os_type?: string;
  kernel_version?: string;
  dump_size_mb: number;
  completed_plugins: string[];
  failed_plugins: string[];
  summary: {
    total_processes?: number;
    unique_process_names?: number;
    top_processes?: Array<[string, number]>;
    total_connections?: number;
    unique_foreign_addresses?: number;
    foreign_addresses?: string[];
    malfind_detections?: number;
    suspicious_process_count?: number;
    total_files_in_memory?: number;
    annotations?: {
      total: number;
      by_tag: Record<string, number>;
    };
  };
}

export async function getDashboard(analysisId: string): Promise<DashboardData> {
  const response = await axios.get<DashboardData>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/dashboard`
  );
  return response.data;
}

// ========== Investigation / PID Watchlist API ==========

export interface TrackedProcess {
  pid: number;
  process_name: string;
  ppid?: number;
  reason: string;
  tags: string[];
  source_plugin: string;
  notes: string;
  added_at?: string;
}

export interface TrackedPidsResponse {
  analysis_id: string;
  tracked_pids: TrackedProcess[];
  total: number;
}

export interface ProcessTreeResponse {
  source: string;
  tree: ProcessTreeNode[];
}

export interface ProcessTreeNode {
  PID?: number;
  Pid?: number;
  PPID?: number;
  PPid?: number;
  ImageFileName?: string;
  COMM?: string;
  Name?: string;
  CreateTime?: string;
  ExitTime?: string;
  Threads?: number;
  Handles?: number;
  SessionId?: number;
  Wow64?: boolean;
  Path?: string;
  Cmd?: string;
  Audit?: string;
  __children?: ProcessTreeNode[];
  _tracked?: TrackedProcess;
  [key: string]: any;
}

export interface ProcessTimelineEntry {
  pid: number;
  ppid: number;
  name: string;
  create_time: string | null;
  exit_time: string | null;
  is_tracked: boolean;
  tracked_info: TrackedProcess | null;
  has_malfind: boolean;
}

export interface ProcessTimelineResponse {
  analysis_id: string;
  processes: ProcessTimelineEntry[];
  total: number;
  tracked_count: number;
  malfind_count: number;
}

export interface RegistryHive {
  offset: number;
  file_path: string;
  short_name: string;
}

export interface RegistryKeysResponse {
  key_path: string | null;
  hive_offset: number | null;
  keys: any[];
  values: any[];
  total_keys: number;
  total_values: number;
}

export interface InvestigationSummary {
  analysis_id: string;
  tracked_pids: TrackedProcess[];
  tracked_count: number;
  completed_plugins: string[];
  pid_results: Record<string, any>;
  suggestions: string[];
}

// ── Tracked PIDs ──

export async function getTrackedPids(analysisId: string, tag?: string): Promise<TrackedPidsResponse> {
  const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  const response = await axios.get<TrackedPidsResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/tracked-pids${params}`
  );
  return response.data;
}

export async function trackPid(
  analysisId: string,
  data: {
    pid: number;
    process_name?: string;
    ppid?: number;
    reason?: string;
    tags?: string[];
    source_plugin?: string;
    notes?: string;
  }
): Promise<{ message: string; tracked_process: TrackedProcess }> {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/tracked-pids`,
    data
  );
  return response.data;
}

export async function updateTrackedPid(
  analysisId: string,
  pid: number,
  updates: { reason?: string; tags?: string[]; notes?: string }
): Promise<{ message: string; tracked_process: TrackedProcess }> {
  const response = await axios.patch(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/tracked-pids/${pid}`,
    updates
  );
  return response.data;
}

export async function untrackPid(analysisId: string, pid: number): Promise<void> {
  await axios.delete(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/tracked-pids/${pid}`
  );
}

// ── Process Tree & Timeline ──

export async function getProcessTree(analysisId: string): Promise<ProcessTreeResponse> {
  const response = await axios.get<ProcessTreeResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/process-tree`
  );
  return response.data;
}

export async function getProcessTimeline(analysisId: string): Promise<ProcessTimelineResponse> {
  const response = await axios.get<ProcessTimelineResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/process-timeline`
  );
  return response.data;
}

// ── Registry Browser ──

export async function getRegistryHives(analysisId: string): Promise<{ hives: RegistryHive[] }> {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/registry/hives`
  );
  return response.data;
}

export async function getRegistryKeys(
  analysisId: string,
  hiveOffset?: number,
  keyPath?: string
): Promise<RegistryKeysResponse> {
  const params = new URLSearchParams();
  if (hiveOffset !== undefined) params.set('hive_offset', String(hiveOffset));
  if (keyPath !== undefined) params.set('key_path', keyPath);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await axios.get<RegistryKeysResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/registry/keys${qs}`
  );
  return response.data;
}

// ── Investigation Summary ──

export async function getInvestigationSummary(analysisId: string): Promise<InvestigationSummary> {
  const response = await axios.get<InvestigationSummary>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/investigation-summary`
  );
  return response.data;
}

// ── Per-PID Plugin Execution ──

export async function runAnalysisForPid(
  analysisId: string,
  plugin: string,
  pid: number,
  force: boolean = false
): Promise<RunAnalysisResponse> {
  const response = await axios.post<RunAnalysisResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/run`,
    { plugin, force, pid }
  );
  return response.data;
}

export async function getPluginResultsForPid(
  analysisId: string,
  plugin: string,
  pid: number
): Promise<ResultRow[]> {
  const response = await axios.get<ResultRow[]>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/results/${encodeURIComponent(plugin)}?pid=${pid}`
  );
  return response.data;
}

export async function checkPluginStatusForPid(
  analysisId: string,
  plugin: string,
  pid: number
): Promise<StatusResponse> {
  const response = await axios.get<StatusResponse>(
    `${API_BASE_URL}/api/v1/analysis/${analysisId}/status?plugin=${encodeURIComponent(plugin)}&pid=${pid}`
  );
  return response.data;
}
