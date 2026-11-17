// Lucide React Icons - Minimal re-export for components that import from this file
export {
  LayoutDashboard,
  Shield,
  FolderOpen,
  BookOpen,
  Box,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  BarChart2,
  Brain,
  Wifi,
  WifiOff,
  Monitor,
  Database,
  Globe,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Info,
  Terminal,
  Network,
  HardDrive,
  Cpu,
  MemoryStick,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Play,
  StopCircle,
  RefreshCw,
  Clock,
  Loader2,
  X,
  Download,
  Copy,
  Eye,
  ArrowLeft,
  Code2,
  GitBranch,
  Tag,
  Edit,
  Trash2,
  CodeXml,
} from 'lucide-react';

// Type helper for dynamic icon rendering
export type IconName = keyof typeof import('lucide-react');

export async function getIcon(name: string) {
  const icons = await import('lucide-react');
  return icons[name as keyof typeof icons] || icons.HelpCircle;
}