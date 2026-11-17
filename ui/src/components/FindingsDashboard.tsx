import { useState } from 'react';
import { Search, Filter, Brain, Download, RotateCcw, AlertTriangle, CheckCircle, XCircle, Info, Loader2, Zap, Shield } from 'lucide-react';
import { useFindings, useOllama } from '../hooks/useSecWin';
import { cn, getSeverityColor, truncate } from '../lib/utils';

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function FindingsDashboard() {
  const { findings, setFindings, triage, loading: triageLoading, error: triageError } = useFindings();
  const { models, connected, loading: ollamaLoading, checkConnection } = useOllama();
  const [filter, setFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [triageResults, setTriageResults] = useState<Map<string, any>>(new Map());
  const [selectedFinding, setSelectedFinding] = useState<typeof findings[0] | null>(null);
  const [triageModel, setTriageModel] = useState<string>('');

  const filteredFindings = findings
    .filter(f => {
      if (filter && !f.title.toLowerCase().includes(filter.toLowerCase()) &&
          !f.description.toLowerCase().includes(filter.toLowerCase())) {
        return false;
      }
      if (severityFilter.length > 0 && !severityFilter.includes(f.severity.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 5) -
                       (severityOrder[b.severity as keyof typeof severityOrder] ?? 5));

  const handleTriage = async () => {
    if (findings.length === 0) return;
    try {
      const results = await triage(triageModel || undefined);
      const map = new Map();
      results.forEach(r => map.set(r.finding_id, r));
      setTriageResults(map);
    } catch (e) {
      console.error('Triage failed:', e);
    }
  };

  const getTriageBadge = (findingId: string) => {
    const result = triageResults.get(findingId);
    if (!result) return null;
    switch (result.classification) {
      case 'true_positive': return <CheckCircle className="h-3 w-3 text-green-600" title="True Positive" />;
      case 'false_positive': return <XCircle className="h-3 w-3 text-red-600" title="False Positive" />;
      case 'informational': return <Info className="h-3 w-3 text-blue-600" title="Informational" />;
      default: return <AlertTriangle className="h-3 w-3 text-yellow-600" title="Unknown" />;
    }
  };

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity.toLowerCase()] = (acc[f.severity.toLowerCase()] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings Dashboard</h1>
          <p className="text-muted-foreground mt-1">Review and triage security findings with AI assistance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={checkConnection} className="btn-outline" disabled={ollamaLoading}>
            <Brain className={cn('h-4 w-4 mr-2', ollamaLoading && 'animate-spin')} />
            {connected ? 'Ollama Connected' : 'Connect Ollama'}
          </button>
        </div>
      </div>

      {!connected && (
        <div className="card border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="card-content flex items-center gap-4">
            <Brain className="h-6 w-6 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium">Ollama AI Not Connected</p>
              <p className="text-sm text-muted-foreground">
                Connect to Ollama for AI-powered finding triage. Ensure Ollama is running on localhost:11434.
              </p>
            </div>
            <button onClick={checkConnection} className="btn-primary btn-sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Retry Connection
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <div className="card">
          <div className="card-content text-center">
            <p className="text-3xl font-bold">{findings.length}</p>
            <p className="text-sm text-muted-foreground">Total Findings</p>
          </div>
        </div>
        {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
          <div key={sev} className="card">
            <div className="card-content text-center">
              <p className="text-2xl font-bold {getSeverityColor(sev).replace('bg-', 'text-')}">
                {severityCounts[sev] || 0}
              </p>
              <p className="text-sm text-muted-foreground capitalize">{sev}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="card-title">Findings</h2>
              <p className="text-sm text-muted-foreground">{filteredFindings.length} of {findings.length} findings</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search findings..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="input pl-10 w-64"
                />
              </div>
              <div className="flex items-center gap-2">
                {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
                  <label key={sev} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={severityFilter.includes(sev)}
                      onChange={(e) => setSeverityFilter(prev =>
                        e.target.checked ? [...prev, sev] : prev.filter(s => s !== sev)
                      )}
                      className="rounded border-input"
                    />
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', getSeverityColor(sev))}>
                      {sev}
                    </span>
                  </label>
                ))}
              </div>
              {connected && findings.length > 0 && (
                <button onClick={handleTriage} disabled={triageLoading} className="btn-primary">
                  <Zap className={cn('h-4 w-4 mr-2', triageLoading && 'animate-spin')} />
                  {triageLoading ? 'Triaging...' : 'AI Triage'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="card-content">
          {findings.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Findings</h3>
              <p className="text-muted-foreground">Run a playbook to generate findings, or load a previous engagement</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredFindings.map((finding) => {
                const triageResult = triageResults.get(finding.id);
                return (
                  <div
                    key={finding.id}
                    className={cn(
                      'p-4 rounded-lg border transition-all hover:bg-accent/50',
                      triageResult?.classification === 'false_positive' ? 'opacity-50 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : 'border-border'
                    )}
                    onClick={() => setSelectedFinding(finding)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{finding.title}</h3>
                          <span className={cn('badge', getSeverityColor(finding.severity))}>
                            {finding.severity}
                          </span>
                          {getTriageBadge(finding.id)}
                          {finding.mitre_techniques.length > 0 && (
                            <span className="badge badge-info">
                              <Shield className="h-3 w-3 mr-1" />
                              {finding.mitre_techniques.length} MITRE
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
                        {finding.mitre_techniques.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {finding.mitre_techniques.slice(0, 5).map(tech => (
                              <span key={tech} className="badge badge-info text-xs">{tech}</span>
                            ))}
                            {finding.mitre_techniques.length > 5 && (
                              <span className="badge badge-secondary text-xs">+{finding.mitre_techniques.length - 5} more</span>
                            )}
                          </div>
                        )}
                        {triageResult && (
                          <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium capitalize">{triageResult.classification.replace('_', ' ')}</span>
                              <span className="text-muted-foreground">({Math.round(triageResult.confidence * 100)}% confidence)</span>
                            </div>
                            {triageResult.reasoning && (
                              <p className="mt-1 text-muted-foreground">{truncate(triageResult.reasoning, 200)}</p>
                            )}
                            {triageResult.remediation && (
                              <p className="mt-1 text-green-600 dark:text-green-400">💡 {truncate(triageResult.remediation, 200)}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                        <span>Step: {finding.step_id}</span>
                        <span className="font-mono">{truncate(finding.id, 12)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {triageError && (
        <div className="card border-red-200 bg-red-50 dark:bg-red-900/20">
          <div className="card-content flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-700 dark:text-red-300">{triageError}</span>
          </div>
        </div>
      )}

      {selectedFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedFinding.title}</h2>
              <button onClick={() => setSelectedFinding(null)} className="btn-ghost">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                <span className={cn('badge', getSeverityColor(selectedFinding.severity))}>
                  {selectedFinding.severity}
                </span>
                {getTriageBadge(selectedFinding.id)}
                <span className="badge badge-secondary">Step: {selectedFinding.step_id}</span>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Description</h3>
                <p className="text-muted-foreground">{selectedFinding.description}</p>
              </div>

              {selectedFinding.mitre_techniques.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">MITRE ATT&CK Techniques</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedFinding.mitre_techniques.map(tech => (
                      <span key={tech} className="badge badge-info">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              {triageResults.has(selectedFinding.id) && (
                <div className="space-y-2 border-t pt-4">
                  <h3 className="font-medium">AI Triage Result</h3>
                  <div className="p-4 rounded bg-muted/50 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium capitalize">{triageResults.get(selectedFinding.id).classification.replace('_', ' ')}</span>
                      <span className="text-sm text-muted-foreground">{Math.round(triageResults.get(selectedFinding.id).confidence * 100)}% confidence</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reasoning</p>
                      <p>{triageResults.get(selectedFinding.id).reasoning}</p>
                    </div>
                    {triageResults.get(selectedFinding.id).remediation && (
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">Suggested Remediation</p>
                        <p className="text-green-700 dark:text-green-300">{triageResults.get(selectedFinding.id).remediation}</p>
                      </div>
                    )}
                    {triageResults.get(selectedFinding.id).mitre_enrichment?.length && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Additional MITRE Techniques</p>
                        <div className="flex flex-wrap gap-1">
                          {triageResults.get(selectedFinding.id).mitre_enrichment.map((tech: string) => (
                            <span key={tech} className="badge badge-info">{tech}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <button onClick={() => setSelectedFinding(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}