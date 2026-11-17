export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return 'text-red-600 bg-red-500/10 border-red-500';
    case 'high': return 'text-orange-600 bg-orange-500/10 border-orange-500';
    case 'medium': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500';
    case 'low': return 'text-green-600 bg-green-500/10 border-green-500';
    case 'info': return 'text-blue-600 bg-blue-500/10 border-blue-500';
    default: return 'text-gray-600 bg-gray-500/10 border-gray-500';
  }
}

export function getSeverityBadgeVariant(severity: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (severity.toLowerCase()) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'success';
    case 'info': return 'default';
    default: return 'default';
  }
}