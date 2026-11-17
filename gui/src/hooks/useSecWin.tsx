'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface Tool {
  name: string;
  description: string;
  category: string;
  installed: boolean;
  version?: string;
  installMethods: string[];
}

export interface Playbook {
  metadata: {
    name: string;
    version: string;
    author?: string;
    description?: string;
    mitreTactics?: string[];
    tags?: string[];
  };
  variables: Record<string, Variable>;
  steps: Step[];
  outputs?: Outputs;
}

export interface Variable {
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  validation?: string;
  secret?: boolean;
  enum?: string[];
}

export interface Step {
  id: string;
  name: string;
  tool: string;
  args?: string[];
  condition?: string;
  retry?: number;
  timeout?: string;
  artifacts?: string[];
  mitreTechniques?: string[];
  env?: Record<string, string>;
  workingDir?: string;
  continueOnError?: boolean;
  parallel?: Step[];
  foreach?: ForeachSpec;
  if?: IfSpec;
  try?: TrySpec;
}

export interface ForeachSpec {
  variable: string;
  in: string;
  steps: Step[];
}

export interface IfSpec {
  condition: string;
  then: Step[];
  else?: Step[];
}

export interface TrySpec {
  steps: Step[];
  catch?: Step[];
  finally?: Step[];
}

export interface Outputs {
  findings?: string;
  report?: string;
  evidenceDir?: string;
  formats?: string[];
}

export interface Profile {
  name: string;
  vpnConfig?: string;
  macSpoof: boolean;
  hostname?: string;
  timezone?: string;
  dns?: string;
  proxy?: string;
}

export interface OpSecStatus {
  hostname: string;
  timezone?: string;
  vpn: string;
  httpProxy?: string;
  httpsProxy?: string;
  dns?: string;
  macAddresses: Record<string, string>;
}

export interface EvidenceArtifact {
  name: string;
  path: string;
  sha256: string;
  size: number;
  stepId?: string;
  timestamp: string;
}

export interface EvidenceManifest {
  generatedAt: string;
  evidenceDir: string;
  artifacts: EvidenceArtifact[];
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  mitreTechniques: string[];
  evidence: Record<string, string>;
  stepId: string;
  createdAt: string;
}

export interface PlaybookResult {
  playbook: Playbook;
  success: boolean;
  error?: string;
  duration: string;
  stepResults: Record<string, StepResult>;
  findings: Finding[];
  artifacts: Record<string, string>;
  reportPath?: string;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output: string;
  error?: string;
  duration: string;
  artifacts: Record<string, string>;
  startedAt: string;
  completedAt: string;
  retries: number;
}

