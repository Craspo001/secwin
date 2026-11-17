'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../components/ui/DropdownMenu';
import { Box, Search, RefreshCw, CheckCircle, Loader2, ExternalLink, Terminal, ChevronRight, FilterX, Download } from 'lucide-react';

export function Tools() {
  const {
    tools,
    toolsLoading,
    loadTools,
    searchTools,
    installTool
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);

  const categories = [
    'all',
    'reconnaissance',
    'enumeration',
    'vulnerability',
    'exploitation',
    'post-exploitation',
    'web',
    'wireless',
    'password',
    'forensics',
    'reporting',
    'utility',
  ];

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesInstalled = !showInstalledOnly || tool.installed;
    return matchesSearch && matchesCategory && matchesInstalled;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchTools(searchQuery);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    loadTools(category);
  };

  const handleInstall = async (name: string) => {
    setInstalling(name);
    try {
      await installTool(name);
      loadTools(selectedCategory);
    } catch (error) {
      console.error('Failed to install tool:', error);
    } finally {
      setInstalling(null);
    }
  };

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
          <p className="text-muted-foreground">
            Browse, search, and install security tools from the SecWin registry
          </p>
        </div>
        <Button onClick={() => loadTools(selectedCategory)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterX className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="flex h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showInstalledOnly}
                  onChange={(e) => setShowInstalledOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                Installed only
              </label>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tools Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            Tool Registry ({filteredTools.length} tools)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {toolsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-12">
              <Box className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-2">No Tools Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try adjusting your search or filter.' : 'No tools in the registry yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map((tool) => (
                    <TableRow key={tool.name}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <Box className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tool.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tool.repository && (
                                <a href={tool.repository} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                                  <ExternalLink className="h-3 w-3" />
                                  Repository
                                </a>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{tool.version}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tool.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {tool.installed ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Installed
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Installed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {tool.description}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!tool.installed ? (
                              <DropdownMenuItem
                                onClick={() => handleInstall(tool.name)}
                                disabled={installing === tool.name}
                              >
                                {installing === tool.name ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Installing...
                                  </>
                                ) : (
                                  <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Install
                                  </>
                                )}
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem>
                                  <Terminal className="mr-2 h-4 w-4" />
                                  Run in Terminal
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Repository
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

      {/* Category Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.filter(c => c !== 'all').map(cat => {
              const count = tools.filter(t => t.category === cat).length;
              const installed = tools.filter(t => t.category === cat && t.installed).length;
              return (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  onClick={() => handleCategoryChange(cat)}
                  className="cursor-pointer gap-1"
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  <span className="text-xs">{installed}/{count}</span>
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}