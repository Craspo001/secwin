import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { Command, CommandEvent } from '@tauri-apps/plugin-shell';

export interface Playbook {
  metadata: {
    name: string;
    version: string;
    author?: string;
    description?: string;
    mitre_tactics?: string[];
    tags?: string[];
  };
  variables: Record<string, Variable>;
  steps: Step[];
  outputs: Outputs;
  hooks: Hooks;
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
  mitre_techniques?: string[];
  env?: Record<string, string>;
  working_dir?: string;
  continue_on_error?: boolean;
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
  evidence_dir?: string;
  formats?: string[];
}

export interface Hooks {
  pre_step?: HookSpec[];
  post_step?: HookSpec[];
  on_failure?: HookSpec[];
  on_success?: HookSpec[];
}

export interface HookSpec {
  tool: string;
  args?: string[];
}

export interface PlaybookResult {
  success: boolean;
  error?: string;
  duration: number;
  step_results: Record<string, StepResult>;
  findings: Finding[];
  artifacts: Record<string, string>;
  report_path?: string;
}

export interface StepResult {
  step_id: string;
  success: boolean;
  output: string;
  error: string;
  duration: number;
  artifacts: Record<string, string>;
  started_at: string;
  completed_at: string;
  retries: number;
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

export interface Profile {
  name: string;
  vpn_config?: string;
  mac_spoof: boolean;
  hostname?: string;
  timezone?: string;
  dns?: string;
  proxy?: string;
}

export interface EvidenceArtifact {
  name: string;
  path: string;
  sha256: string;
  size: number;
  step_id: string;
  timestamp: string;
}

export interface EvidenceManifest {
  generated_at: string;
  evidence_dir: string;
  artifacts: EvidenceArtifact[];
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
  aliases: string[];
  install_methods: InstallMethod[];
  wsl_preferred?: boolean;
  wsl_distro?: string;
  post_install?: {
    commands: string[];
    verify_command: string;
  };
}

export interface InstallMethod {
  method: string;
  priority: number;
  platforms: string[];
  architectures: string[];
  source: string;
  binary_name?: string;
  checksum?: string;
  version?: string;
  extract_path?: string;
  script?: string;
  pre_commands?: string[];
}

export interface SystemStatus {
  os: string;
  arch: string;
  wsl_available: boolean;
  wsl_distros: string[];
  tools_installed: number;
  active_profile?: string;
}

export interface AI_TriageResult {
  finding_id: string;
  classification: 'true_positive' | 'false_positive' | 'informational' | 'unknown';
  confidence: number;
  reasoning: string;
  suggested_severity?: string;
  remediation?: string;
  mitre_enrichment?: string[];
}

// Tauri invoke wrappers
export const api = {
  // Playbook operations
  async listPlaybooks(): Promise<string[]> {
    return invoke('list_playbooks');
  },

  async loadPlaybook(name: string): Promise<Playbook> {
    return invoke('load_playbook', { name });
  },

  async runPlaybook(playbook: Playbook, variables: Record<string, unknown>): Promise<PlaybookResult> {
    return invoke('run_playbook', { playbook, variables });
  },

  async validatePlaybook(playbook: Playbook): Promise<{ valid: boolean; errors: string[] }> {
    return invoke('validate_playbook', { playbook });
  },

  // Profile operations
  async listProfiles(): Promise<Profile[]> {
    return invoke('list_profiles');
  },

  async createProfile(profile: Profile): Promise<void> {
    return invoke('create_profile', { profile });
  },

  async engageProfile(name: string): Promise<void> {
    return invoke('engage_profile', { name });
  },

  async disengageProfile(): Promise<void> {
    return invoke('disengage_profile');
  },

  async getProfileStatus(): Promise<{ active: string | null; profiles: Profile[]; system: OpSecStatus }> {
    return invoke('get_profile_status');
  },

  async deleteProfile(name: string): Promise<void> {
    return invoke('delete_profile', { name });
  },

  // Tool operations
  async listTools(): Promise<ToolManifest[]> {
    return invoke('list_tools');
  },

  async installTool(name: string): Promise<void> {
    return invoke('install_tool', { name });
  },

  async searchTools(query: string): Promise<ToolManifest[]> {
    return invoke('search_tools', { query });
  },

  // Evidence operations
  async listEvidence(dir?: string): Promise<EvidenceArtifact[]> {
    return invoke('list_evidence', { dir });
  },

  async verifyEvidence(dir?: string): Promise<{ verified: number; failed: number; details: Array<{ name: string; expected: string; actual: string; match: boolean }> }> {
    return invoke('verify_evidence', { dir });
  },

  async exportEvidenceManifest(dir?: string, format?: 'json' | 'yaml'): Promise<string> {
    return invoke('export_evidence_manifest', { dir, format });
  },

  // System operations
  async getSystemStatus(): Promise<SystemStatus> {
    return invoke('get_system_status');
  },

  async checkWSL(): Promise<{ available: boolean; distros: string[]; default: string }> {
    return invoke('check_wsl');
  },

  // AI Triage
  async triageFindings(findings: Finding[], model?: string): Promise<AI_TriageResult[]> {
    return invoke('triage_findings', { findings, model });
  },

  async getOllamaModels(): Promise<string[]> {
    return invoke('get_ollama_models');
  },

  async checkOllamaConnection(): Promise<{ connected: boolean; version?: string; models: string[] }> {
    return invoke('check_ollama_connection');
  },
};

// File operations using Tauri FS plugin
export const fs = {
  async readTextFile(path: string, baseDir?: BaseDirectory): Promise<string> {
    return readTextFile(path, { baseDir });
  },

  async writeTextFile(path: string, contents: string, baseDir?: BaseDirectory): Promise<void> {
    return writeTextFile(path, contents, { baseDir });
  },
};

// Dialog operations
export const dialog = {
  async openFile(options?: { multiple?: boolean; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | string[] | null> {
    return open(options);
  },
};

// Shell command execution for real-time output
export const shell = {
  async runCommand(command: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
    const cmd = new Command(command, args);
    if (cwd) cmd.cwd(cwd);
    const output = await cmd.execute();
    return {
      stdout: output.stdout,
      stderr: output.stderr,
      code: output.code ?? 0,
    };
  },

  async *streamCommand(command: string, args: string[], cwd?: string): AsyncGenerator<CommandEvent> {
    const cmd = new Command(command, args);
    if (cwd) cmd.cwd(cwd);
    for await (const event of cmd.stream()) {
      yield event;
    }
  },
};