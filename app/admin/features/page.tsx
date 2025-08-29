"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Flag, 
  Plus, 
  Search, 
  Edit3,
  Trash2,
  RefreshCw,
  Settings,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { FeatureFlag } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminFeaturesPage() {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const fetchFeatureFlags = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getFeatureFlags();
      if (response.success && response.data) {
        setFeatureFlags(response.data);
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      toast({
        title: "Error",
        description: "Failed to load feature flags. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureFlags();
  }, []);

  const handleToggleFlag = async (flagId: string, enabled: boolean) => {
    try {
      const response = await adminAPI.updateFeatureFlag(flagId, { is_enabled: enabled });
      if (response.success) {
        setFeatureFlags(prev => prev.map(flag => 
          flag.id === flagId ? { ...flag, is_enabled: enabled } : flag
        ));
        toast({
          title: "Success",
          description: `Feature flag ${enabled ? 'enabled' : 'disabled'} successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update feature flag.",
        variant: "destructive"
      });
    }
  };

  const filteredFlags = featureFlags.filter(flag =>
    flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flag.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading feature flags...</span>
            </div>
          </div>
        </div>
      </AdminProtected>
    );
  }

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10]">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <Flag className="mr-3 h-6 w-6" />
                  Feature Flags
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Manage feature toggles and application functionality
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ADADB8] h-4 w-4" />
                  <Input
                    placeholder="Search flags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[#26262c] border-[#40404a] text-white w-64"
                  />
                </div>
                
                <Button 
                  onClick={fetchFeatureFlags}
                  variant="outline"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Flags</p>
                        <p className="text-2xl font-bold text-white">{featureFlags.length}</p>
                      </div>
                      <Flag className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Enabled</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {featureFlags.filter(f => f.is_enabled).length}
                        </p>
                      </div>
                      <ToggleRight className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Disabled</p>
                        <p className="text-2xl font-bold text-red-400">
                          {featureFlags.filter(f => !f.is_enabled).length}
                        </p>
                      </div>
                      <ToggleLeft className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Feature Flags Table */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="text-white">Feature Flags</CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    Toggle features and functionality across the application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredFlags.length === 0 ? (
                    <div className="text-center py-8">
                      <Flag className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">No feature flags found</h3>
                      <p className="text-[#ADADB8]">
                        Feature flags will appear here when configured.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#26262c]">
                          <TableHead className="text-[#ADADB8]">Feature</TableHead>
                          <TableHead className="text-[#ADADB8]">Key</TableHead>
                          <TableHead className="text-[#ADADB8]">Status</TableHead>
                          <TableHead className="text-[#ADADB8]">Rollout</TableHead>
                          <TableHead className="text-[#ADADB8]">Created</TableHead>
                          <TableHead className="text-[#ADADB8]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFlags.map((flag) => (
                          <TableRow key={flag.id} className="border-[#26262c] hover:bg-[#26262c]/50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-white">{flag.name}</div>
                                <div className="text-sm text-[#ADADB8] max-w-xs truncate">
                                  {flag.description}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-[#ADADB8] font-mono text-sm">
                              {flag.key}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "border",
                                  flag.is_enabled 
                                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" 
                                    : "text-red-400 bg-red-400/10 border-red-400/30"
                                )}
                              >
                                {flag.is_enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[#ADADB8]">
                              {flag.rollout_percentage}%
                            </TableCell>
                            <TableCell className="text-[#ADADB8] text-sm">
                              {new Date(flag.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={flag.is_enabled}
                                  onCheckedChange={(checked) => handleToggleFlag(flag.id, checked)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}