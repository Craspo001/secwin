import { useState } from 'react';
import { useStore } from '../store';
import { Brain, RefreshCw, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';

interface TriageResult {
  findingId: string;
  originalSeverity: string;
  suggestedSeverity: string;
  confidence: number;
  reasoning: string;
  mitreTags: string[];
  recommendedActions: string[];
}

export function AIInsights() {
  const { findings, runSecwinCommand, addNotification } = useStore();
  const [triageResults, setTriageResults] = useState<TriageResult[]>([]);
  const [triaging, setTriaging] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState('All');

  const checkOllama = async () => {
    try {
      const output = await runSecwinCommand(['ai', 'models', '--ollama-url', 'http://localhost:11434']);
      if (output.exit_code === 0) {
        setOllamaStatus('connected');
        const lines = output.stdout.split('\n').filter(l => l.trim().startsWith('  '));
        setAvailableModels(lines.map(l => l.trim()));
      } else {
        setOllamaStatus('disconnected');
        setAvailableModels([]);
      }
    } catch {
      setOllamaStatus('disconnected');
      setAvailableModels([]);
    }
  };

  const handleTriage = async () => {
    if (findings.length === 0) {
      addNotification({ type: 'warning', title: 'No Findings', message: 'Run a playbook to generate findings first' });
      return;
    }
    setTriaging(true);
    try {
      const output = await runSecwinCommand(['ai', 'triage-batch', '--ollama-url', 'http://localhost:11434', '--model', selectedModel]);
      if (output.exit_code !== 0) {
        throw new Error(output.stderr || 'Triage failed');
      }

      // Parse batch triage results
      const results = JSON.parse(output.stdout);
      setTriageResults(results.map((r: any, i: number) => ({
        findingId: findings[i]?.id || `finding-${i}`,
        originalSeverity: findings[i]?.severity || 'info',
        suggestedSeverity: r.severity || 'info',
        confidence: r.confidence || 0.5,
        reasoning: r.reasoning || 'AI analysis based on MITRE ATT&CK context and evidence patterns',
        mitreTags: r.mitre_mapping || findings[i]?.mitre_techniques || [],
        recommendedActions: r.recommended_actions || ['Investigate further', 'Collect additional evidence', 'Document in report'],
      })));
      addNotification({ type: 'success', title: 'Triage Complete', message: `Analyzed ${results.length} findings` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Triage Failed', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setTriaging(false);
    }
  };

  const filteredResults = triageResults.filter((result) => {
    const finding = findings.find(f => f.id === result.findingId);
    return filterSeverity === 'All' || finding?.severity === filterSeverity.toLowerCase();
  });

  const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
  const severityColors = {
    critical: 'bg-red-500/10 border-red-500 text-red-600',
    high: 'bg-orange-500/10 border-orange-500 text-orange-600',
    medium: 'bg-yellow-500/10 border-yellow-500 text-yellow-600',
    low: 'bg-green-500/10 border-green-500 text-green-600',
    info: 'bg-blue-500/10 border-blue-500 text-blue-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Insights
          </h1>
          <p className="text-muted-foreground">AI-powered finding triage and analysis using Ollama</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={setSelectedModel} disabled={ollamaStatus !== 'connected'}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={checkOllama} disabled={ollamaStatus === 'checking'}>
            <RefreshCw className={clsx('mr-2 h-4 w-4', ollamaStatus === 'checking' && 'animate-spin')} />
            {ollamaStatus === 'connected' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Disconnected'}
          </Button>
          <Button onClick={handleTriage} disabled={triaging || findings.length === 0 || ollamaStatus !== 'connected'}>
            <Sparkles className={clsx('mr-2 h-4 w-4', triaging && 'animate-spin')} />
            {triaging ? 'Triaging...' : 'Run AI Triage'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Ollama Status
            <Badge variant={ollamaStatus === 'connected' ? 'success' : ollamaStatus === 'checking' ? 'warning' : 'destructive'}>
              {ollamaStatus === 'connected' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Disconnected'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Selected Model</p>
              <p className="font-mono">{selectedModel}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Available Models</p>
              <p className="font-mono">{availableModels.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Findings to Analyze</p>
              <p className="font-mono">{findings.length}</p>
            </div>
          </div>
          {ollamaStatus === 'disconnected' && (
            <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-yellow-800 dark:text-yellow-200">
                Ollama is not running. Start Ollama locally to enable AI triage:
                <code className="ml-2 px-2 py-1 bg-yellow-500/20 rounded font-mono text-sm">ollama serve</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {triageResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Triage Results ({triageResults.length})</h2>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Severities</SelectItem>
                {severities.map((sev) => (
                  <SelectItem key={sev} value={sev.charAt(0).toUpperCase() + sev.slice(1)}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            {filteredResults.map((result) => {
              const finding = findings.find(f => f.id === result.findingId);
              const originalSev = finding?.severity || 'info';
              const colorClass = severityColors[originalSev as keyof typeof severityColors] || severityColors.info;
              const severityChanged = result.originalSeverity !== result.suggestedSeverity;

              return (
                <Card key={result.findingId} className={clsx('border-l-4', colorClass.replace('bg-', '').replace('text-', '').replace('border-', ''))}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{finding?.title || 'Unknown Finding'}</h3>
                          <Badge variant={originalSev === 'critical' ? 'destructive' : originalSev === 'high' ? 'warning' : originalSev === 'medium' ? 'secondary' : 'outline'}>
                            {originalSev.toUpperCase()}
                          </Badge>
                          {severityChanged && (
                            <Badge variant="info">
                              Suggested: {result.suggestedSeverity.toUpperCase()}
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-mono">
                            {Math.round(result.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{finding?.description || 'No description'}</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {result.mitreTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDetails(showDetails === result.findingId ? null : result.findingId)}
                        >
                          {showDetails === result.findingId ? 'Hide Details' : 'Show AI Analysis'}
                        </Button>
                      </div>
                    </div>

                    {showDetails === result.findingId && (
                      <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-4 animate-slide-down">
                        <div>
                          <h4 className="font-medium mb-2">AI Reasoning</h4>
                          <p className="text-sm">{result.reasoning}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Recommended Actions</h4>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {result.recommendedActions.map((action, i) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">MITRE ATT&CK Tags</h4>
                          <div className="flex flex-wrap gap-1">
                            {result.mitreTags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {triageResults.length === 0 && !triaging && (
        <Card className="text-center py-12">
          <CardContent>
            <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No triage results yet</h3>
            <p className="text-muted-foreground mt-1">Run AI triage to analyze your findings with Ollama</p>
            <Button className="mt-4" onClick={handleTriage} disabled={findings.length === 0 || ollamaStatus !== 'connected'}>
              <Sparkles className="mr-2 h-4 w-4" />
              Run AI Triage
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}