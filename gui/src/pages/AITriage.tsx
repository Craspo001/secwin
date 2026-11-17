'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Loader2, Brain, Search, Eye, AlertTriangle, CheckCircle, Sparkles, RefreshCw, FileText, Terminal } from 'lucide-react';
import { clsx } from 'clsx';

interface TriageResult {
  finding_id: string
  summary: string
  severity: string
  confidence: number
  impact: string
  likelihood: string
  recommendations: string[]
  mitre_mapping: string[]
  cvss_vector: string
  risk_score: number
  false_positive: boolean
  context: Record<string, string>
  analyzed_at: string
}

interface BatchTriageResponse {
  results: TriageResult[]
  summary: string
  analyzed_at: string
}

export function AITriage() {
  const { findings, evidenceArtifacts, activeProfile, opsecStatus, runSecwinCommand } = useStore();

  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState('llama3.1:8b')
  const [selectedFinding, setSelectedFinding] = useState<typeof findings[0] | null>(null)
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)
  const [batchResults, setBatchResults] = useState<TriageResult[]>([])
  const [batchSummary, setBatchSummary] = useState('')
  const [running, setRunning] = useState<'single' | 'batch' | 'models' | null>(null)
  const [context, setContext] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [lastOutput, setLastOutput] = useState('')

  const generateContext = () => {
    let ctx = ''
    if (activeProfile) {
      ctx += `Active Profile: ${activeProfile}\n`
    }
    if (opsecStatus) {
      ctx += `VPN: ${opsecStatus.vpn || 'None'}\n`
      ctx += `Hostname: ${opsecStatus.hostname}\n`
      ctx += `Timezone: ${opsecStatus.timezone || 'System'}\n`
      ctx += `DNS: ${opsecStatus.dns || 'Auto'}\n`
      ctx += `Proxy: ${opsecStatus.http_proxy || 'None'}\n`
    }
    ctx += `\nTotal Findings: ${findings.length}\n`
    ctx += `Evidence Artifacts: ${evidenceArtifacts.length}\n`
    return ctx
  }

  const runSingleTriage = async () => {
    if (!selectedFinding) return
    setRunning('single')
    setTriageResult(null)
    setLastOutput('')

    try {
      const ctx = context || generateContext()
      const output = await runSecwinCommand([
        'ai', 'triage', selectedFinding.id,
        '--ollama-url', ollamaUrl,
        '--model', model,
        '--context', ctx
      ])
      setLastOutput(output.stdout)

      // Parse result
      try {
        const result = JSON.parse(output.stdout)
        setTriageResult(result)
      } catch {
        setLastOutput('Failed to parse result: ' + output.stdout)
      }
    } catch (error) {
      setLastOutput(`Error: ${error}`)
    } finally {
      setRunning(null)
    }
  }

  const runBatchTriage = async () => {
    if (findings.length === 0) return
    setRunning('batch')
    setBatchResults([])
    setBatchSummary('')
    setLastOutput('')

    try {
      const ctx = context || generateContext()
      const output = await runSecwinCommand([
        'ai', 'triage-batch',
        '--ollama-url', ollamaUrl,
        '--model', model,
        '--context', ctx
      ])
      setLastOutput(output.stdout)

      try {
        const response: BatchTriageResponse = JSON.parse(output.stdout)
        setBatchResults(response.results)
        setBatchSummary(response.summary)
      } catch {
        setLastOutput('Failed to parse batch result: ' + output.stdout)
      }
    } catch (error) {
      setLastOutput(`Error: ${error}`)
    } finally {
      setRunning(null)
    }
  }

  const fetchModels = async () => {
    setRunning('models')
    try {
      const output = await runSecwinCommand([
        'ai', 'models',
        '--ollama-url', ollamaUrl
      ])
      setLastOutput(output.stdout)
      // Parse models from output
      const lines = output.stdout.split('\n').filter(l => l.trim().startsWith('  '))
      setAvailableModels(lines.map(l => l.trim()))
    } catch (error) {
      setLastOutput(`Error: ${error}`)
    } finally {
      setRunning(null)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-100 dark:bg-red-900/30'
      case 'high': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30'
      case 'medium': return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
      case 'low': return 'text-green-500 bg-green-100 dark:bg-green-900/30'
      case 'info': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30'
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500'
    if (confidence >= 0.5) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Triage
          </h1>
          <p className="text-muted-foreground">
            Automated finding analysis and prioritization using Ollama LLMs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchModels} disabled={running !== null}>
            <RefreshCw className={clsx('h-4 w-4 mr-2', running === 'models' && 'animate-spin')} />
            Refresh Models
          </Button>
        </div>
      </div>

      {/* Ollama Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Ollama Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ollama-url">Ollama URL</Label>
              <Input
                id="ollama-url"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ollama-model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="ollama-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                  <SelectItem value="llama3.1:8b">llama3.1:8b (default)</SelectItem>
                  <SelectItem value="llama3.1:70b">llama3.1:70b</SelectItem>
                  <SelectItem value="mistral:7b">mistral:7b</SelectItem>
                  <SelectItem value="codellama:7b">codellama:7b</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Button variant="outline" onClick={fetchModels} disabled={running === 'models'} className="w-full">
                {running === 'models' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {availableModels.length > 0 ? `${availableModels.length} models` : 'Check connection'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {availableModels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableModels.map(m => (
                <Badge key={m} variant="secondary" className="text-xs">
                  {m}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Engagement Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={context}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContext(e.target.value)}
            placeholder="Optional: Provide additional context about the engagement..."
            className="font-mono text-sm"
            rows={4}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setContext(generateContext())}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Auto-generate from current profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => setContext('')}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Triage Tabs */}
      <Tabs defaultValue="single" className="w-full">
        <TabsList>
          <TabsTrigger value="single">
            <Search className="h-4 w-4 mr-2" />
            Single Finding
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Sparkles className="h-4 w-4 mr-2" />
            Batch Triage
          </TabsTrigger>
          <TabsTrigger value="results">
            <Brain className="h-4 w-4 mr-2" />
            Results History
          </TabsTrigger>
        </TabsList>

        {/* Single Finding Triage */}
        <TabsContent value="single" className="space-y-4">
          {findings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Findings Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Run a playbook to generate findings, or load findings from an evidence directory.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Select Finding to Triage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {findings.map(finding => (
                      <Button
                        key={finding.id}
                        variant={selectedFinding?.id === finding.id ? 'default' : 'outline'}
                        className="w-full justify-start gap-3"
                        onClick={() => setSelectedFinding(finding)}
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{finding.title}</span>
                            <Badge className={getSeverityColor(finding.severity)}>{finding.severity}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{finding.description}</p>
                        </div>
                        {selectedFinding?.id === finding.id && <CheckCircle className="h-4 w-4 text-primary" />}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedFinding && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Triage Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={runSingleTriage}
                      disabled={running !== null}
                      className="w-full"
                    >
                      {running === 'single' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-4 w-4" />
                          Run AI Triage
                        </>
                      )}
                    </Button>

                    {triageResult && (
                      <div className="space-y-4 border-t pt-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Severity</p>
                            <Badge className={getSeverityColor(triageResult.severity)}>{triageResult.severity.toUpperCase()}</Badge>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Confidence</p>
                            <p className={clsx('font-mono text-lg', getConfidenceColor(triageResult.confidence))}>
                              {Math.round(triageResult.confidence * 100)}%
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Risk Score</p>
                            <p className="font-mono text-lg text-purple-500">{triageResult.risk_score.toFixed(1)}/10</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Summary</p>
                          <p>{triageResult.summary}</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Impact</p>
                            <p className="text-sm">{triageResult.impact}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Likelihood</p>
                            <p className="text-sm">{triageResult.likelihood}</p>
                          </div>
                        </div>

                        {triageResult.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Recommendations</p>
                            <ul className="space-y-1 list-disc list-inside text-sm">
                              {triageResult.recommendations.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {triageResult.mitre_mapping.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">MITRE ATT&CK</p>
                            <div className="flex flex-wrap gap-2">
                              {triageResult.mitre_mapping.map(t => (
                                <Badge key={t} variant="outline">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {triageResult.cvss_vector && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">CVSS Vector</p>
                            <code className="font-mono text-xs bg-muted p-2 rounded block">{triageResult.cvss_vector}</code>
                          </div>
                        )}

                        {triageResult.false_positive && (
                          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="font-medium">Potential False Positive</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Batch Triage */}
        <TabsContent value="batch" className="space-y-4">
          {findings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Findings to Triage</h3>
                <p className="text-sm text-muted-foreground">
                  Run a playbook to generate findings first.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Batch Triage ({findings.length} findings)</span>
                    <Badge variant={batchResults.length > 0 ? 'success' : 'secondary'}>
                      {batchResults.length} completed
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={runBatchTriage}
                    disabled={running !== null || findings.length === 0}
                    className="w-full"
                  >
                    {running === 'batch' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Triaging {findings.length} findings...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Run Batch Triage
                      </>
                    )}
                  </Button>

                  {batchSummary && (
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm">{batchSummary}</p>
                    </div>
                  )}

                  {batchResults.length > 0 && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {batchResults.map((result, index) => (
                        <Card key={index} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{findings[index]?.title || result.finding_id}</span>
                                  <Badge className={getSeverityColor(result.severity)}>{result.severity}</Badge>
                                  <span className={clsx('text-xs font-mono', getConfidenceColor(result.confidence))}>
                                    {Math.round(result.confidence * 100)}%
                                  </span>
                                  {result.false_positive && (
                                    <Badge variant="destructive">FP</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">{result.summary}</p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => setTriageResult(result)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Results History */}
        <TabsContent value="results" className="space-y-4">
          {(triageResult || batchResults.length > 0) ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {triageResult && (
                  <div className="mb-6 p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">Single Finding Analysis</h4>
                    <pre className="font-mono text-sm max-h-60 overflow-y-auto">{JSON.stringify(triageResult, null, 2)}</pre>
                  </div>
                )}

                {batchResults.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Batch Results ({batchResults.length})</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Finding ID</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Confidence</TableHead>
                            <TableHead>Risk Score</TableHead>
                            <TableHead>False Positive</TableHead>
                            <TableHead>MITRE</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchResults.map((result, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-sm">{result.finding_id}</TableCell>
                              <TableCell><Badge className={getSeverityColor(result.severity)}>{result.severity}</Badge></TableCell>
                              <TableCell className={getConfidenceColor(result.confidence)}>{Math.round(result.confidence * 100)}%</TableCell>
                              <TableCell className="font-mono text-purple-500">{result.risk_score.toFixed(1)}</TableCell>
                              <TableCell>{result.false_positive ? '⚠️ Yes' : 'No'}</TableCell>
                              <TableCell>{result.mitre_mapping.slice(0, 3).join(', ')}{result.mitre_mapping.length > 3 ? '...' : ''}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Analysis Results</h3>
                <p className="text-sm text-muted-foreground">
                  Run a single or batch triage to see results here.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Raw Output */}
          {lastOutput && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Raw Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted/50 font-mono text-sm max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {lastOutput}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}