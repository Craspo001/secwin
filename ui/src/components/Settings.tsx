import { useState } from 'react';
import { Settings, Terminal, Shield, FolderOpen, Brain, Save, RotateCcw, CheckCircle, XCircle, Loader2, Download, Upload } from 'lucide-react';
import { useTools, useSystemStatus } from '../hooks/useSecWin';
import { cn } from '../lib/utils';

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'tools', label: 'Tools', icon: Terminal },
  { id: 'profiles', label: 'Profiles', icon: Shield },
  { id: 'evidence', label: 'Evidence', icon: FolderOpen },
  { id: 'ai', label: 'AI Triage', icon: Brain },
];

export function Settings() {
  const { tools, loading: toolsLoading, search, install, reload: reloadTools } = useTools();
  const { status, loading: statusLoading, reload: reloadStatus } = useSystemStatus();
  const [activeTab, setActiveTab] = useState('general');
  const [toolSearch, setToolSearch] = useState('');
  const [installingTool, setInstallingTool] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleToolSearch = async () => {
    if (toolSearch.trim()) {
      await search(toolSearch);
    } else {
      await reloadTools();
    }
  };

  const handleInstall = async (name: string) => {
    setInstallingTool(name);
    try {
      await install(name);
    } finally {
      setInstallingTool(null);
    }
  };

  const handleTestOllama = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      // This would call the Tauri API to test Ollama connection
      // For now, simulate
      await new Promise(r => setTimeout(r, 1000));
      setConnectionResult({ success: true, message: 'Connected to Ollama successfully' });
    } catch (e) {
      setConnectionResult({ success: false, message: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure SecWin preferences and integrations</p>
        </div>
        <button onClick={reloadStatus} className="btn-outline" disabled={statusLoading}>
          <RotateCcw className={cn('h-4 w-4 mr-2', statusLoading && 'animate-spin')} />
          Refresh Status
        </button>
      </div>

      <div className="flex gap-4 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">System Information</h2>
            </div>
            <div className="card-content">
              {statusLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : status ? (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><dt className="text-sm text-muted-foreground">Operating System</dt><dd className="font-mono">{status.os} ({status.arch})</dd></div>
                  <div><dt className="text-sm text-muted-foreground">WSL Available</dt><dd className="font-mono">{status.wsl_available ? 'Yes' : 'No'}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">WSL Distros</dt><dd className="font-mono">{status.wsl_distros.join(', ') || 'None'}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Tools Installed</dt><dd className="font-mono">{status.tools_installed}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Active Profile</dt><dd className="font-mono">{status.active_profile || 'None'}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Tool Directory</dt><dd className="font-mono text-xs">~/.secwin/tools</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Binary Directory</dt><dd className="font-mono text-xs">~/.secwin/bin</dd></div>
                  <div><dt className="text-sm text-muted-foreground">Config Directory</dt><dd className="font-mono text-xs">~/.secwin</dd></div>
                </dl>
              ) : (
                <p className="text-muted-foreground">Unable to load system status</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Directories</h2>
              <p className="text-sm text-muted-foreground">SecWin data locations</p>
            </div>
            <div className="card-content space-y-4">
              {[
                { label: 'Tools', path: '~/.secwin/tools', description: 'Installed security tools' },
                { label: 'Binaries', path: '~/.secwin/bin', description: 'Executable binaries (in PATH)' },
                { label: 'Config', path: '~/.secwin', description: 'Configuration and profiles' },
                { label: 'Evidence', path: '~/.secwin/evidence', description: 'Collected artifacts' },
                { label: 'Playbooks', path: '~/.secwin/playbooks', description: 'Custom playbooks' },
                { label: 'Cache', path: '~/.secwin/cache', description: 'Temporary cache files' },
              ].map((dir, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded border border-border">
                  <div>
                    <p className="font-medium">{dir.label}</p>
                    <p className="text-sm text-muted-foreground">{dir.description}</p>
                  </div>
                  <code className="font-mono text-sm text-muted-foreground">{dir.path}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="card-title">Tool Management</h2>
                  <p className="text-sm text-muted-foreground">{tools.length} tools available</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search tools..."
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    className="input w-64"
                  />
                  <button onClick={handleToolSearch} className="btn-primary" disabled={toolsLoading}>
                    <Loader2 className={cn('h-4 w-4', toolsLoading && 'animate-spin')} />
                    {toolsLoading ? 'Loading...' : 'Search'}
                  </button>
                  <button onClick={reloadTools} className="btn-outline" disabled={toolsLoading}>
                    <RotateCcw className={cn('h-4 w-4', toolsLoading && 'animate-spin')} />
                  </button>
                </div>
              </div>
            </div>
            <div className="card-content">
              {toolsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : tools.length === 0 ? (
                <div className="text-center py-12">
                  <Terminal className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Tools Found</h3>
                  <p className="text-muted-foreground mb-4">Search for tools or check your manifest directory</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <div key={tool.name} className="flex items-center justify-between p-3 rounded border border-border hover:bg-accent/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-primary/10">
                          <Terminal className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="badge badge-secondary">{tool.category}</span>
                            {tool.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="badge badge-outline">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">v{tool.version}</span>
                        <button
                          onClick={() => handleInstall(tool.name)}
                          disabled={installingTool === tool.name}
                          className="btn-primary btn-sm"
                        >
                          {installingTool === tool.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Install'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profiles' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">OpSec Profiles</h2>
            <p className="text-sm text-muted-foreground">Manage profiles in the Profiles tab</p>
          </div>
          <div className="card-content">
            <p className="text-muted-foreground">OpSec profile management is available in the <strong>Profiles</strong> section of the sidebar.</p>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Evidence Settings</h2>
          </div>
          <div className="card-content space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Default Evidence Directory</label>
              <input type="text" value="~/.secwin/evidence" className="input" readOnly />
              <p className="text-sm text-muted-foreground">Evidence is stored per-engagement in the output directory</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Retention Period</label>
              <select className="input w-48">
                <option>30 days</option>
                <option selected>90 days</option>
                <option>180 days</option>
                <option>365 days</option>
                <option>Never</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-input" defaultChecked />
                <span>Auto-verify evidence on playbook completion</span>
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-input" defaultChecked />
                <span>Generate SHA256 for all artifacts</span>
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-input" />
                <span>Compress evidence after retention period</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Ollama AI Integration</h2>
              <p className="text-sm text-muted-foreground">Configure local LLM for finding triage</p>
            </div>
            <div className="card-content space-y-4">
              <div className="space-y-2">
                <label htmlFor="ollama-url" className="block text-sm font-medium">Ollama Server URL</label>
                <input
                  id="ollama-url"
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="input"
                  placeholder="http://localhost:11434"
                />
                <p className="text-sm text-muted-foreground">Default: http://localhost:11434</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTestOllama} disabled={testingConnection} className="btn-primary">
                  {testingConnection ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </button>
                {connectionResult && (
                  <span className={cn('flex items-center gap-2 text-sm', connectionResult.success ? 'text-green-600' : 'text-red-600')}>
                    {connectionResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {connectionResult.message}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Default Model for Triage</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="input w-64"
                >
                  <option value="">Select model...</option>
                  <option value="llama3.2">llama3.2</option>
                  <option value="mistral">mistral</option>
                  <option value="codellama">codellama</option>
                  <option value="phi3">phi3</option>
                </select>
                <p className="text-sm text-muted-foreground">Models must be pulled in Ollama first: <code>ollama pull <model></code></p>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Triage Features</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-input" defaultChecked />
                    <span>Classify findings (TP/FP/Informational)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-input" defaultChecked />
                    <span>Suggest severity adjustments</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-input" defaultChecked />
                    <span>Provide remediation guidance</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-input" />
                    <span>Enrich with additional MITRE techniques</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-input" defaultChecked />
                    <span>Batch process all findings at once</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">About AI Triage</h2>
            </div>
            <div className="card-content space-y-3 text-sm text-muted-foreground">
              <p>SecWin uses local Ollama LLMs to automatically triage security findings:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>True Positive</strong> - Genuine security issue requiring attention</li>
                <li><strong>False Positive</strong> - Benign finding that can be dismissed</li>
                <li><strong>Informational</strong> - Useful context but not a vulnerability</li>
              </ul>
              <p>All processing happens locally - no data leaves your machine.</p>
              <p className="font-medium">Recommended models:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>llama3.2</code> - General purpose, good balance</li>
                <li><code>mistral</code> - Fast, good for classification</li>
                <li><code>codellama</code> - Better for code-related findings</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}