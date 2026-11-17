import { useState } from 'react';
import { Play, Stop, RotateCcw, FileText, Code, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, AlertTriangle, Terminal } from 'lucide-react';
import { usePlaybooks, usePlaybook, useRunPlaybook, useSystemStatus } from '../hooks/useSecWin';
import { cn, formatDuration, formatDate } from '../lib/utils';

export function PlaybookRunner() {
  const { playbooks, loading: playbooksLoading, reload: reloadPlaybooks } = usePlaybooks();
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('');
  const { playbook, loading: pbLoading, error: pbError } = usePlaybook(selectedPlaybook);
  const { run, running, result, error: runError, progress } = useRunPlaybook();
  const { status } = useSystemStatus();
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'config' | 'run' | 'results'>('config');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const handleRun = async () => {
    if (!playbook) return;
    setOutput('');
    setActiveTab('run');
    try {
      const vars: Record<string, unknown> = {};
      Object.entries(variables).forEach(([k, v]) => {
        vars[k] = v;
      });
      await run(playbook, vars);
    } catch (e) {
      console.error('Playbook run failed:', e);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };

  const getDefaultValue = (variable: any): string => {
    if (variable.default !== undefined) return String(variable.default);
    if (variable.enum?.length) return variable.enum[0];
    return '';
  };

  const initializeVariables = () => {
    if (!playbook) return;
    const defaults: Record<string, string> = {};
    Object.entries(playbook.variables).forEach(([key, variable]) => {
      defaults[key] = getDefaultValue(variable);
    });
    setVariables(defaults);
  };

  // Initialize variables when playbook changes
  // Note: In a real app, use useEffect for this

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playbook Runner</h1>
          <p className="text-muted-foreground mt-1">Execute automated security engagement playbooks</p>
        </div>
        <button onClick={reloadPlaybooks} className="btn-outline" disabled={playbooksLoading}>
          <RotateCcw className={cn('h-4 w-4 mr-2', playbooksLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Select Playbook</h2>
            </div>
            <div className="card-content space-y-2">
              {playbooksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : playbooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No playbooks found</p>
                  <p className="text-sm">Add .yaml files to the playbooks directory</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {playbooks.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedPlaybook(name);
                        setActiveTab('config');
                      }}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        selectedPlaybook === name
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-transparent hover:bg-accent'
                      )}
                    >
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {playbook?.metadata.description || 'No description'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedPlaybook && playbook && (
            <div className="card mt-4">
              <div className="card-header">
                <h2 className="card-title">Playbook Info</h2>
              </div>
              <div className="card-content space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="font-mono">{playbook.metadata.version}</p>
                </div>
                {playbook.metadata.author && (
                  <div>
                    <p className="text-sm text-muted-foreground">Author</p>
                    <p>{playbook.metadata.author}</p>
                  </div>
                )}
                {playbook.metadata.mitre_tactics?.length && (
                  <div>
                    <p className="text-sm text-muted-foreground">MITRE Tactics</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {playbook.metadata.mitre_tactics.map((tactic) => (
                        <span key={tactic} className="badge badge-info">{tactic}</span>
                      ))}
                    </div>
                  </div>
                )}
                {playbook.metadata.tags?.length && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {playbook.metadata.tags.map((tag) => (
                        <span key={tag} className="badge badge-secondary">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Steps</p>
                  <p className="font-mono">{playbook.steps.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedPlaybook && playbook && (
            <>
              <div className="flex gap-2 border-b border-border">
                {[
                  { id: 'config', label: 'Configuration', icon: FileText },
                  { id: 'run', label: 'Execution', icon: Play },
                  { id: 'results', label: 'Results', icon: CheckCircle },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>

              {activeTab === 'config' && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">Variables</h2>
                    <p className="text-sm text-muted-foreground">Configure playbook input variables</p>
                  </div>
                  <div className="card-content space-y-4">
                    {Object.entries(playbook.variables).length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No variables defined</p>
                    ) : (
                      Object.entries(playbook.variables).map(([key, variable]) => (
                        <div key={key} className="space-y-2">
                          <label htmlFor={key} className="block text-sm font-medium">
                            {key} {variable.required && <span className="text-destructive">*</span>}
                          </label>
                          <div className="flex flex-col gap-1">
                            {variable.enum?.length ? (
                              <select
                                id={key}
                                value={variables[key] || getDefaultValue(variable)}
                                onChange={(e) => handleVariableChange(key, e.target.value)}
                                className="input"
                              >
                                {variable.enum.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                id={key}
                                type={variable.secret ? 'password' : 'text'}
                                value={variables[key] || getDefaultValue(variable)}
                                onChange={(e) => handleVariableChange(key, e.target.value)}
                                className="input"
                                placeholder={variable.description}
                              />
                            )}
                            {variable.description && (
                              <p className="text-xs text-muted-foreground">{variable.description}</p>
                            )}
                            {variable.validation && (
                              <p className="text-xs text-muted-foreground">Validation: {variable.validation}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'run' && (
                <div className="card">
                  <div className="card-header">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="card-title">Execution</h2>
                        <p className="text-sm text-muted-foreground">Run the playbook and monitor progress</p>
                      </div>
                      <button
                        onClick={handleRun}
                        disabled={running || !playbook}
                        className={cn('btn-primary', running && 'opacity-50')}
                      >
                        {running ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Playbook
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="card-content">
                    {running && progress && (
                      <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="font-medium">Current Step:</span>
                          <span>{progress.step}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground font-mono">
                          {progress.output}
                        </div>
                      </div>
                    )}
                    {runError && (
                      <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="font-medium">Error:</span>
                        </div>
                        <div className="mt-1 text-sm">{runError}</div>
                      </div>
                    )}
                    {result && !running && (
                      <div className={cn(
                        'mb-4 p-3 rounded-lg border',
                        result.success ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      )}>
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                          <span className="font-medium">
                            {result.success ? 'Playbook completed successfully' : 'Playbook failed'}
                          </span>
                          <span className="text-sm text-muted-foreground ml-auto">
                            Duration: {formatDuration(result.duration)}
                          </span>
                        </div>
                        {result.error && (
                          <div className="mt-2 text-sm text-red-600 dark:text-red-400">{result.error}</div>
                        )}
                        {result.report_path && (
                          <div className="mt-2 text-sm">
                            Report: <code className="font-mono">{result.report_path}</code>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      <Terminal className="h-4 w-4 text-muted-foreground p-2 bg-muted" />
                      <pre className="p-4 font-mono text-sm bg-black text-green-300 max-h-96 overflow-y-auto scrollbar-thin">
                        {output || (running ? 'Waiting for output...' : 'No output yet. Click "Run Playbook" to start.')}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'results' && result && (
                <div className="space-y-6">
                  <div className="card">
                    <div className="card-header">
                      <h2 className="card-title">Step Results</h2>
                    </div>
                    <div className="card-content">
                      <div className="space-y-2">
                        {playbook.steps.map((step) => {
                          const stepResult = result.step_results[step.id];
                          if (!stepResult) return null;
                          const isExpanded = expandedSteps.has(step.id);
                          return (
                            <div key={step.id} className="border rounded-lg overflow-hidden">
                              <button
                                onClick={() => setExpandedSteps(prev => {
                                  const next = new Set(prev);
                                  if (next.has(step.id)) next.delete(step.id);
                                  else next.add(step.id);
                                  return next;
                                })}
                                className="w-full p-4 flex items-center justify-between hover:bg-accent transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {stepResult.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-600" />
                                  )}
                                  <div>
                                    <p className="font-medium">{step.id}: {step.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Tool: {step.tool} • {formatDuration(stepResult.duration)} • {stepResult.retries} retries
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn('badge', stepResult.success ? 'badge-success' : 'badge-error')}>
                                    {stepResult.success ? 'Success' : 'Failed'}
                                  </span>
                                  <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="p-4 border-t bg-muted/30 space-y-3">
                                  {stepResult.error && (
                                    <div className="text-red-600 dark:text-red-400 font-mono text-sm">
                                      Error: {stepResult.error}
                                    </div>
                                  )}
                                  {Object.keys(stepResult.artifacts).length > 0 && (
                                    <div>
                                      <p className="font-medium text-sm mb-2">Artifacts:</p>
                                      <ul className="space-y-1">
                                        {Object.entries(stepResult.artifacts).map(([name, path]) => (
                                          <li key={name} className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                                            <FileText className="h-3 w-3" />
                                            <span>{name}</span>
                                            <code className="ml-auto text-xs">{path}</code>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {Object.keys(stepResult.artifacts).length === 0 && !stepResult.error && (
                                    <p className="text-sm text-muted-foreground">No artifacts collected</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {result.findings.length > 0 && (
                    <div className="card">
                      <div className="card-header">
                        <h2 className="card-title">Findings ({result.findings.length})</h2>
                      </div>
                      <div className="card-content">
                        <div className="space-y-4">
                          {result.findings.map((finding) => (
                            <div key={finding.id} className="border rounded-lg p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium">{finding.title}</h3>
                                    <span className={cn('badge', getSeverityBadge(finding.severity))}>
                                      {finding.severity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{finding.description}</p>
                                  {finding.mitre_techniques.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {finding.mitre_techniques.map((tech) => (
                                        <span key={tech} className="badge badge-info text-xs">{tech}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {result.artifacts && Object.keys(result.artifacts).length > 0 && (
                    <div className="card">
                      <div className="card-header">
                        <h2 className="card-title">All Artifacts</h2>
                      </div>
                      <div className="card-content">
                        <ul className="space-y-2">
                          {Object.entries(result.artifacts).map(([name, path]) => (
                            <li key={name} className="flex items-center justify-between p-2 rounded border border-border">
                              <span className="font-mono text-sm">{name}</span>
                              <code className="text-xs text-muted-foreground">{path}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!selectedPlaybook && (
            <div className="card">
              <div className="card-content flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-medium mb-2">Select a Playbook</h2>
                <p className="text-muted-foreground">Choose a playbook from the sidebar to configure and run</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getSeverityBadge(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return 'badge-error';
    case 'high': return 'badge-warning';
    case 'medium': return 'badge-warning';
    case 'low': return 'badge-success';
    case 'info': return 'badge-info';
    default: return 'badge-secondary';
  }
}