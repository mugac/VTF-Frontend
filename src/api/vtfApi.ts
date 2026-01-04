import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface UploadResponse {
  analysis_id: string;
}

export interface StatusResponse {
  status: 'in_progress' | 'completed';
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
 * Zkontroluje stav analýzy
 */
export async function checkStatus(analysisId: string): Promise<StatusResponse> {
  const response = await axios.get<StatusResponse>(
    `${API_BASE_URL}/api/v1/status/${analysisId}`
  );

  return response.data;
}

/**
 * Stáhne výsledky analýzy
 */
export async function getResults(analysisId: string): Promise<ResultRow[]> {
  console.log('Volám API pro výsledky:', `${API_BASE_URL}/api/v1/results/${analysisId}`);
  
  const response = await axios.get<ResultRow[]>(
    `${API_BASE_URL}/api/v1/results/${analysisId}`
  );

  console.log('Response status:', response.status);
  console.log('Response data:', response.data);
  console.log('Je pole?', Array.isArray(response.data));
  
  return response.data;
}
