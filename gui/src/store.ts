import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface Profile {
  name: string;
  vpn_config?: string;
  mac_spoof: boolean;
  hostname?: string;
  timezone?: string;
  dns?: string;
  proxy?: string;
  active: boolean;
}

export interface OpSecStatus {
  hostname: string;
  timezone?: string;
  vpn: string;
  http_proxy?: string;
  https_proxy?: string;
  dns?: string;
  mac_addresses: Record<string, string>;
}

export interface EvidenceArtifact {
  name: string;
  path: string;
  sha256: string;
  size: number;
  step_id: string;
  timestamp: string;
}

export interface Playbook {
  name: string;
  version: string;
  description: string;
  mitre_tactics: string[];
  tags: string[];
  steps: PlaybookStep[];
  variables: Record<string, PlaybookVariable>;
}

export interface PlaybookStep {
  id: string;
  name: string;
  tool: string;
  args?: string[];
  condition?: string;
  retry?: number;
  timeout?: string;
  artifacts?: string[];
  mitre_techniques?: string[];
  env?: Record<string, string>;
  working_dir?: string;
  continue_on_error?: boolean;
  parallel?: PlaybookStep[];
  foreach?: ForeachSpec;
  if?: IfSpec;
  try?: TrySpec;
}

export interface PlaybookVariable {
  type: string;
  required?: boolean;
  default?: any;
  description?: string;
  validation?: string;
  secret?: boolean;
  enum?: string[];
}

export interface ForeachSpec {
  variable: string;
  in: string;
  steps: PlaybookStep[];
}

export interface IfSpec {
  condition: string;
  then: PlaybookStep[];
  else?: PlaybookStep[];
}

export interface TrySpec {
  steps: PlaybookStep[];
  catch?: PlaybookStep[];
  finally?: PlaybookStep[];
}

export interface ToolManifest {
  name: string;
  version: string;
  description: string;
  category: string;
  homepage: string;
  repository: string;
  license: string;
  tags: string[];
  platforms: string[];
  install_methods: InstallMethod[];
  wsl_preferred: boolean;
  wsl_distro?: string;
  installed: boolean;
}

export interface InstallMethod {
  method: string;
  source: string;
  binary_name?: string;
  args: string[];
  version_args: string[];
  version_regex?: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  mitre_techniques: string[];
  evidence: Record<string, string>;
  step_id: string;
  created_at: string;
}

interface StoreState {
  // SecWin status
  secwinAvailable: boolean;
  secwinPath: string;
  secwinVersion: string;

  // Profiles
  profiles: Profile[];
  activeProfile: string | null;
  opsecStatus: OpSecStatus | null;

  // Evidence
  evidenceArtifacts: EvidenceArtifact[];
  evidenceDir: string;

  // Playbooks
  playbooks: Playbook[];
  currentPlaybook: Playbook | null;

  // Tools
  tools: ToolManifest[];
  toolsLoading: boolean;
  toolsCategory: string;
  toolsSearchQuery: string;

  // Findings
  findings: Finding[];

  // System
  systemInfo: any;

  // UI state
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Notification[];

  // Actions
  checkSecwin: () => Promise<void>;
  setSecwinAvailable: (available: boolean) => void;
  loadProfiles: () => Promise<void>;
  engageProfile: (name: string) => Promise<void>;
  disengageProfile: () => Promise<void>;
  createProfile: (profile: Partial<Profile> & { name: string }) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
  refreshOpSecStatus: () => Promise<void>;
  loadEvidence: (dir?: string) => Promise<void>;
  verifyEvidence: (dir?: string, strict?: boolean) => Promise<void>;
  exportEvidence: (dir?: string, output?: string, format?: string) => Promise<void>;
  loadPlaybooks: () => Promise<void>;
  loadPlaybookDetail: (name: string) => Promise<void>;
  runPlaybook: (name: string, variables: Record<string, string>) => Promise<void>;
  loadTools: (category?: string) => Promise<void>;
  searchTools: (query: string) => Promise<void>;
  installTool: (name: string) => Promise<void>;
  loadSystemInfo: () => Promise<void>;
  runSecwinCommand: (args: string[]) => Promise<{ stdout: string; stderr: string; exit_code: number }>;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  read?: boolean;
  createdAt?: number;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  secwinAvailable: false,
  secwinPath: '',
  secwinVersion: '',
  profiles: [],
  activeProfile: null,
  opsecStatus: null,
  evidenceArtifacts: [],
  evidenceDir: '',
  playbooks: [],
  currentPlaybook: null,
  tools: [],
  toolsLoading: false,
  toolsCategory: 'all',
  toolsSearchQuery: '',
  findings: [],
  systemInfo: null,
  sidebarOpen: true,
  theme: 'system',
  notifications: [],

  // Actions
  checkSecwin: async () => {
    try {
      const path = await invoke<string>('get_secwin_path');
      const versionOutput = await invoke<string>('run_secwin_command', { args: ['--version'] });
      set({
        secwinAvailable: true,
        secwinPath: path,
        secwinVersion: versionOutput.trim(),
      });
      get().loadProfiles();
      get().loadTools();
      get().loadSystemInfo();
    } catch (error) {
      set({ secwinAvailable: false });
      get().addNotification({
        type: 'error',
        title: 'SecWin Not Found',
        message: 'Please install SecWin CLI first. Run: go install github.com/secwin/secwin@latest',
        duration: 10000,
      });
    }
  },

