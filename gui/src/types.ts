export interface Profile {
  name: string
  vpn_config?: string
  mac_spoof: boolean
  hostname?: string
  timezone?: string
  dns?: string
  proxy?: string
  active: boolean
}

export interface ProfileCreateRequest {
  name: string
  vpn_config?: string
  mac_spoof: boolean
  hostname?: string
  timezone?: string
  dns?: string
  proxy?: string
}

export interface Playbook {
  id: string
  name: string
  version: string
  author?: string
  description?: string
  path: string
  mitre_tactics: string[]
  tags: string[]
}

export interface PlaybookRunRequest {
  playbook_id: string
  variables: Record<string, unknown>
  formats: string[]
}

export interface PlaybookRunResult {
  success: boolean
  playbook_id: string
  duration_ms: number
  report_path?: string
  evidence_dir?: string
  findings: Finding[]
  artifacts: Artifact[]
  error?: string
}

export interface PlaybookStatus {
  running: boolean
  playbook_id?: string
  current_step?: string
  progress: number
  started_at?: string
}

export interface Artifact {
  name: string
  path: string
  sha256: string
  size: number
  step_id: string
  timestamp: string
}

export interface Finding {
  id: string
  title: string
  description: string
  severity: string
  mitre_techniques: string[]
  evidence: Record<string, string>
  step_id: string
  created_at: string
}

export interface Report {
  id: string
  playbook_name: string
  format: string
  path: string
  created_at: string
  size: number
}

export interface SystemInfo {
  os: string
  arch: string
  hostname: string
  username: string
  secwin_version: string
  wsl_available: boolean
  wsl_distros: string[]
}

export interface Settings {
  ollama_url: string
  ollama_model: string
  default_evidence_dir: string
  default_report_dir: string
  auto_engage_profile?: string
  theme: string
}

export interface TriageResult {
  finding_id: string
  summary: string
  severity_assessment: string
  recommended_actions: string[]
  mitre_mapping: MitreMapping[]
  confidence: number
}

export interface MitreMapping {
  technique_id: string
  technique_name: string
  tactic: string
  confidence: number
}

export interface SummaryResult {
  executive_summary: string
  key_findings: KeyFinding[]
  risk_score: number
  recommendations: string[]
}

export interface KeyFinding {
  title: string
  severity: string
  impact: string
  likelihood: string
}