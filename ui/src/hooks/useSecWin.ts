import { useState, useEffect, useCallback } from 'react';
import { api, type Playbook, type PlaybookResult, type Profile, type ToolManifest, type Finding, type SystemStatus, type EvidenceArtifact, type AI_TriageResult } from '../api/tauri';

export function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listPlaybooks();
      setPlaybooks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { playbooks, loading, error, reload: load };
}

export function usePlaybook(name: string) {
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const pb = await api.loadPlaybook(name);
      setPlaybook(pb);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load playbook');
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    load();
  }, [load]);

  return { playbook, loading, error, reload: load };
}

export function useRunPlaybook() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlaybookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; output: string } | null>(null);

  const run = useCallback(async (playbook: Playbook, variables: Record<string, unknown>) => {
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ step: 'Initializing...', output: '' });
    try {
      const res = await api.runPlaybook(playbook, variables);
      setResult(res);
      return res;
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Playbook execution failed';
      setError(err);
      throw e;
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, []);

  return { run, running, result, error, progress };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listProfiles();
      setProfiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const status = await api.getProfileStatus();
      setProfiles(status.profiles);
      setActiveProfile(status.active);
    } catch (e) {
      console.error('Failed to load profile status:', e);
    }
  }, []);

  useEffect(() => {
    load();
    loadStatus();
  }, [load, loadStatus]);

  const create = useCallback(async (profile: Profile) => {
    await api.createProfile(profile);
    await load();
  }, [load]);

  const engage = useCallback(async (name: string) => {
    await api.engageProfile(name);
    await loadStatus();
  }, [loadStatus]);

  const disengage = useCallback(async () => {
    await api.disengageProfile();
    await loadStatus();
  }, [loadStatus]);

  const remove = useCallback(async (name: string) => {
    await api.deleteProfile(name);
    await load();
  }, [load]);

  return { profiles, activeProfile, loading, error, create, engage, disengage, remove, reload: load };
}

export function useTools() {
  const [tools, setTools] = useState<ToolManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listTools();
      setTools(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await api.searchTools(query);
      setTools(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const install = useCallback(async (name: string) => {
    await api.installTool(name);
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { tools, loading, error, search, install, reload: load };
}

export function useEvidence(dir?: string) {
  const [artifacts, setArtifacts] = useState<EvidenceArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listEvidence(dir);
      setArtifacts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evidence');
    } finally {
      setLoading(false);
    }
  }, [dir]);

  const verify = useCallback(async () => {
    return api.verifyEvidence(dir);
  }, [dir]);

  const exportManifest = useCallback(async (format: 'json' | 'yaml' = 'json') => {
    return api.exportEvidenceManifest(dir, format);
  }, [dir]);

  useEffect(() => {
    load();
  }, [load]);

  return { artifacts, loading, error, verify, exportManifest, reload: load };
}

export function useFindings() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFindingsFromResult = useCallback((result: PlaybookResult) => {
    setFindings(result.findings);
  }, []);

  const triage = useCallback(async (model?: string): Promise<AI_TriageResult[]> => {
    setLoading(true);
    setError(null);
    try {
      const results = await api.triageFindings(findings, model);
      return results;
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Triage failed';
      setError(err);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [findings]);

  return { findings, setFindings: setFindingsFromResult, triage, loading, error };
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sys = await api.getSystemStatus();
      setStatus(sys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { status, loading, error, reload: load };
}

export function useOllama() {
  const [models, setModels] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await api.checkOllamaConnection();
      setConnected(status.connected);
      setModels(status.models);
    } catch (e) {
      setConnected(false);
      setModels([]);
      setError(e instanceof Error ? e.message : 'Ollama connection check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const list = await api.getOllamaModels();
      setModels(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models');
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return { models, connected, loading, error, checkConnection, loadModels };
}