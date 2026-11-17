'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSecWin } from '../hooks/useSecWin';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { cn } from '../utils/cn';
import {
  Play,
  StopCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Terminal,
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { Playbook, Variable, StepResult, Finding } from '../hooks/useSecWin';

export function PlaybookRun() {
  const { playbooks, runPlaybook, isLoading } = useSecWin();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    output: string;
    error?: string;
    duration: string;
    stepResults: Record<string, StepResult>;
    findings: Finding[];
    reportPath?: string;
  } | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      const pb = playbooks.find(p => p.metadata.name === id);
      if (pb) {
        setPlaybook(pb);
        // Initialize variables with defaults
        const initialVars: Record<string, string> = {};
        Object.entries(pb.variables).forEach(([key, v]) => {
          if (v.default !== undefined) {
            initialVars[key] = String(v.default);
          }
        });
        setVariables(initialVars);
      } else {
        navigate('/playbooks');
      }
    }
  }, [id, playbooks, navigate]);

  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };

  const validateVariables = (): string[] => {
    const errors: string[] = [];
    Object.entries(playbook?.variables || {}).forEach(([key, v]) => {
      if (v.required && (!variables[key] || variables[key].trim() === '')) {
        errors.push(`Required variable "${key}" is not set`);
      }
      if (v.validation && variables[key]) {
        try {
          const regex = new RegExp(v.validation);
          if (!regex.test(variables[key])) {
            errors.push(`Variable "${key}" does not match pattern: ${v.validation}`);
          }
        } catch {
          errors.push(`Invalid validation regex for "${key}"`);
        }
      }
      if (v.enum && v.enum.length > 0 && variables[key] && !v.enum.includes(variables[key])) {
        errors.push(`Variable "${key}" must be one of: ${v.enum.join(', ')}`);
      }
    });
    return errors;
  };

  const handleRun = async () => {
    if (!playbook) return;

    const errors = validateVariables();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    setRunning(true);
    setResult(null);
    setLogs([]);
    setCurrentStep('Initializing...');
    setExpandedSteps(new Set(playbook.steps.map(s => s.id)));

    try {
      const playbookResult = await runPlaybook(
        `playbooks/${playbook.metadata.name}.yaml`,
        variables
      );

      setResult({
        success: playbookResult.success,
        output: playbookResult.error || 'Completed',
        error: playbookResult.error,
        duration: playbookResult.duration,
        stepResults: playbookResult.stepResults,
        findings: playbookResult.findings,
        reportPath: playbookResult.reportPath,
      });
    } catch (err) {
      setResult({
        success: false,
        output: '',
        error: err instanceof Error ? err.message : 'Unknown error',
        duration: '0s',
        stepResults: {},
        findings: [],
      });
    } finally {
      setRunning(false);
      setCurrentStep('');
    }
  };

  const handleCancel = () => {
    // TODO: Implement cancellation via Tauri
    setRunning(false);
    setCurrentStep('');
  };

  if (!playbook) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const validationErrors = validateVariables();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/playbooks')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Playbooks
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Play className="h-8 w-8 text-primary" />
            Run: {playbook.metadata.name}
          </h1>
          <p className="text-muted-foreground mt-1">{playbook.metadata.description || 'No description'}</p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Validation Errors</p>
                <ul className="mt-2 list-disc list-inside text-sm text-destructive/80">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variables Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(playbook.variables).length === 0 ? (
            <p className="text-muted-foreground">No variables required for this playbook.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(playbook.variables).map(([key, v]) => (
                <VariableInput
                  key={key}
                  name={key}
                  variable={v}
                  value={variables[key] || ''}
                  onChange={handleVariableChange}
                  error={validationErrors.some(e => e.includes(key))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Button */}
      <div className="flex gap-4">
        <Button
          size="lg"
          onClick={handleRun}
          disabled={running || validationErrors.length > 0 || isLoading}
          className="flex-1 max-w-md"
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Playbook
            </>
          )}
        </Button>
        {running && (
          <Button size="lg" variant="destructive" onClick={handleCancel}>
            <StopCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>

      {/* Current Step */}
      {running && currentStep && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <div>
                <p className="font-medium">Executing step...</p>
                <p className="text-sm text-muted-foreground font-mono">{currentStep}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <Card className={cn(result.success ? 'border-green-500' : 'border-red-500')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-xl', result.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                    {result.success ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{result.success ? 'Playbook Completed' : 'Playbook Failed'}</h3>
                    <p className="text-muted-foreground">{playbook.metadata.name} v{playbook.metadata.version}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-mono font-bold">{result.duration}</p>
                  <p className="text-sm text-muted-foreground">Total Duration</p>
                </div>
              </div>
              {result.error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="font-medium text-red-800 dark:text-red-200">Error</p>
                  <pre className="mt-2 text-sm text-red-700 dark:text-red-300 font-mono overflow-x-auto">{result.error}</pre>
                </div>
              )}
              {result.reportPath && (
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="success">Report Generated</Badge>
                  <code className="font-mono text-sm text-muted-foreground">{result.reportPath}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Step Results ({Object.keys(result.stepResults).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {playbook.steps.map((step) => {
                  const stepResult = result.stepResults[step.id];
                  const isExpanded = expandedSteps.has(step.id);
                  return (
                    <StepResultCard
                      key={step.id}
                      step={step}
                      result={stepResult}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedSteps(prev => {
                        const next = new Set(prev);
                        if (next.has(step.id)) next.delete(step.id);
                        else next.add(step.id);
                        return next;
                      })}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Findings */}
          {result.findings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Findings ({result.findings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.findings.map((finding, index) => (
                    <FindingCard key={index} finding={finding} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Execution Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-black/90 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm text-green-300">
                  <pre>{logs.join('\n')}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function VariableInput({ name, variable, value, onChange, error }: {
  name: string;
  variable: Variable;
  value: string;
  onChange: (key: string, value: string) => void;
  error: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange(name, e.target.value);
  };

  if (variable.type === 'boolean') {
    return (
      <div className={cn('p-3 rounded-lg border', error && 'border-destructive')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(name, e.target.checked.toString())}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="font-medium">{name}</span>
          {variable.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
        </label>
        {variable.description && <p className="mt-1 text-xs text-muted-foreground">{variable.description}</p>}
      </div>
    );
  }

  if (variable.enum && variable.enum.length > 0) {
    return (
      <div className={cn('p-3 rounded-lg border', error && 'border-destructive')}>
        <label className="block text-sm font-medium mb-1">{name}</label>
        <Select value={value} onValueChange={(v) => onChange(name, v)}>
          <SelectTrigger>
            <SelectValue placeholder={variable.description || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {variable.enum.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {variable.description && <p className="mt-1 text-xs text-muted-foreground">{variable.description}</p>}
      </div>
    );
  }

  if (variable.type === 'string' && variable.validation) {
    return (
      <div className={cn('p-3 rounded-lg border', error && 'border-destructive')}>
        <label className="block text-sm font-medium mb-1">{name}</label>
        <Input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={variable.description}
          className={cn(error && 'border-destructive focus:ring-destructive')}
        />
        {variable.description && <p className="mt-1 text-xs text-muted-foreground">{variable.description}</p>}
        {error && <p className="mt-1 text-xs text-destructive">Invalid value</p>}
      </div>
    );
  }

  return (
    <div className={cn('p-3 rounded-lg border', error && 'border-destructive')}>
      <label className="block text-sm font-medium mb-1">
        {name} {variable.required && <span className="text-destructive">*</span>}
      </label>
      <Input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={variable.description}
        className={cn(error && 'border-destructive focus:ring-destructive')}
      />
      {variable.description && <p className="mt-1 text-xs text-muted-foreground">{variable.description}</p>}
    </div>
  );
}

function StepResultCard({ step, result, isExpanded, onToggle }: {
  step: any;
  result: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (!result) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3 text-muted-foreground">
        <span className="font-mono text-xs w-6">{step.id}</span>
        <span>{step.name}</span>
        <Badge variant="default">Pending</Badge>
      </div>
    );
  }

  const success = result.success;
  const duration = result.duration || '0s';

  return (
    <div className={cn('border rounded-lg overflow-hidden', success ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800')}>
      <div className={cn('p-3 flex items-center gap-3 cursor-pointer', success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')} onClick={onToggle}>
        <span className="font-mono text-xs w-6">{step.id}</span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium truncate">{step.name}</span>
          <Badge variant={success ? 'success' : 'destructive'} className="text-xs">
            {success ? 'Success' : 'Failed'}
          </Badge>
          <Badge variant="mitre" className="text-xs">{step.tool}</Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{duration}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3 border-t animate-slide-down">
          {result.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
              <pre className="text-sm text-red-700 dark:text-red-300 font-mono overflow-x-auto">{result.error}</pre>
            </div>
          )}
          {result.output && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Output</p>
              <pre className="bg-black/90 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-sm text-green-300">
                <code>{result.output}</code>
              </pre>
            </div>
          )}
          {result.artifacts && Object.keys(result.artifacts).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Artifacts</p>
              <div className="space-y-1">
                {Object.entries(result.artifacts).map(([name, path]) => (
                  <div key={name} className="p-2 bg-muted rounded flex items-center justify-between text-sm">
                    <code className="font-mono">{name}</code>
                    <code className="font-mono text-muted-foreground truncate max-w-[300px]">{path as string}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.retries && result.retries > 0 && (
            <Badge variant="warning" className="text-xs">Retries: {result.retries}</Badge>
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const severityColors = {
    critical: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    high: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    medium: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  };

  const severityBadges = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'warning',
    low: 'success',
    info: 'info',
  };

  return (
    <div className={cn('p-4 rounded-lg border-l-4', severityColors[finding.severity])}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{finding.title}</h4>
            <Badge variant={severityBadges[finding.severity] as any} className="text-xs capitalize">
              {finding.severity}
            </Badge>
            {finding.mitreTechniques.map(t => (
              <Badge key={t} variant="mitre" className="text-xs">{t}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{finding.description}</p>
          {finding.stepId && (
            <p className="mt-1 text-xs text-muted-foreground">Step: <code className="font-mono">{finding.stepId}</code></p>
          )}
        </div>
      </div>
    </div>
  );
}