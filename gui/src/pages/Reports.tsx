'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Separator } from '../components/ui/Separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { FileText, Download, Eye, Code, Loader2, AlertTriangle, Shield, Printer } from 'lucide-react';
import { clsx } from 'clsx';

export function Reports() {
  const { findings, evidenceArtifacts, activeProfile, opsecStatus } = useStore();

  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'html' | 'pdf'>('html');
  const [generating, setGenerating] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportTitle, setReportTitle] = useState('Security Engagement Report');
  const [includeOpSec, setIncludeOpSec] = useState(true);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeFindings, setIncludeFindings] = useState(true);

  const generateReport = async () => {
    setGenerating(true);
    try {
      // In a real implementation, this would call the secwin CLI to generate a report
      // For now, generate a mock report
      const content = generateMockReport();
      setReportContent(content);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const generateMockReport = () => {
    const date = new Date().toLocaleString();
    const severityCounts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };

    if (selectedFormat === 'markdown') {
      let md = `# ${reportTitle}\n\n`;
      md += `**Generated**: ${date}\n`;
      md += `**Profile**: ${activeProfile || 'None'}\n\n`;

      if (includeOpSec && activeProfile && opsecStatus) {
        md += `## OpSec Context\n\n`;
        md += `- **VPN**: ${opsecStatus.vpn || 'None'}\n`;
        md += `- **Hostname**: ${opsecStatus.hostname}\n`;
        md += `- **Timezone**: ${opsecStatus.timezone || 'System default'}\n`;
        md += `- **DNS**: ${opsecStatus.dns || 'Auto'}\n`;
        md += `- **Proxy**: ${opsecStatus.http_proxy || 'None'}\n\n`;
      }

      md += `## Findings Summary\n\n`;
      md += `| Severity | Count |\n|----------|-------|\n`;
      Object.entries(severityCounts).forEach(([sev, count]) => {
        md += `| ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${count} |\n`;
      });
      md += `\n`;

      if (includeFindings && findings.length > 0) {
        md += `## Findings\n\n`;
        findings.forEach(f => {
          md += `### ${f.severity.toUpperCase()}: ${f.title}\n\n`;
          md += `${f.description}\n\n`;
          if (f.mitre_techniques.length > 0) {
            md += `**MITRE ATT&CK**: ${f.mitre_techniques.join(', ')}\n\n`;
          }
        });
      }

      if (includeEvidence && evidenceArtifacts.length > 0) {
        md += `## Evidence\n\n`;
        evidenceArtifacts.forEach(a => {
          md += `- \`${a.name}\` (${a.step_id}, ${(a.size/1024).toFixed(1)} KB, SHA256: ${a.sha256.substring(0,16)}...)\n`;
        });
      }

      return md;
    } else if (selectedFormat === 'html') {
      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #16a34a; padding-bottom: 10px; }
    h2 { color: #16213e; border-bottom: 1px solid #eaeaea; padding-bottom: 5px; margin-top: 30px; }
    h3 { color: #2d3748; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eaeaea; }
    th { background: #f8f9fa; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-right: 8px; }
    .badge-critical { background: #fed7d7; color: #c53030; }
    .badge-high { background: #fefcbf; color: #b7791f; }
    .badge-medium { background: #fefcbf; color: #b7791f; }
    .badge-low { background: #c6f6d5; color: #276749; }
    .badge-info { background: #bee3f8; color: #2b6cb0; }
    code { background: #f8f9fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #1a1a2e; color: #e2e8f0; padding: 20px; border-radius: 8px; overflow-x: auto; }
    .finding { border-left: 4px solid; padding: 16px; margin: 16px 0; background: #f8f9fa; border-radius: 0 8px 8px 0; }
    .finding.critical { border-left-color: #e53e3e; }
    .finding.high { border-left-color: #dd6b20; }
    .finding.medium { border-left-color: #d69e2e; }
    .finding.low { border-left-color: #38a169; }
    .finding.info { border-left-color: #3182ce; }
    .opsec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 20px 0; }
    .opsec-card { background: #f8f9fa; border-radius: 8px; padding: 16px; border-left: 4px solid #16a34a; }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <p><strong>Generated:</strong> ${date}</p>
  <p><strong>Profile:</strong> ${activeProfile || 'None'}</p>`;

      if (includeOpSec && activeProfile && opsecStatus) {
        html += `<h2>OpSec Context</h2>
        <div class="opsec-grid">
          <div class="opsec-card"><strong>VPN</strong><br>${opsecStatus.vpn || 'None'}</div>
          <div class="opsec-card"><strong>Hostname</strong><br>${opsecStatus.hostname}</div>
          <div class="opsec-card"><strong>Timezone</strong><br>${opsecStatus.timezone || 'System default'}</div>
          <div class="opsec-card"><strong>DNS</strong><br>${opsecStatus.dns || 'Auto'}</div>
          <div class="opsec-card"><strong>Proxy</strong><br>${opsecStatus.http_proxy || 'None'}</div>
        </div>`;
      }

      html += `<h2>Findings Summary</h2>
        <table>
          <tr><th>Severity</th><th>Count</th></tr>`;
      Object.entries(severityCounts).forEach(([sev, count]) => {
        html += `<tr><td><span class="badge badge-${sev}">${sev}</span></td><td>${count}</td></tr>`;
      });
      html += `</table>`;

      if (includeFindings && findings.length > 0) {
        html += `<h2>Findings</h2>`;
        findings.forEach(f => {
          html += `<div class="finding ${f.severity}">
            <h3>${f.severity.toUpperCase()}: ${f.title}</h3>
            <p>${f.description}</p>
            ${f.mitre_techniques.length > 0 ? `<p><strong>MITRE ATT&CK:</strong> ${f.mitre_techniques.join(', ')}</p>` : ''}
          </div>`;
        });
      }

      if (includeEvidence && evidenceArtifacts.length > 0) {
        html += `<h2>Evidence</h2><ul>`;
        evidenceArtifacts.forEach(a => {
          html += `<li><code>${a.name}</code> (${a.step_id}, ${(a.size/1024).toFixed(1)} KB, SHA256: ${a.sha256.substring(0,16)}...)</li>`;
        });
        html += `</ul>`;
      }

      html += `</body></html>`;
      return html;
    } else {
      return 'PDF generation requires additional setup. Use HTML format and print to PDF.';
    }
  };

  const downloadReport = () => {
    const blob = new Blob([reportContent], {
      type: selectedFormat === 'html' ? 'text/html' : 'text/markdown'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}.${selectedFormat === 'html' ? 'html' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const copyReport = () => {
    navigator.clipboard.writeText(reportContent);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and export engagement reports in multiple formats
          </p>
        </div>
        <Button onClick={generateReport} disabled={generating}>
          <Loader2 className={clsx('h-4 w-4 mr-2', generating && 'animate-spin')} />
          Generate Report
        </Button>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="report-title">Report Title</Label>
              <Input
                id="report-title"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Security Engagement Report"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-format">Output Format</Label>
              <select
                id="report-format"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as 'markdown' | 'html' | 'pdf')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="html">HTML (Recommended)</option>
                <option value="markdown">Markdown</option>
                <option value="pdf">PDF (via Print)</option>
              </select>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeOpSec}
                onChange={(e) => setIncludeOpSec(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm">Include OpSec Context</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeFindings}
                onChange={(e) => setIncludeFindings(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm">Include Findings</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={(e) => setIncludeEvidence(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm">Include Evidence</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      {reportContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={printReport}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={copyReport}>
                <Code className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>

            <Tabs defaultValue="rendered" className="w-full">
              <TabsList>
                <TabsTrigger value="rendered">Rendered</TabsTrigger>
                <TabsTrigger value="source">Source</TabsTrigger>
              </TabsList>
              <TabsContent value="rendered" className="p-4 border rounded-lg bg-background max-h-[600px] overflow-y-auto">
                {selectedFormat === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: reportContent }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm">{reportContent}</pre>
                )}
              </TabsContent>
              <TabsContent value="source" className="p-4 border rounded-lg bg-background max-h-[600px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono text-sm">{reportContent}</pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Findings</p>
                <p className="text-3xl font-bold">{findings.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical/High</p>
                <p className="text-3xl font-bold text-red-500">
                  {findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Evidence Artifacts</p>
                <p className="text-3xl font-bold">{evidenceArtifacts.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Profile</p>
                <p className="text-3xl font-bold">{activeProfile ? '1' : '0'}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}