"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Zap,
  RefreshCw,
  Trash2,
  AlertCircle,
  Clock,
  Database
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CacheConfig {
  api_name: string;
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  last_cache_clear?: string;
  description?: string;
}

interface CacheStats {
  api_name: string;
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  total_entries: number;
  expired_entries: number;
  last_cache_clear?: string;
}

export function CacheSettingsCard() {
  const [configs, setConfigs] = useState<CacheConfig[]>([]);
  const [stats, setStats] = useState<Record<string, CacheStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch cache configurations
  useEffect(() => {
    fetchConfigs();
    const interval = setInterval(fetchConfigs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/cache', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch cache configs');

      const data = await response.json();
      setConfigs(data.data || []);

      // Fetch stats for each config
      for (const config of data.data || []) {
        fetchStats(config.api_name);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching cache configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cache configurations',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const fetchStats = async (apiName: string) => {
    try {
      const response = await fetch(`/api/admin/cache?apiName=${apiName}&action=stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setStats((prev) => ({
        ...prev,
        [apiName]: data.data,
      }));
    } catch (error) {
      console.error(`Error fetching stats for ${apiName}:`, error);
    }
  };

  const handleToggleCache = async (apiName: string, enabled: boolean) => {
    setSaving((prev) => ({ ...prev, [apiName]: true }));
    try {
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`,
        },
        body: JSON.stringify({
          apiName,
          cache_enabled: enabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update cache config');

      const data = await response.json();
      setConfigs((prev) =>
        prev.map((c) => (c.api_name === apiName ? data.data : c))
      );

      toast({
        title: 'Success',
        description: `Cache ${enabled ? 'enabled' : 'disabled'} for ${apiName}`,
      });
    } catch (error) {
      console.error('Error updating cache config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update cache configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving((prev) => ({ ...prev, [apiName]: false }));
    }
  };

  const handleUpdateTTL = async (apiName: string, ttl: number) => {
    if (ttl < 1) {
      toast({
        title: 'Error',
        description: 'TTL must be at least 1 second',
        variant: 'destructive',
      });
      return;
    }

    setSaving((prev) => ({ ...prev, [apiName]: true }));
    try {
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`,
        },
        body: JSON.stringify({
          apiName,
          cache_ttl_seconds: ttl,
        }),
      });

      if (!response.ok) throw new Error('Failed to update TTL');

      const data = await response.json();
      setConfigs((prev) =>
        prev.map((c) => (c.api_name === apiName ? data.data : c))
      );

      toast({
        title: 'Success',
        description: `Cache TTL updated to ${ttl} seconds`,
      });
    } catch (error) {
      console.error('Error updating TTL:', error);
      toast({
        title: 'Error',
        description: 'Failed to update cache TTL',
        variant: 'destructive',
      });
    } finally {
      setSaving((prev) => ({ ...prev, [apiName]: false }));
    }
  };

  const handleClearCache = async (apiName: string) => {
    setClearing((prev) => ({ ...prev, [apiName]: true }));
    try {
      const response = await fetch(`/api/admin/cache?apiName=${apiName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`,
        },
      });

      if (!response.ok) throw new Error('Failed to clear cache');

      toast({
        title: 'Success',
        description: `Cache cleared for ${apiName}`,
      });

      // Refresh stats
      fetchStats(apiName);
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    } finally {
      setClearing((prev) => ({ ...prev, [apiName]: false }));
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="h-5 w-5" />
            API Cache Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-[#9147ff]" />
            <span className="ml-2 text-[#ADADB8]">Loading cache configurations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1a1e] border-[#26262c]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Zap className="h-5 w-5" />
          API Cache Configuration
        </CardTitle>
        <CardDescription className="text-[#ADADB8]">
          Manage caching for external API calls to reduce rate limiting and improve performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {configs.length === 0 ? (
          <div className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-[#ADADB8]">No API cache configurations found</p>
          </div>
        ) : (
          configs.map((config) => {
            const stat = stats[config.api_name];
            return (
              <div
                key={config.api_name}
                className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white">{config.api_name}</h4>
                    {config.description && (
                      <p className="text-xs text-[#ADADB8] mt-1">{config.description}</p>
                    )}
                  </div>
                  <Badge
                    variant={config.cache_enabled ? 'default' : 'secondary'}
                    className={config.cache_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}
                  >
                    {config.cache_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                {/* Stats */}
                {stat && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2 bg-[#1a1a1e]/50 rounded border border-[#40404a]/20">
                      <p className="text-xs text-[#ADADB8]">Cached Entries</p>
                      <p className="text-lg font-semibold text-white mt-1">{stat.total_entries}</p>
                    </div>
                    <div className="p-2 bg-[#1a1a1e]/50 rounded border border-[#40404a]/20">
                      <p className="text-xs text-[#ADADB8]">Expired</p>
                      <p className="text-lg font-semibold text-yellow-400 mt-1">{stat.expired_entries}</p>
                    </div>
                    <div className="p-2 bg-[#1a1a1e]/50 rounded border border-[#40404a]/20">
                      <p className="text-xs text-[#ADADB8]">TTL (seconds)</p>
                      <p className="text-lg font-semibold text-white mt-1">{stat.cache_ttl_seconds}</p>
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="space-y-3">
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-[#ADADB8]">Enable Caching</Label>
                    <Switch
                      checked={config.cache_enabled}
                      onCheckedChange={(checked) => handleToggleCache(config.api_name, checked)}
                      disabled={saving[config.api_name]}
                    />
                  </div>

                  {/* TTL Input */}
                  <div className="space-y-2">
                    <Label className="text-sm text-[#ADADB8]">Cache TTL (seconds)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={config.cache_ttl_seconds}
                        onChange={(e) => {
                          const newTTL = parseInt(e.target.value);
                          setConfigs((prev) =>
                            prev.map((c) =>
                              c.api_name === config.api_name
                                ? { ...c, cache_ttl_seconds: newTTL }
                                : c
                            )
                          );
                        }}
                        onBlur={(e) => {
                          const newTTL = parseInt(e.target.value);
                          if (newTTL !== config.cache_ttl_seconds) {
                            handleUpdateTTL(config.api_name, newTTL);
                          }
                        }}
                        className="bg-[#26262c] border-[#40404a] text-white w-24"
                        min="1"
                        max="86400"
                        disabled={saving[config.api_name] || !config.cache_enabled}
                      />
                      <span className="text-xs text-[#ADADB8]">
                        {config.cache_ttl_seconds < 60
                          ? `${config.cache_ttl_seconds}s`
                          : config.cache_ttl_seconds < 3600
                          ? `${Math.round(config.cache_ttl_seconds / 60)}m`
                          : `${Math.round(config.cache_ttl_seconds / 3600)}h`}
                      </span>
                    </div>
                  </div>

                  {/* Last Clear Info */}
                  {stat?.last_cache_clear && (
                    <div className="flex items-center gap-2 text-xs text-[#ADADB8]">
                      <Clock className="h-3 w-3" />
                      <span>
                        Last cleared: {new Date(stat.last_cache_clear).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Clear Cache Button */}
                  <Button
                    onClick={() => handleClearCache(config.api_name)}
                    disabled={clearing[config.api_name] || saving[config.api_name]}
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    {clearing[config.api_name] ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-2" />
                        Clear Cache Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {/* Info Box */}
        <div className="p-4 bg-[#004D61]/20 border border-[#004D61]/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-[#00D9FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-white">How Caching Works</h4>
              <p className="text-sm text-[#ADADB8] mt-1">
                API responses are cached in the database for the configured TTL (Time To Live). 
                When a request comes in, cached data is returned if available and not expired, 
                reducing API calls and rate limiting issues. You can adjust the TTL on the fly 
                without restarting the server.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
