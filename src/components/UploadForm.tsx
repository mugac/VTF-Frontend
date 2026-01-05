import { useState, FormEvent } from 'react';

interface UploadFormProps {
  onUploadSuccess: (analysisId: string) => void;
  onError: (error: string) => void;
  onBack?: () => void;
}

export default function UploadForm({ onUploadSuccess, onError, onBack }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
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
      const response = await uploadFile(selectedFile);
      onUploadSuccess(response.analysis_id);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Nepodařilo se nahrát soubor');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ← Zpět na projekty
        </button>
      )}
      
      <h2 className="text-3xl font-bold mb-6 text-center">
        Nový projekt - Nahrát memory dump
      </h2>
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-4">
          <label 
            htmlFor="file-upload" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Vyberte memory dump soubor
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 p-2"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Vybraný soubor: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {isUploading ? 'Nahrávám...' : 'Nahrát a analyzovat'}
        </button>
      </form>
    </div>
  );
}
