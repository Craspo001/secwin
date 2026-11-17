import { useState, useMemo } from 'react';
import { FolderOpen, FileText, Search, Shield, Download, RotateCcw, CheckCircle, XCircle, AlertCircle, Loader2, Eye, Copy } from 'lucide-react';
import { useEvidence } from '../hooks/useSecWin';
import { cn, formatBytes, formatDate, truncate } from '../lib/utils';

export function EvidenceViewer() {
  const [selectedDir, setSelectedDir] = useState<string>('');
  const { artifacts, loading, error, verify, exportManifest, reload } = useEvidence(selectedDir || undefined);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: number; failed: number; details: any[] } | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<typeof artifacts[0] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredArtifacts = useMemo(() =>
    artifacts.filter(a =>
      a.name.toLowerCase().includes(filter.toLowerCase()) ||
      a.step_id.toLowerCase().includes(filter.toLowerCase()) ||
      a.sha256.toLowerCase().includes(filter.toLowerCase())
    ), [artifacts, filter]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verify();
      setVerifyResult(result);
    } catch (e) {
      console.error('Verification failed:', e);
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async (format: 'json' | 'yaml') => {
    setExporting(true);
    try {
      const manifest = await exportManifest(format);
      // Create download
      const blob = new Blob([manifest], { type: format === 'json' ? 'application/json' : 'application/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-manifest.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence Locker</h1>
          <p className="text-muted-foreground mt-1">View and verify collected engagement artifacts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="btn-outline" disabled={loading}>
            <RotateCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={handleVerify} className="btn-primary" disabled={loading || verifying}>
            <Shield className={cn('h-4 w-4 mr-2', verifying && 'animate-spin')} />
            {verifying ? 'Verifying...' : 'Verify Integrity'}
          </button>
        </div>
      </div>

      {error && (
        <div className="badge badge-error text-sm p-3">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {verifyResult && (
        <div className={cn('p-4 rounded-lg border', verifyResult.failed > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {verifyResult.failed > 0 ? (
                <XCircle className="h-5 w-5 text-red-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <div>
                <p className="font-medium">
                  {verifyResult.failed > 0 ? 'Verification Failed' : 'All Artifacts Verified'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {verifyResult.verified} verified, {verifyResult.failed} failed
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleExport('json')} className="btn-outline btn-sm" disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />
                JSON
              </button>
              <button onClick={() => handleExport('yaml')} className="btn-outline btn-sm" disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />
                YAML
              </button>
            </div>
          </div>
          {verifyResult.failed > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Failed Artifacts</summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {verifyResult.details.filter(d => !d.match).map((detail, i) => (
                  <li key={i} className="text-sm text-red-600 font-mono">
                    {detail.name}: expected {truncate(detail.expected, 16)}... got {truncate(detail.actual, 16)}...
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="card-title">Artifacts ({artifacts.length})</h2>
              <p className="text-sm text-muted-foreground">Collected evidence files with SHA256 verification</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter artifacts..."
                className="input w-64"
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="card-content">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : artifacts.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Evidence Found</h3>
              <p className="text-muted-foreground mb-4">Run a playbook to collect artifacts, or select a different evidence directory</p>
              <div className="flex gap-2 justify-center">
                <input
                  type="text"
                  placeholder="Evidence directory path"
                  value={selectedDir}
                  onChange={(e) => setSelectedDir(e.target.value)}
                  className="input w-80"
                />
                <button onClick={() => reload()} className="btn-primary">Load</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 p-2 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Step</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-2">Modified</div>
                <div className="col-span-2">SHA256</div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredArtifacts.map((artifact) => (
                  <div
                    key={artifact.name}
                    className="grid grid-cols-12 gap-2 p-2 border-b hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedArtifact(artifact)}
                  >
                    <div className="col-span-4 font-mono text-sm truncate" title={artifact.name}>
                      <FileText className="h-4 w-4 inline mr-1" />
                      {artifact.name}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">{artifact.step_id}</div>
                    <div className="col-span-2 text-sm text-muted-foreground">{formatBytes(artifact.size)}</div>
                    <div className="col-span-2 text-sm text-muted-foreground">{formatDate(artifact.timestamp)}</div>
                    <div className="col-span-2 font-mono text-xs text-muted-foreground truncate" title={artifact.sha256}>
                      {truncate(artifact.sha256, 32)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedArtifact.name}</h2>
              <button onClick={() => setSelectedArtifact(null)} className="btn-ghost">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Path</p>
                  <code className="font-mono text-sm break-all">{selectedArtifact.path}</code>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Step ID</p>
                  <code className="font-mono text-sm">{selectedArtifact.step_id}</code>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Size</p>
                  <p>{formatBytes(selectedArtifact.size)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Modified</p>
                  <p>{formatDate(selectedArtifact.timestamp)}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-sm text-muted-foreground">SHA256</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm flex-1 break-all">{selectedArtifact.sha256}</code>
                    <button onClick={() => copyToClipboard(selectedArtifact.sha256)} className="btn-ghost btn-sm">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Verification</h3>
                <div className="flex gap-2">
                  <button className="btn-outline btn-sm">
                    <Shield className="h-4 w-4 mr-1" />
                    Verify This File
                  </button>
                  <button className="btn-outline btn-sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View Contents
                  </button>
                  <button className="btn-outline btn-sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}