  setSecwinAvailable: (available: boolean) => set({ secwinAvailable: available }),

  loadProfiles: async () => {
    try {
      const profiles = await invoke<Profile[]>('list_profiles');
      const activeProfile = profiles.find(p => p.active)?.name || null;
      set({ profiles, activeProfile });
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  },

  engageProfile: async (name: string) => {
    try {
      await invoke<string>('engage_profile', { name });
      get().addNotification({ type: 'success', title: 'Profile Engaged', message: `Profile "${name}" is now active` });
      await get().loadProfiles();
      await get().refreshOpSecStatus();
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Failed to Engage Profile', message: String(error) });
      throw error;
    }
  },

  disengageProfile: async () => {
    try {
      await invoke<string>('disengage_profile');
      get().addNotification({ type: 'success', title: 'Profile Disengaged', message: 'Profile has been disengaged' });
      await get().loadProfiles();
      await get().refreshOpSecStatus();
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Failed to Disengage Profile', message: String(error) });
      throw error;
    }
  },

  createProfile: async (profile) => {
    try {
      await invoke<string>('create_profile', profile);
      get().addNotification({ type: 'success', title: 'Profile Created', message: `Profile "${profile.name}" created successfully` });
      await get().loadProfiles();
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Failed to Create Profile', message: String(error) });
      throw error;
    }
  },

  deleteProfile: async (name: string) => {
    try {
      await invoke<string>('delete_profile', { name });
      get().addNotification({ type: 'success', title: 'Profile Deleted', message: `Profile "${name}" deleted` });
      await get().loadProfiles();
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Failed to Delete Profile', message: String(error) });
      throw error;
    }
  },

  refreshOpSecStatus: async () => {
    try {
      const status = await invoke<OpSecStatus>('get_opsec_status');
      set({ opsecStatus: status });
    } catch (error) {
      console.error('Failed to get OpSec status:', error);
    }
  },

  loadEvidence: async (dir?: string) => {
    try {
      const artifacts = await invoke<EvidenceArtifact[]>('list_evidence', { dir });
      set({ evidenceArtifacts: artifacts });
    } catch (error) {
      console.error('Failed to load evidence:', error);
    }
  },

  verifyEvidence: async (dir?: string, strict?: boolean) => {
    try {
      const result = await invoke<string>('verify_evidence', { dir, strict });
      get().addNotification({ type: 'success', title: 'Verification Complete', message: result });
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Verification Failed', message: String(error) });
      throw error;
    }
  },

  exportEvidence: async (dir?: string, output?: string, format?: string) => {
    try {
      const result = await invoke<string>('export_evidence', { dir, output, format });
      get().addNotification({ type: 'success', title: 'Export Complete', message: result });
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Export Failed', message: String(error) });
      throw error;
    }
  },

  loadPlaybooks: async () => {
    try {
      const playbooks = await invoke<Playbook[]>('list_playbooks');
      set({ playbooks });
    } catch (error) {
      console.error('Failed to load playbooks:', error);
    }
  },

  loadPlaybookDetail: async (name: string) => {
    try {
      const playbook = await invoke<any>('get_playbook_detail', { name });
      set({ currentPlaybook: playbook });
    } catch (error) {
      console.error('Failed to load playbook detail:', error);
    }
  },

  runPlaybook: async (name: string, variables: Record<string, string>) => {
    try {
      get().addNotification({ type: 'info', title: 'Playbook Started', message: `Running ${name}...` });
      await invoke<any>('run_playbook', { name, variables });
      get().addNotification({ type: 'success', title: 'Playbook Completed', message: `${name} finished successfully` });
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Playbook Failed', message: String(error) });
      throw error;
    }
  },

  loadTools: async (category?: string) => {
    set({ toolsLoading: true });
    try {
      const tools = await invoke<ToolManifest[]>('list_tools', { category });
      set({ tools, toolsLoading: false });
    } catch (error) {
      set({ toolsLoading: false });
      console.error('Failed to load tools:', error);
    }
  },

  searchTools: async (query: string) => {
    set({ toolsSearchQuery: query, toolsLoading: true });
    try {
      const tools = await invoke<ToolManifest[]>('search_tools', { query });
      set({ tools, toolsLoading: false });
    } catch (error) {
      set({ toolsLoading: false });
      console.error('Failed to search tools:', error);
    }
  },

  installTool: async (name: string) => {
    try {
      const result = await invoke<string>('install_tool', { name });
      get().addNotification({ type: 'success', title: 'Tool Installed', message: result });
      await get().loadTools();
    } catch (error) {
      get().addNotification({ type: 'error', title: 'Install Failed', message: String(error) });
      throw error;
    }
  },

  loadSystemInfo: async () => {
    try {
      const info = await invoke<any>('get_system_info');
      set({ systemInfo: info });
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  },

  runSecwinCommand: async (args: string[]) => {
    try {
      const result = await invoke<{ stdout: string; stderr: string; exit_code: number }>('run_secwin_command', { args });
      return result;
    } catch (error) {
      console.error('Failed to run secwin command:', error);
      return { stdout: '', stderr: String(error), exit_code: -1 };
    }
  },

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),

  addNotification: (notification) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id, createdAt: Date.now() };
    set((state) => ({ notifications: [...state.notifications, newNotification] }));
    if (notification.duration !== 0) {
      setTimeout(() => get().removeNotification(id), notification.duration || 5000);
    }
  },

  removeNotification: (id: string) => {
    set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }));
  },
}));