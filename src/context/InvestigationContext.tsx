import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { TrackedProcess } from '../api/vtfApi';
import { getTrackedPids, trackPid, untrackPid, updateTrackedPid } from '../api/vtfApi';

interface InvestigationContextType {
  // State
  trackedPids: TrackedProcess[];
  isLoading: boolean;
  
  // Actions
  refreshTrackedPids: () => Promise<void>;
  addTrackedPid: (data: {
    pid: number;
    process_name?: string;
    ppid?: number;
    reason?: string;
    tags?: string[];
    source_plugin?: string;
    notes?: string;
  }) => Promise<void>;
  removeTrackedPid: (pid: number) => Promise<void>;
  updatePid: (pid: number, updates: { reason?: string; tags?: string[]; notes?: string }) => Promise<void>;
  isTracked: (pid: number) => boolean;
  getTrackedInfo: (pid: number) => TrackedProcess | undefined;
  
  // Analysis context
  analysisId: string | null;
  setAnalysisId: (id: string | null) => void;
}

const InvestigationContext = createContext<InvestigationContextType | null>(null);

export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [trackedPids, setTrackedPids] = useState<TrackedProcess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const refreshTrackedPids = useCallback(async () => {
    if (!analysisId) return;
    setIsLoading(true);
    try {
      const response = await getTrackedPids(analysisId);
      setTrackedPids(response.tracked_pids);
    } catch {
      // Keep current list on error
    } finally {
      setIsLoading(false);
    }
  }, [analysisId]);

  // Load tracked PIDs when analysis changes
  useEffect(() => {
    if (analysisId) {
      refreshTrackedPids();
    } else {
      setTrackedPids([]);
    }
  }, [analysisId, refreshTrackedPids]);

  const addTrackedPid = useCallback(async (data: {
    pid: number;
    process_name?: string;
    ppid?: number;
    reason?: string;
    tags?: string[];
    source_plugin?: string;
    notes?: string;
  }) => {
    if (!analysisId) return;
    await trackPid(analysisId, data);
    await refreshTrackedPids();
  }, [analysisId, refreshTrackedPids]);

  const removeTrackedPid = useCallback(async (pid: number) => {
    if (!analysisId) return;
    await untrackPid(analysisId, pid);
    await refreshTrackedPids();
  }, [analysisId, refreshTrackedPids]);

  const updatePidFn = useCallback(async (pid: number, updates: { reason?: string; tags?: string[]; notes?: string }) => {
    if (!analysisId) return;
    await updateTrackedPid(analysisId, pid, updates);
    await refreshTrackedPids();
  }, [analysisId, refreshTrackedPids]);

  const isTracked = useCallback((pid: number) => {
    return trackedPids.some(t => t.pid === pid);
  }, [trackedPids]);

  const getTrackedInfo = useCallback((pid: number) => {
    return trackedPids.find(t => t.pid === pid);
  }, [trackedPids]);

  return (
    <InvestigationContext.Provider value={{
      trackedPids,
      isLoading,
      refreshTrackedPids,
      addTrackedPid,
      removeTrackedPid,
      updatePid: updatePidFn,
      isTracked,
      getTrackedInfo,
      analysisId,
      setAnalysisId,
    }}>
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigation(): InvestigationContextType {
  const context = useContext(InvestigationContext);
  if (!context) {
    throw new Error('useInvestigation must be used within InvestigationProvider');
  }
  return context;
}
