'use client';

import { useParams, useNavigate } from 'react-router-dom';
import { useSecWin } from '../hooks/useSecWin';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import {
  FileText,
  Play,
  ArrowLeft,
  Code2,
  GitBranch,
  ChevronDown,
  Edit,
  Settings,
  CodeXml,
} from 'lucide-react';
import { Playbook, Step, Variable } from '../hooks/useSecWin';
import { useState, useEffect } from 'react';

export function PlaybookDetail() {
  const { playbooks } = useSecWin();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      const pb = playbooks.find(p => p.metadata.name === id);
      if (pb) {
        setPlaybook(pb);
      } else {
        navigate('/playbooks');
      }
    }
  }, [id, playbooks, navigate]);

  if (!playbook) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const { metadata, variables, steps, outputs } = playbook;
  const stepCount = steps.length;
  const varCount = Object.keys(variables).length;
  const mitreTactics = metadata.mitreTactics || [];

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSteps(new Set(steps.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/playbooks')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            {metadata.name}
            <Badge variant="default">{metadata.version}</Badge>
          </h1>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button asChild variant="default">
            <NavLink to={`/playbooks/${metadata.name}/run`}>
              <Play className="mr-2 h-4 w-4" />
              Run Playbook
            </NavLink>
          </Button>
          <Button variant="outline" asChild>
            <NavLink to={`/playbooks/${metadata.name}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </NavLink>
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metadata.description && (
              <p className="text-muted-foreground">{metadata.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {metadata.author && (
                <Badge variant="info">By {metadata.author}</Badge>
              )}
              <Badge variant="default">{stepCount} steps</Badge>
              <Badge variant="default">{varCount} variables</Badge>
              {mitreTactics.map(tactic => (
                <Badge key={tactic} variant="mitre">{tactic}</Badge>
              ))}
              {metadata.tags && metadata.tags.map(tag => (
                <Badge key={tag} variant="default">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Variables ({varCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {varCount === 0 ? (
              <p className="text-muted-foreground text-sm">No variables defined</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(variables).map(([key, v]) => (
                  <VariableRow key={key} name={key} variable={v} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Outputs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outputs ? (
              <div className="space-y-3">
                {outputs.report && (
                  <OutputRow label="Report" value={outputs.report} formats={outputs.formats} />
                )}
                {outputs.findings && (
                  <OutputRow label="Findings" value={outputs.findings} />
                )}
                {outputs.evidenceDir && (
                  <OutputRow label="Evidence Dir" value={outputs.evidenceDir} />
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No outputs configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CodeXml className="h-5 w-5" />
            Steps ({stepCount})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stepCount === 0 ? (
            <p className="text-muted-foreground text-center py-8">No steps defined</p>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  isExpanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStep(step.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw YAML */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Raw YAML
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto max-h-96">
            <code className="text-sm font-mono text-foreground">
              {JSON.stringify(playbook, null, 2)}
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function VariableRow({ name, variable }: { name: string; variable: Variable }) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 flex-wrap">
        <code className="font-mono text-sm bg-background px-1.5 py-0.5 rounded border">{name}</code>
        <Badge variant="default" className="text-xs capitalize">{variable.type}</Badge>
        {variable.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
        {variable.secret && <Badge variant="warning" className="text-xs">Secret</Badge>}
      </div>
      {variable.description && (
        <p className="mt-1 text-xs text-muted-foreground">{variable.description}</p>
      )}
      {variable.default !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">
          Default: <code className="font-mono">{String(variable.default)}</code>
        </p>
      )}
      {variable.enum && variable.enum.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Values: {variable.enum.join(', ')}
        </p>
      )}
      {variable.validation && (
        <p className="mt-1 text-xs text-muted-foreground">
          Validation: <code className="font-mono">{variable.validation}</code>
        </p>
      )}
    </div>
  );
}

function OutputRow({ label, value, formats }: { label: string; value: string; formats?: string[] }) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <code className="font-mono text-sm truncate block">{value}</code>
      {formats && formats.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Formats: {formats.join(', ')}
        </p>
      )}
    </div>
  );
}

function StepCard({ step, index, isExpanded, onToggle }: { step: Step; index: number; isExpanded: boolean; onToggle: () => void }) {
  const hasParallel = step.parallel && step.parallel.length > 0;
  const hasForeach = !!step.foreach;
  const hasIf = !!step.if;
  const hasTry = !!step.try;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 bg-muted/50 flex items-center gap-3" onClick={onToggle}>
        <span className="text-xs text-muted-foreground font-mono w-6 text-right">{index + 1}.</span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium truncate">{step.name}</span>
          <Badge variant="mitre" className="text-xs">{step.tool || (hasParallel ? 'Parallel' : hasForeach ? 'Foreach' : hasIf ? 'If' : hasTry ? 'Try' : 'Control Flow')}</Badge>
          {step.mitreTechniques && step.mitreTechniques.length > 0 && (
            <Badge variant="info" className="text-xs">
              {step.mitreTechniques.join(', ')}
            </Badge>
          )}
          {step.condition && <Badge variant="warning" className="text-xs">Conditional</Badge>}
          {step.retry && step.retry > 0 && <Badge variant="info" className="text-xs">Retry: {step.retry}</Badge>}
          {step.timeout && <Badge variant="default" className="text-xs">Timeout: {step.timeout}</Badge>}
          {hasParallel && <Badge variant="default" className="text-xs">Parallel ({step.parallel!.length})</Badge>}
        </div>
        <span className={cn('transition-transform', isExpanded && 'rotate-180')}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 border-t animate-slide-down">
          {step.args && step.args.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Arguments</p>
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto">
                <code className="font-mono text-sm">{step.args.join(' ')}</code>
              </pre>
            </div>
          )}

          {step.env && Object.keys(step.env).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Environment</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(step.env).map(([key, value]) => (
                  <div key={key} className="p-2 bg-muted rounded">
                    <code className="font-mono text-xs">{key}</code>
                    <span className="ml-2 text-sm text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.workingDir && (
            <div className="p-2 bg-muted rounded">
              <p className="text-xs text-muted-foreground mb-1">Working Directory</p>
              <code className="font-mono text-sm">{step.workingDir}</code>
            </div>
          )}

          {step.artifacts && step.artifacts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Artifacts</p>
              <div className="flex flex-wrap gap-1">
                {step.artifacts.map((artifact, i) => (
                  <Badge key={i} variant="default" className="text-xs">{artifact}</Badge>
                ))}
              </div>
            </div>
          )}

          {step.continueOnError && (
            <Badge variant="warning" className="text-xs">Continue on Error</Badge>
          )}

          {/* Parallel steps */}
          {hasParallel && (
            <div className="border-l-2 border-primary pl-4 ml-2 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Parallel Steps:</p>
              {step.parallel!.map((pStep) => (
                <div key={pStep.id} className="p-2 bg-muted/50 rounded text-sm">
                  <span className="font-medium">{pStep.name}</span>
                  <Badge variant="mitre" className="ml-2 text-xs">{pStep.tool}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Foreach */}
          {hasForeach && step.foreach && (
            <div className="border-l-2 border-green-500 pl-4 ml-2 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Foreach: {step.foreach.variable} in {step.foreach.in}</p>
              {step.foreach.steps.map((fStep) => (
                <div key={fStep.id} className="p-2 bg-muted/50 rounded text-sm">
                  <span className="font-medium">{fStep.name}</span>
                  <Badge variant="mitre" className="ml-2 text-xs">{fStep.tool}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* If */}
          {hasIf && step.if && (
            <div className="border-l-2 border-yellow-500 pl-4 ml-2 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Condition: {step.if.condition}</p>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Then:</p>
                {step.if.then.map((tStep) => (
                  <div key={tStep.id} className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                    <span className="font-medium">{tStep.name}</span>
                    <Badge variant="mitre" className="ml-2 text-xs">{tStep.tool}</Badge>
                  </div>
                ))}
              </div>
              {step.if.else && step.if.else.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Else:</p>
                  {step.if.else.map((eStep) => (
                    <div key={eStep.id} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                      <span className="font-medium">{eStep.name}</span>
                      <Badge variant="mitre" className="ml-2 text-xs">{eStep.tool}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Try */}
          {hasTry && step.try && (
            <div className="border-l-2 border-purple-500 pl-4 ml-2 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Try Block:</p>
              {step.try.steps.map((tStep) => (
                <div key={tStep.id} className="p-2 bg-muted/50 rounded text-sm">
                  <span className="font-medium">{tStep.name}</span>
                  <Badge variant="mitre" className="ml-2 text-xs">{tStep.tool}</Badge>
                </div>
              ))}
              {step.try.catch && step.try.catch.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Catch:</p>
                  {step.try.catch.map((cStep) => (
                    <div key={cStep.id} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                      <span className="font-medium">{cStep.name}</span>
                      <Badge variant="mitre" className="ml-2 text-xs">{cStep.tool}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {step.try.finally && step.try.finally.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Finally:</p>
                  {step.try.finally.map((fStep) => (
                    <div key={fStep.id} className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                      <span className="font-medium">{fStep.name}</span>
                      <Badge variant="mitre" className="ml-2 text-xs">{fStep.tool}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// NavLink import for the buttons
import { NavLink } from 'react-router-dom';