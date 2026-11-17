'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../components/ui/DropdownMenu';
import { FolderOpen, Download, RefreshCw, Shield, FileText, Hash, Eye, Copy, Loader2 } from 'lucide-react';

export function Evidence() {
  const {
    evidenceArtifacts,
    evidenceDir,
    loadEvidence,
    verifyEvidence,
    exportEvidence
  } = useStore();

  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [verifyDir, setVerifyDir] = useState('');
  const [verifyStrict, setVerifyStrict] = useState(false);
  const [exportDir, setExportDir] = useState('');
  const [exportOutput, setExportOutput] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'yaml'>('json');
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<typeof evidenceArtifacts[0] | null>(null);
  const [verificationResults, setVerificationResults] = useState<string>('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      await verifyEvidence(verifyDir || undefined, verifyStrict);
      setShowVerifyDialog(false);
    } catch (error) {
      setVerificationResults(`Error: ${error}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true);
    try {
      await exportEvidence(exportDir || undefined, exportOutput || undefined, exportFormat);
      setShowExportDialog(false);
    } catch (error) {
      setVerificationResults(`Error: ${error}`);
    } finally {
      setExporting(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence Locker</h1>
          <p className="text-muted-foreground">
            Manage and verify collected artifacts with SHA256 integrity checks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setVerifyDir(''); setShowVerifyDialog(true); }}>
            <Shield className="h-4 w-4 mr-2" />
            Verify Integrity
          </Button>
          <Button variant="outline" onClick={() => { setExportDir(''); setExportOutput(''); setShowExportDialog(true); }}>
            <Download className="h-4 w-4 mr-2" />
            Export Manifest
          </Button>
          <Button variant="outline" onClick={() => loadEvidence()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Evidence Directory Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Evidence Directory</p>
              <p className="text-sm text-muted-foreground font-mono truncate">{evidenceDir || '~/.secwin/evidence'}</p>
            </div>
            <Badge variant="outline">{evidenceArtifacts.length} artifacts</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="list" className="flex-1">Artifacts</TabsTrigger>
          <TabsTrigger value="verify" className="flex-1">Verification</TabsTrigger>
          <TabsTrigger value="export" className="flex-1">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {evidenceArtifacts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-2">No Artifacts Found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Run a playbook to collect evidence, or specify an evidence directory.
                  </p>
                  <Button variant="outline" onClick={() => { setVerifyDir(''); setShowVerifyDialog(true); }}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Browse Directory
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artifact</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>SHA256</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evidenceArtifacts.map((artifact) => (
                        <TableRow key={artifact.name}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <span className="font-mono text-sm truncate max-w-[300px]">{artifact.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{(artifact.size / 1024).toFixed(1)} KB</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{artifact.sha256.substring(0, 16)}...</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{artifact.step_id || 'unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(artifact.timestamp).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Hash className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => copyHash(artifact.sha256)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy SHA256
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSelectedArtifact(artifact)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Verify Evidence Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-dir">Evidence Directory</Label>
                <Input
                  id="verify-dir"
                  value={verifyDir}
                  onChange={(e) => setVerifyDir(e.target.value)}
                  placeholder="Leave empty for default (~/.secwin/evidence)"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="verify-strict"
                  checked={verifyStrict}
                  onChange={(e) => setVerifyStrict(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="verify-strict" className="cursor-pointer">
                  Strict mode (fail on missing checksum files)
                </Label>
              </div>
              <Button onClick={handleVerify} disabled={verifying} className="w-full">
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Verify Integrity
                  </>
                )}
              </Button>

              {verificationResults && (
                <div className="p-4 rounded-lg bg-muted/50 border max-h-96 overflow-y-auto font-mono text-sm whitespace-pre-wrap">
                  {verificationResults}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Evidence Manifest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleExport} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="export-dir">Evidence Directory</Label>
                  <Input
                    id="export-dir"
                    value={exportDir}
                    onChange={(e) => setExportDir(e.target.value)}
                    placeholder="Leave empty for default"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-output">Output File</Label>
                  <Input
                    id="export-output"
                    value={exportOutput}
                    onChange={(e) => setExportOutput(e.target.value)}
                    placeholder="manifest.json"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-format">Format</Label>
                  <select
                    id="export-format"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'json' | 'yaml')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="json">JSON</option>
                    <option value="yaml">YAML</option>
                  </select>
                </div>
                <Button type="submit" disabled={exporting} className="w-full">
                  {exporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export Manifest
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Artifact Detail Dialog */}
      {selectedArtifact && (
        <Dialog open={!!selectedArtifact} onOpenChange={(open) => !open && setSelectedArtifact(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Artifact Details</DialogTitle>
              <DialogDescription>{selectedArtifact.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">SHA256</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm break-all flex-1">{selectedArtifact.sha256}</code>
                    <Button variant="ghost" size="icon" onClick={() => copyHash(selectedArtifact.sha256)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Size</p>
                  <p className="font-mono text-sm">{(selectedArtifact.size / 1024).toFixed(2)} KB ({selectedArtifact.size} bytes)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Step ID</p>
                  <p className="font-mono text-sm">{selectedArtifact.step_id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Timestamp</p>
                  <p className="font-mono text-sm">{new Date(selectedArtifact.timestamp).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Path</p>
                  <p className="font-mono text-xs truncate">{selectedArtifact.path}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedArtifact(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Evidence</DialogTitle>
            <DialogDescription>Check SHA256 integrity of all artifacts in the evidence directory</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVerify} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="verify-dir-dialog">Evidence Directory</Label>
              <Input
                id="verify-dir-dialog"
                value={verifyDir}
                onChange={(e) => setVerifyDir(e.target.value)}
                placeholder="Leave empty for default"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="verify-strict-dialog"
                checked={verifyStrict}
                onChange={(e) => setVerifyStrict(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="verify-strict-dialog" className="cursor-pointer">
                Strict mode
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVerifyDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={verifying}>
                {verifying ? 'Verifying...' : 'Verify'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Manifest</DialogTitle>
            <DialogDescription>Generate a manifest file with all artifact hashes</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleExport} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="export-dir-dialog">Evidence Directory</Label>
              <Input
                id="export-dir-dialog"
                value={exportDir}
                onChange={(e) => setExportDir(e.target.value)}
                placeholder="Leave empty for default"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-output-dialog">Output File</Label>
              <Input
                id="export-output-dialog"
                value={exportOutput}
                onChange={(e) => setExportOutput(e.target.value)}
                placeholder="manifest.json"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-format-dialog">Format</Label>
              <select
                id="export-format-dialog"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'json' | 'yaml')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}