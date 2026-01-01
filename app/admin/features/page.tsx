"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login-supabase';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Flag, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FeatureFlag } from '@/lib/feature-flags';
import { adminAPI } from '@/lib/admin-api';

/**
 * Feature Flags Management Page
 * 
 * Admin interface for toggling feature flags to control site functionality.
 */

interface GroupedFlags {
  site: FeatureFlag[];
  server_card: FeatureFlag[];
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getFeatureFlags();
      
      if (response.success) {
        setFlags(response.data || []);
      } else {
        console.error('API returned error:', response);
        toast({
          title: "Error",
          description: response.error || "Failed to load feature flags.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load feature flags.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Add a small delay to ensure auth token is available
    const timer = setTimeout(() => {
      fetchFlags();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = async (flag: FeatureFlag) => {
    setUpdating(flag.id);
    
    try {
      console.log('Toggling flag:', flag.id, 'to', !flag.is_enabled);
      const response = await adminAPI.updateFeatureFlag(flag.id.toString(), {
        is_enabled: !flag.is_enabled,
      });

      console.log('Update response:', response);

      if (response.success) {
        // Update local state
        setFlags(prevFlags => 
          prevFlags.map(f => 
            f.id === flag.id 
              ? { ...f, is_enabled: !f.is_enabled }
              : f
          )
        );
        
        toast({
          title: "Success",
          description: `${flag.name} has been ${!flag.is_enabled ? 'enabled' : 'disabled'}.`,
        });
      } else {
        console.error('API error:', response);
        toast({
          title: "Error",
          description: response.error || "Failed to update feature flag.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating feature flag:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update feature flag.",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  // Group flags by category
  const groupedFlags: GroupedFlags = flags.reduce<GroupedFlags>(
    (acc, flag) => {
      if (flag.category === 'site') {
        acc.site.push(flag);
      } else if (flag.category === 'server_card') {
        acc.server_card.push(flag);
      }
      return acc;
    },
    { site: [], server_card: [] }
  );

  // Count enabled flags
  const enabledCount = flags.filter(f => f.is_enabled).length;
  const totalCount = flags.length;

  return (
    <AdminProtected>
      <div className="flex flex-col md:flex-row h-screen bg-[#0e0e10]">
        <AdminSidebarMobile />
        
        <div className="flex-1 flex flex-col overflow-hidden md:ml-64 mt-16 md:mt-0">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <Flag className="h-5 md:h-6 w-5 md:w-6" />
                  Feature Flags
                </h1>
                <p className="text-[#ADADB8] text-xs md:text-sm">
                  Control which features are visible to users
                </p>
              </div>
              
              <button
                onClick={() => {
                  setLoading(true);
                  fetchFlags();
                }}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-[#26262c] hover:bg-[#40404a] text-white rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Summary Card */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#004D61]/20 border border-[#004D61]/30 rounded-lg">
                        <Flag className="h-6 w-6 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{enabledCount} / {totalCount}</p>
                        <p className="text-sm text-[#ADADB8]">Features Enabled</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-[#ADADB8]">{enabledCount} Enabled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-gray-500" />
                        <span className="text-[#ADADB8]">{totalCount - enabledCount} Disabled</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Info Banner */}
              <div className="p-4 bg-[#004D61]/20 border border-[#004D61]/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-white">About Feature Flags</h4>
                    <p className="text-sm text-[#ADADB8] mt-1">
                      When a feature flag is disabled, the corresponding UI element will be completely hidden from users. 
                      Changes take effect within 30 seconds as clients refresh their flag cache.
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                <>
                  {/* Site Features */}
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Site Features</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Control visibility of main site features in the header
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {groupedFlags.site.length === 0 ? (
                        <p className="text-sm text-[#ADADB8] text-center py-4">No site features found</p>
                      ) : (
                        groupedFlags.site.map((flag) => (
                          <div 
                            key={flag.id}
                            className="flex items-center justify-between p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Label className="text-white font-medium cursor-pointer" htmlFor={`flag-${flag.id}`}>
                                  {flag.name}
                                </Label>
                                {flag.is_enabled ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                              {flag.description && (
                                <p className="text-sm text-[#ADADB8] mt-1">
                                  {flag.description}
                                </p>
                              )}
                              <p className="text-xs text-[#ADADB8] mt-1 font-mono">
                                Key: {flag.key}
                              </p>
                            </div>
                            <Switch
                              id={`flag-${flag.id}`}
                              checked={flag.is_enabled}
                              onCheckedChange={() => handleToggle(flag)}
                              disabled={updating === flag.id}
                              className="ml-4"
                            />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Server Card Features */}
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="text-white">Server Stats Card Features</CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Control visibility of elements within server statistics cards
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {groupedFlags.server_card.length === 0 ? (
                        <p className="text-sm text-[#ADADB8] text-center py-4">No server card features found</p>
                      ) : (
                        groupedFlags.server_card.map((flag) => (
                          <div 
                            key={flag.id}
                            className="flex items-center justify-between p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Label className="text-white font-medium cursor-pointer" htmlFor={`flag-${flag.id}`}>
                                  {flag.name}
                                </Label>
                                {flag.is_enabled ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                              {flag.description && (
                                <p className="text-sm text-[#ADADB8] mt-1">
                                  {flag.description}
                                </p>
                              )}
                              <p className="text-xs text-[#ADADB8] mt-1 font-mono">
                                Key: {flag.key}
                              </p>
                            </div>
                            <Switch
                              id={`flag-${flag.id}`}
                              checked={flag.is_enabled}
                              onCheckedChange={() => handleToggle(flag)}
                              disabled={updating === flag.id}
                              className="ml-4"
                            />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
