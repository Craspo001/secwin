'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { Separator } from '../components/ui/Separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { BookOpen, Play, Search, FileText, Code, Loader2, Eye } from 'lucide-react';

export function Playbooks() {
  const {
    playbooks,
    currentPlaybook,
    loadPlaybooks,
    loadPlaybookDetail,
    runPlaybook
  } = useStore();

  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<typeof playbooks[0] | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaybook) return;
    setRunning(true);
    setOutput('');
    try {
      await runPlaybook(selectedPlaybook.name, variables);
      setOutput('Playbook execution started...');
      setShowRunDialog(false);
    } catch (error) {
      setOutput(`Error: ${error}`);
    } finally {
      setRunning(false);
    }
  };

  const handleViewDetail = async (playbook: typeof playbooks[0]) => {
    setSelectedPlaybook(playbook);
    setVariables({});
    await loadPlaybookDetail(playbook.name);
    setShowRunDialog(true);
  };

  const filteredPlaybooks = playbooks.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playbooks</h1>
          <p className="text-muted-foreground">
            Orchestrate multi-tool security engagements with automated reporting
          </p>
        </div>
        <Button onClick={loadPlaybooks}>
          <Loader2 className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">All Categories</option>
              <option value="recon">Reconnaissance</option>
              <option value="enum">Enumeration</option>
              <option value="web">Web Application</option>
              <option value="ad">Active Directory</option>
              <option value="exploit">Exploitation</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Playbook List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Available Playbooks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPlaybooks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-2">No Playbooks Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try adjusting your search or filter.' : 'No playbooks configured yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredPlaybooks.map((playbook) => (
                <div key={playbook.name} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{playbook.name}</h3>
                          <Badge variant="secondary">v{playbook.version}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{playbook.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {playbook.mitre_tactics.map((tactic) => (
                            <Badge key={tactic} variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              {tactic}
                            </Badge>
                          ))}
                          {playbook.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetail(playbook)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button size="sm" onClick={() => handleViewDetail(playbook)}>
                        <Play className="h-4 w-4 mr-2" />
                        Run
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playbook Detail / Run Dialog */}
      {selectedPlaybook && (
        <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {selectedPlaybook.name} v{selectedPlaybook.version}
              </DialogTitle>
              <DialogDescription>{selectedPlaybook.description}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="config" className="h-[calc(100%-140px)]">
              <TabsList>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="h-full overflow-y-auto p-4">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">MITRE ATT&CK Tactics</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlaybook.mitre_tactics.map((tactic) => (
                        <Badge key={tactic} variant="outline">
                          <FileText className="h-3 w-3" />
                          {tactic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlaybook.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="steps" className="h-full overflow-y-auto p-4">
                {currentPlaybook && currentPlaybook.steps && currentPlaybook.steps.length > 0 ? (
                  <div className="space-y-4">
                    {currentPlaybook.steps.map((step: any, index: number) => (
                      <Card key={step.id || index} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                                  {index + 1}
                                </span>
                                <h4 className="font-semibold">{step.name || step.id}</h4>
                                <Badge variant="secondary">{step.tool}</Badge>
                              </div>
                              {step.args && step.args.length > 0 && (
                                <p className="font-mono text-sm text-muted-foreground ml-8">
                                  {step.args.join(' ')}
                                </p>
                              )}
                              {step.mitreTechniques && step.mitreTechniques.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2 ml-8">
                                  {step.mitreTechniques.map((tech: string) => (
                                    <Badge key={tech} variant="outline" className="text-xs">
                                      {tech}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Step details not available</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="variables" className="h-full overflow-y-auto p-4">
                {currentPlaybook && currentPlaybook.variables && Object.keys(currentPlaybook.variables).length > 0 ? (
                  <form onSubmit={handleRun} className="space-y-4">
                    {Object.entries(currentPlaybook.variables).map(([key, v]: [string, any]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`var-${key}`}>{key} {v.required && <span className="text-red-500">*</span>}</Label>
                        <Input
                          id={`var-${key}`}
                          value={variables[key] || (v.default ? String(v.default) : '')}
                          onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                          placeholder={v.description}
                          required={v.required}
                        />
                        {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                        {v.enum && v.enum.length > 0 && (
                          <p className="text-xs text-muted-foreground">Options: {v.enum.join(', ')}</p>
                        )}
                      </div>
                    ))}
                    <Separator />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowRunDialog(false)}>Cancel</Button>
                      <Button type="submit" disabled={running}>
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
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No variables required for this playbook</p>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setShowRunDialog(false)}>Cancel</Button>
                      <Button onClick={handleRun} disabled={running}>
                        {running ? 'Running...' : 'Run Playbook'}
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="output" className="h-full overflow-y-auto p-4 font-mono text-sm">
                <pre className="whitespace-pre-wrap text-muted-foreground">
                  {output || 'Playbook output will appear here...'}
                </pre>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}