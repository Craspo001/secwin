'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Badge } from '../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import { Loader2, Play, Download, BarChart3, Cpu, HardDrive, MemoryStick, Terminal, CheckCircle, TrendingUp, Package, BookOpen } from 'lucide-react'

interface BenchmarkResult {
  name: string
  iterations: number
  duration: string
  avg_duration: string
  min_duration: string
  max_duration: string
  success_rate: number
  memory_used: number
  timestamp: string
}

export function Benchmarks() {
  const { secwinAvailable, runSecwinCommand } = useStore()

  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'install' | 'playbook' | 'tool' | 'system' | 'results'>('install')

  const handleTabChange = (value: string) => {
    setSelectedTab(value as 'install' | 'playbook' | 'tool' | 'system' | 'results')
  }
  const [installTools, setInstallTools] = useState('nmap, nuclei, subfinder, httpx')
  const [installIterations, setInstallIterations] = useState(5)
  const [playbookName, setPlaybookName] = useState('external-recon')
  const [playbookIterations, setPlaybookIterations] = useState(3)
  const [toolName, setToolName] = useState('nmap')
  const [toolArgs, setToolArgs] = useState('-sS 192.168.1.0/24')
  const [toolIterations, setToolIterations] = useState(10)
  const [systemDuration, setSystemDuration] = useState(5)
  const [lastOutput, setLastOutput] = useState('')

  const runBenchmark = async (command: string) => {
    setRunning(command)
    setLastOutput('')
    try {
      const output = await runSecwinCommand(command.split(' '))
      setLastOutput(output.stdout)

      // Parse results from output
      parseResults(output.stdout)
    } catch (error) {
      setLastOutput(`Error: ${error}`)
    } finally {
      setRunning(null)
    }
  }

  const parseResults = (output: string) => {
    // Try to parse table output
    const lines = output.split('\n')
    const newResults: BenchmarkResult[] = []

    let inTable = false
    for (const line of lines) {
      if (line.includes('NAME') && line.includes('ITERATIONS')) {
        inTable = true
        continue
      }
      if (inTable && line.trim() && !line.startsWith('---')) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 7) {
          newResults.push({
            name: parts[0],
            iterations: parseInt(parts[1]) || 0,
            duration: parts[2],
            avg_duration: parts[3],
            min_duration: parts[4],
            max_duration: parts[5],
            success_rate: parseFloat(parts[6]) || 0,
            memory_used: parseFloat(parts[7]) * 1024 * 1024 || 0,
            timestamp: new Date().toISOString()
          })
        }
      }
    }

    if (newResults.length > 0) {
      setResults(prev => [...prev, ...newResults])
    }
  }

  const exportResults = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmarks-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearResults = () => {
    setResults([])
  }

  if (!secwinAvailable) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <Cpu className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-2">SecWin CLI Not Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Please install SecWin CLI to run benchmarks.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Benchmarks</h1>
          <p className="text-muted-foreground">
            Performance testing and optimization for SecWin components
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportResults} disabled={results.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
          <Button variant="outline" onClick={clearResults} disabled={results.length === 0}>
            Clear Results
          </Button>
        </div>
      </div>

      {/* Benchmark Tabs */}
      <Tabs defaultValue={selectedTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="install">
            <Package className="h-4 w-4 mr-2" />
            Install
          </TabsTrigger>
          <TabsTrigger value="playbook">
            <BookOpen className="h-4 w-4 mr-2" />
            Playbook
          </TabsTrigger>
          <TabsTrigger value="tool">
            <Terminal className="h-4 w-4 mr-2" />
            Tool
          </TabsTrigger>
          <TabsTrigger value="system">
            <Cpu className="h-4 w-4 mr-2" />
            System
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Install Benchmark */}
        <TabsContent value="install" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Tool Installation Benchmark
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="install-tools">Tools (comma-separated)</Label>
                <Input
                  id="install-tools"
                  value={installTools}
                  onChange={(e) => setInstallTools(e.target.value)}
                  placeholder="nmap, nuclei, subfinder, httpx"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="install-iterations">Iterations</Label>
                  <Input
                    id="install-iterations"
                    type="number"
                    value={installIterations}
                    onChange={(e) => setInstallIterations(parseInt(e.target.value) || 1)}
                    min={1}
                    max={20}
                  />
                </div>
              </div>
              <Button
                onClick={() => runBenchmark(`benchmark install ${installTools} --iterations ${installIterations}`)}
                disabled={running !== null}
              >
                {running === 'benchmark install' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Install Benchmark
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Playbook Benchmark */}
        <TabsContent value="playbook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Playbook Execution Benchmark
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="playbook-name">Playbook Name</Label>
                  <Input
                    id="playbook-name"
                    value={playbookName}
                    onChange={(e) => setPlaybookName(e.target.value)}
                    placeholder="external-recon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="playbook-iterations">Iterations</Label>
                  <Input
                    id="playbook-iterations"
                    type="number"
                    value={playbookIterations}
                    onChange={(e) => setPlaybookIterations(parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                  />
                </div>
              </div>
              <Button
                onClick={() => runBenchmark(`benchmark playbook ${playbookName} --iterations ${playbookIterations}`)}
                disabled={running !== null}
              >
                {running === 'benchmark playbook' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Playbook Benchmark
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tool Benchmark */}
        <TabsContent value="tool" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Tool Execution Benchmark
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tool-name">Tool Name</Label>
                  <Input
                    id="tool-name"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    placeholder="nmap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-args">Arguments</Label>
                  <Input
                    id="tool-args"
                    value={toolArgs}
                    onChange={(e) => setToolArgs(e.target.value)}
                    placeholder="-sS 192.168.1.0/24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-iterations">Iterations</Label>
                  <Input
                    id="tool-iterations"
                    type="number"
                    value={toolIterations}
                    onChange={(e) => setToolIterations(parseInt(e.target.value) || 1)}
                    min={1}
                    max={50}
                  />
                </div>
              </div>
              <Button
                onClick={() => runBenchmark(`benchmark tool ${toolName} ${toolArgs} --iterations ${toolIterations}`)}
                disabled={running !== null}
              >
                {running === 'benchmark tool' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Tool Benchmark
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Benchmark */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                System Benchmark
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-duration">Duration (seconds)</Label>
                <Input
                  id="system-duration"
                  type="number"
                  value={systemDuration}
                  onChange={(e) => setSystemDuration(parseInt(e.target.value) || 5)}
                  min={1}
                  max={60}
                />
              </div>
              <Button
                onClick={() => runBenchmark(`benchmark system --duration ${systemDuration}s`)}
                disabled={running !== null}
              >
                {running === 'benchmark system' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run System Benchmark
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <Cpu className="h-10 w-10 mx-auto text-primary mb-2" />
                <h3 className="font-medium">CPU</h3>
                <p className="text-sm text-muted-foreground">Computational throughput</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <MemoryStick className="h-10 w-10 mx-auto text-blue-500 mb-2" />
                <h3 className="font-medium">Memory</h3>
                <p className="text-sm text-muted-foreground">Allocation throughput</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <HardDrive className="h-10 w-10 mx-auto text-green-500 mb-2" />
                <h3 className="font-medium">Disk I/O</h3>
                <p className="text-sm text-muted-foreground">Read/write performance</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results */}
        <TabsContent value="results" className="space-y-4">
          {results.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Benchmark Results</h3>
                <p className="text-sm text-muted-foreground">
                  Run a benchmark from the tabs above to see results here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Benchmark Results ({results.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tool/Component</TableHead>
                          <TableHead>Iterations</TableHead>
                          <TableHead>Avg Duration</TableHead>
                          <TableHead>Min Duration</TableHead>
                          <TableHead>Max Duration</TableHead>
                          <TableHead>Success Rate</TableHead>
                          <TableHead>Memory</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{result.name}</TableCell>
                            <TableCell>{result.iterations}</TableCell>
                            <TableCell className="font-mono">{result.avg_duration}</TableCell>
                            <TableCell className="font-mono">{result.min_duration}</TableCell>
                            <TableCell className="font-mono">{result.max_duration}</TableCell>
                            <TableCell>
                              <Badge variant={result.success_rate === 1 ? 'success' : result.success_rate > 0.5 ? 'warning' : 'destructive'}>
                                {Math.round(result.success_rate * 100)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              {(result.memory_used / 1024 / 1024).toFixed(1)} MB
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(result.timestamp).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Benchmarks</p>
                        <p className="text-3xl font-bold">{results.length}</p>
                      </div>
                      <BarChart3 className="h-10 w-10 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg Success Rate</p>
                        <p className="text-3xl font-bold text-green-500">
                          {Math.round(results.reduce((a, b) => a + b.success_rate, 0) / results.length * 100)}%
                        </p>
                      </div>
                      <CheckCircle className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Fastest Avg</p>
                        <p className="text-3xl font-bold text-blue-500">
                          {results.reduce((a, b) => {
                            const aNs = parseDuration(a.avg_duration)
                            const bNs = parseDuration(b.avg_duration)
                            return aNs < bNs ? a : b
                          }).name}
                        </p>
                      </div>
                      <TrendingUp className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Memory</p>
                        <p className="text-3xl font-bold text-purple-500">
                          {(results.reduce((a, b) => a + b.memory_used, 0) / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <MemoryStick className="h-10 w-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Raw Output */}
          {lastOutput && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Last Output
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

function parseDuration(str: string): number {
  const match = str.match(/([\d.]+)(\w+)/)
  if (!match) return Infinity
  const value = parseFloat(match[1])
  const unit = match[2]
  switch (unit) {
    case 'ns': return value
    case 'µs': return value * 1000
    case 'ms': return value * 1000000
    case 's': return value * 1000000000
    default: return value
  }
}