export interface CommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface SecWinContextType {
  // State
  tools: Tool[];
  playbooks: Playbook[];
  profiles: Profile[];
  opsecStatus: OpSecStatus | null;
  activeProfile: string | null;
  findings: Finding[];
  evidence: EvidenceArtifact[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTools: () => Promise<void>;
  loadPlaybooks: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  loadOpSecStatus: () => Promise<void>;
  loadFindings: (evidenceDir: string) => Promise<void>;
  loadEvidence: (evidenceDir: string) => Promise<void>;

  installTool: (name: string) => Promise<CommandOutput>;
  runTool: (name: string, args: string[]) => Promise<CommandOutput>;
  runPlaybook: (playbookPath: string, variables: Record<string, string>) => Promise<PlaybookResult>;
  createProfile: (profile: Profile) => Promise<void>;
  updateProfile: (name: string, profile: Partial<Profile>) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
  engageProfile: (name: string) => Promise<void>;
  disengageProfile: () => Promise<void>;
  verifyEvidence: (dir: string) => Promise<void>;
  exportManifest: (dir: string, format: 'json' | 'yaml') => Promise<void>;
  generateReport: (evidenceDir: string, format: 'html' | 'markdown' | 'pdf') => Promise<string>;
  triageFindings: (findings: Finding[], model?: string) => Promise<Finding[]>;
}

const SecWinContext = createContext<SecWinContextType | undefined>(undefined);

export function SecWinProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [opsecStatus, setOpsecStatus] = useState<OpSecStatus | null>(null);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidence, setEvidence] = useState<EvidenceArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeCommand = useCallback(async (args: string[]): Promise<CommandOutput> => {
    try {
      const result = await invoke<CommandOutput>('run_secwin_command', { args });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  const loadTools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Tool[]>('get_tools');
      setTools(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPlaybooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Playbook[]>('get_playbooks');
      setPlaybooks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<{ profiles: Profile[]; active: string | null }>('get_profiles');
      setProfiles(result.profiles);
      setActiveProfile(result.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOpSecStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<OpSecStatus>('get_opsec_status');
      setOpsecStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OpSec status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFindings = useCallback(async (evidenceDir: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Finding[]>('get_findings', { evidenceDir });
      setFindings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load findings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadEvidence = useCallback(async (evidenceDir: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<EvidenceArtifact[]>('get_evidence', { evidenceDir });
      setEvidence(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installTool = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await executeCommand(['install', name]);
      await loadTools();
      return result;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand, loadTools]);

  const runTool = useCallback(async (name: string, args: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await executeCommand(['run', name, ...args]);
      return result;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand]);

  const runPlaybook = useCallback(async (playbookPath: string, variables: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    try {
      const args = ['playbook', 'run', playbookPath];
      for (const [key, value] of Object.entries(variables)) {
        args.push('--var', `${key}=${value}`);
      }
      const result = await executeCommand(args);
      // Parse result to get PlaybookResult
      const playbookResult = JSON.parse(result.stdout) as PlaybookResult;
      return playbookResult;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand]);

  const createProfile = useCallback(async (profile: Profile) => {
    setIsLoading(true);
    setError(null);
    try {
      const args = ['profile', 'create', profile.name];
      if (profile.vpnConfig) args.push('--vpn', profile.vpnConfig);
      if (profile.macSpoof) args.push('--mac-spoof');
      if (profile.hostname) args.push('--hostname', profile.hostname);
      if (profile.timezone) args.push('--timezone', profile.timezone);
      if (profile.dns) args.push('--dns', profile.dns);
      if (profile.proxy) args.push('--proxy', profile.proxy);
      await executeCommand(args);
      await loadProfiles();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand, loadProfiles]);

  const updateProfile = useCallback(async (name: string, profile: Partial<Profile>) => {
    setIsLoading(true);
    setError(null);
    try {
      // Delete and recreate for now
      await executeCommand(['profile', 'delete', name]);
      await createProfile({ name, ...profile } as Profile);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand, createProfile]);

  const deleteProfile = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await executeCommand(['profile', 'delete', name]);
      await loadProfiles();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand, loadProfiles]);

  const engageProfile = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await executeCommand(['profile', 'engage', name]);
      await loadProfiles();
      await loadOpSecStatus();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand, loadProfiles, loadOpSecStatus]);

  const disengageProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await executeCommand(['profile', 'disengage']);
      await loadProfiles();
      await loadOpSecStatus();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand, loadProfiles, loadOpSecStatus]);

  const verifyEvidence = useCallback(async (dir: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await executeCommand(['evidence', 'verify', dir]);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand]);

  const exportManifest = useCallback(async (dir: string, format: 'json' | 'yaml') => {
    setIsLoading(true);
    setError(null);
    try {
      await executeCommand(['evidence', 'export', '--dir', dir, '--format', format]);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [executeCommand]);

  const generateReport = useCallback(async (evidenceDir: string, format: 'html' | 'markdown' | 'pdf') => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<string>('generate_report', { evidenceDir, format });
      return result;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triageFindings = useCallback(async (findings: Finding[], model?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Finding[]>('triage_findings', { findings, model });
      return result;
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadTools();
    loadPlaybooks();
    loadProfiles();
    loadOpSecStatus();
  }, [loadTools, loadPlaybooks, loadProfiles, loadOpSecStatus]);

  return (
    <SecWinContext.Provider
      value={{
        tools,
        playbooks,
        profiles,
        opsecStatus,
        activeProfile,
        findings,
        evidence,
        isLoading,
        error,
        loadTools,
        loadPlaybooks,
        loadProfiles,
        loadOpSecStatus,
        loadFindings,
        loadEvidence,
        installTool,
        runTool,
        runPlaybook,
        createProfile,
        updateProfile,
        deleteProfile,
        engageProfile,
        disengageProfile,
        verifyEvidence,
        exportManifest,
        generateReport,
        triageFindings,
      }}
    >
      {children}
    </SecWinContext.Provider>
  );
}

export function useSecWin() {
  const context = useContext(SecWinContext);
  if (context === undefined) {
    throw new Error('useSecWin must be used within a SecWinProvider');
  }
  return context;
}