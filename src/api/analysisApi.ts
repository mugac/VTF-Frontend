import axios from 'axios';

// Nastavení základní URL našeho backendu
const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Nahrává soubor s memory dumpem na server.
 * @param file Soubor k nahrání
 * @param onUploadProgress Callback pro sledování průběhu nahrávání
 * @returns Promise s odpovědí serveru, která obsahuje analysis_id
 */
export const uploadMemoryDump = (file: File, onUploadProgress: (progressEvent: any) => void) => {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
};

/**
 * Zjišťuje stav analýzy na serveru.
 * @param analysisId ID analýzy
 * @returns Promise s odpovědí obsahující stav
 */
export const getAnalysisStatus = (analysisId: string) => {
  return apiClient.get(`/status/${analysisId}`);
};

/**
 * Získává finální výsledky analýzy.
 * @param analysisId ID analýzy
 * @returns Promise s výsledky ve formátu JSON
 */
export const getAnalysisResults = (analysisId: string) => {
  return apiClient.get(`/results/${analysisId}`);
};