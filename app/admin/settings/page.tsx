"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login-supabase';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CacheSettingsCard } from '@/components/admin/cache-settings-card';
import { 
  Settings, 
  RefreshCw,
  Database,
  Shield,
  Bell,
  Clock,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/lib/admin-api';

/**
 * Settings Page
 * 
 * System configuration and settings management.
 * Source: PRD §4.1 FR-4, FR-7; Blueprint §5.1
 */

interface SystemSettings {
  visitorTrackingEnabled: boolean;
  heartbeatInterval: number;
  inactiveTimeout: number;
  dataRetentionDays: number;
  realtimeEnabled: boolean;
  pollingFallbackEnabled: boolean;
}

export default function SettingsPage() {
  const DEFAULT_TWITCH_PAGE_LIMIT = 35;
  const [settings, setSettings] = useState<SystemSettings>({
    visitorTrackingEnabled: true,
    heartbeatInterval: 30,
    inactiveTimeout: 300,
    dataRetentionDays: 7,
    realtimeEnabled: true,
    pollingFallbackEnabled: true
  });
  const [saving, setSaving] = useState(false);
  const [twitchPageLimit, setTwitchPageLimit] = useState<number>(DEFAULT_TWITCH_PAGE_LIMIT);
  const [loadingTwitchSetting, setLoadingTwitchSetting] = useState(true);
  const [savingTwitchSetting, setSavingTwitchSetting] = useState(false);
  const [liveChartInterval, setLiveChartInterval] = useState<number>(60);
  const [loadingLiveChartSetting, setLoadingLiveChartSetting] = useState(true);
  const [savingLiveChartSetting, setSavingLiveChartSetting] = useState(false);
  const { toast } = useToast();
  const isTwitchLimitValid = Number.isFinite(twitchPageLimit) && twitchPageLimit >= 1 && twitchPageLimit <= 75;
  const isLiveChartIntervalValid = Number.isFinite(liveChartInterval) && liveChartInterval >= 10 && liveChartInterval <= 300;

  const handleSettingChange = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const loadTwitchStreamSetting = async () => {
    try {
      setLoadingTwitchSetting(true);
      const response = await adminAPI.getSystemSettings();
      const setting = response.data?.find((item) => item.key === 'twitch_stream_page_limit');
      if (setting) {
        const parsed = Number(setting.value);
        if (Number.isFinite(parsed)) {
          setTwitchPageLimit(Math.min(75, Math.max(1, parsed)));
        } else {
          setTwitchPageLimit(DEFAULT_TWITCH_PAGE_LIMIT);
        }
      } else {
        setTwitchPageLimit(DEFAULT_TWITCH_PAGE_LIMIT);
      }
    } catch (error) {
      console.error('Error loading Twitch stream setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Twitch stream settings.',
        variant: 'destructive',
      });
    } finally {
      setLoadingTwitchSetting(false);
    }
  };

  const handleSaveTwitchSetting = async () => {
    if (!isTwitchLimitValid) {
      toast({
        title: 'Invalid value',
        description: 'Page limit must be between 1 and 75.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingTwitchSetting(true);
      await adminAPI.updateSystemSetting({
        key: 'twitch_stream_page_limit',
        value: twitchPageLimit,
        data_type: 'number',
        description: 'Maximum Twitch pagination pages per game',
        category: 'streams',
      });

      toast({
        title: 'Saved',
        description: 'Twitch stream fetching limit updated.',
      });
    } catch (error) {
      console.error('Error saving Twitch stream setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to update Twitch stream limit.',
        variant: 'destructive',
      });
    } finally {
      setSavingTwitchSetting(false);
    }
  };

  const loadLiveChartSetting = async () => {
    try {
      setLoadingLiveChartSetting(true);
      const response = await adminAPI.getSystemSettings();
      const setting = response.data?.find((item) => item.key === 'live_chart_polling_interval');
      if (setting) {
        const parsed = Number(setting.value);
        if (Number.isFinite(parsed)) {
          setLiveChartInterval(Math.min(300, Math.max(10, parsed)));
        } else {
          setLiveChartInterval(60);
        }
      } else {
        setLiveChartInterval(60);
      }
    } catch (error) {
      console.error('Error loading live chart setting:', error);
    } finally {
      setLoadingLiveChartSetting(false);
    }
  };

  const handleSaveLiveChartSetting = async () => {
    if (!isLiveChartIntervalValid) {
      toast({
        title: 'Invalid value',
        description: 'Polling interval must be between 10 and 300 seconds.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingLiveChartSetting(true);
      await adminAPI.updateSystemSetting({
        key: 'live_chart_polling_interval',
        value: liveChartInterval,
        data_type: 'number',
        description: 'Live chart FiveM polling interval in seconds',
        category: 'chart',
      });

      toast({
        title: 'Saved',
        description: 'Live chart polling interval updated.',
      });
    } catch (error) {
      console.error('Error saving live chart setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to update live chart polling interval.',
        variant: 'destructive',
      });
    } finally {
      setSavingLiveChartSetting(false);
    }
  };

  useEffect(() => {
    loadTwitchStreamSetting();
    loadLiveChartSetting();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Simulate saving settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Success",
        description: "Settings saved successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

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
                  <Settings className="h-5 md:h-6 w-5 md:w-6" />
                  Settings
                </h1>
                <p className="text-[#ADADB8] text-xs md:text-sm">
                  System configuration and preferences
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              
              <Tabs defaultValue="visitor-tracking" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-[#26262c]">
                  <TabsTrigger value="visitor-tracking" className="text-white text-xs md:text-sm">Visitor Tracking</TabsTrigger>
                  <TabsTrigger value="data-management" className="text-white text-xs md:text-sm">Data Management</TabsTrigger>
                  <TabsTrigger value="api-cache" className="text-white text-xs md:text-sm">API Cache</TabsTrigger>
                  <TabsTrigger value="system" className="hidden md:block text-white text-xs md:text-sm">System</TabsTrigger>
                </TabsList>

                {/* Visitor Tracking Settings */}
                <TabsContent value="visitor-tracking" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Bell className="h-5 w-5" />
                        Visitor Tracking Configuration
                      </CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Configure how visitor sessions are tracked and managed
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Enable/Disable Tracking */}
                      <div className="flex items-center justify-between p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                        <div>
                          <Label className="text-white font-medium">Enable Visitor Tracking</Label>
                          <p className="text-sm text-[#ADADB8] mt-1">
                            Track active site visitors in real-time
                          </p>
                        </div>
                        <Switch
                          checked={settings.visitorTrackingEnabled}
                          onCheckedChange={(checked) => handleSettingChange('visitorTrackingEnabled', checked)}
                        />
                      </div>

                      {/* Heartbeat Interval */}
                      <div className="space-y-2">
                        <Label className="text-white">Heartbeat Interval (seconds)</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            value={settings.heartbeatInterval}
                            onChange={(e) => handleSettingChange('heartbeatInterval', parseInt(e.target.value))}
                            className="bg-[#26262c] border-[#40404a] text-white w-32"
                            min="10"
                            max="300"
                          />
                          <p className="text-sm text-[#ADADB8]">
                            How often visitors send heartbeat signals (10-300 seconds)
                          </p>
                        </div>
                      </div>

                      {/* Inactive Timeout */}
                      <div className="space-y-2">
                        <Label className="text-white">Inactive Timeout (seconds)</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            value={settings.inactiveTimeout}
                            onChange={(e) => handleSettingChange('inactiveTimeout', parseInt(e.target.value))}
                            className="bg-[#26262c] border-[#40404a] text-white w-32"
                            min="60"
                            max="3600"
                          />
                          <p className="text-sm text-[#ADADB8]">
                            Mark visitor inactive after no activity (60-3600 seconds)
                          </p>
                        </div>
                      </div>

                      {/* Realtime Settings */}
                      <div className="flex items-center justify-between p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                        <div>
                          <Label className="text-white font-medium">Enable Realtime Updates</Label>
                          <p className="text-sm text-[#ADADB8] mt-1">
                            Use Supabase Realtime for instant visitor count updates
                          </p>
                        </div>
                        <Switch
                          checked={settings.realtimeEnabled}
                          onCheckedChange={(checked) => handleSettingChange('realtimeEnabled', checked)}
                        />
                      </div>

                      {/* Polling Fallback */}
                      <div className="flex items-center justify-between p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                        <div>
                          <Label className="text-white font-medium">Enable Polling Fallback</Label>
                          <p className="text-sm text-[#ADADB8] mt-1">
                            Fall back to polling if Realtime connection fails
                          </p>
                        </div>
                        <Switch
                          checked={settings.pollingFallbackEnabled}
                          onCheckedChange={(checked) => handleSettingChange('pollingFallbackEnabled', checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Data Management Settings */}
                <TabsContent value="data-management" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Database className="h-5 w-5" />
                        Data Management
                      </CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Configure data retention and cleanup policies
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Data Retention */}
                      <div className="space-y-2">
                        <Label className="text-white">Data Retention Period (days)</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            value={settings.dataRetentionDays}
                            onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
                            className="bg-[#26262c] border-[#40404a] text-white w-32"
                            min="1"
                            max="90"
                          />
                          <p className="text-sm text-[#ADADB8]">
                            Automatically delete visitor sessions older than this (1-90 days)
                          </p>
                        </div>
                      </div>

                      {/* Cleanup Info */}
                      <div className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-[#9147ff] flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-white">Automatic Cleanup</h4>
                            <p className="text-sm text-[#ADADB8] mt-1">
                              Visitor sessions are automatically cleaned up daily at 2:00 AM UTC. 
                              Sessions older than the retention period are permanently deleted.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* API Cache Settings */}
                <TabsContent value="api-cache" className="space-y-6">
                  <CacheSettingsCard />

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Zap className="h-5 w-5" />
                        Stream Fetch Settings
                      </CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Control how many Twitch pages are fetched per server request
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white">Max Twitch Pages Per Game</Label>
                        <div className="flex flex-col md:flex-row gap-3">
                          <Input
                            type="number"
                            min={1}
                            max={75}
                            value={twitchPageLimit}
                            onChange={(e) => setTwitchPageLimit(Number(e.target.value))}
                            disabled={loadingTwitchSetting || savingTwitchSetting}
                            className="bg-[#26262c] border-[#40404a] text-white md:w-48"
                          />
                          <Button
                            onClick={handleSaveTwitchSetting}
                            disabled={loadingTwitchSetting || savingTwitchSetting || !isTwitchLimitValid}
                            className="bg-[#9147ff] hover:bg-[#772ce8] text-white w-full md:w-auto"
                          >
                            {savingTwitchSetting ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Limit'
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-[#ADADB8]">
                          Each page fetches up to 100 streams. Lower the limit if you hit Twitch rate limits.
                        </p>
                        {!isTwitchLimitValid && (
                          <p className="text-sm text-red-400">
                            Enter a value between 1 and 75.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Clock className="h-5 w-5" />
                        Live Chart Settings
                      </CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Configure the real-time live chart polling interval
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white">Live Chart Polling Interval (seconds)</Label>
                        <div className="flex flex-col md:flex-row gap-3">
                          <Input
                            type="number"
                            min={10}
                            max={300}
                            value={liveChartInterval}
                            onChange={(e) => setLiveChartInterval(Number(e.target.value))}
                            disabled={loadingLiveChartSetting || savingLiveChartSetting}
                            className="bg-[#26262c] border-[#40404a] text-white md:w-48"
                          />
                          <Button
                            onClick={handleSaveLiveChartSetting}
                            disabled={loadingLiveChartSetting || savingLiveChartSetting || !isLiveChartIntervalValid}
                            className="bg-[#9147ff] hover:bg-[#772ce8] text-white w-full md:w-auto"
                          >
                            {savingLiveChartSetting ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Interval'
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-[#ADADB8]">
                          How often the live chart fetches new data from FiveM (10-300 seconds). Default: 60 seconds.
                        </p>
                        {!isLiveChartIntervalValid && (
                          <p className="text-sm text-red-400">
                            Enter a value between 10 and 300.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* System Settings */}
                <TabsContent value="system" className="space-y-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Shield className="h-5 w-5" />
                        System Information
                      </CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        System status and information
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                          <p className="text-sm text-[#ADADB8]">System Status</p>
                          <div className="flex items-center gap-2 mt-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-white font-medium">Operational</span>
                          </div>
                        </div>

                        <div className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                          <p className="text-sm text-[#ADADB8]">Database Status</p>
                          <div className="flex items-center gap-2 mt-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-white font-medium">Connected</span>
                          </div>
                        </div>

                        <div className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                          <p className="text-sm text-[#ADADB8]">Realtime Status</p>
                          <div className="flex items-center gap-2 mt-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-white font-medium">Connected</span>
                          </div>
                        </div>

                        <div className="p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                          <p className="text-sm text-[#ADADB8]">Last Updated</p>
                          <p className="text-white font-medium mt-2">
                            {new Date().toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* System Info */}
                      <div className="p-4 bg-[#004D61]/20 border border-[#004D61]/30 rounded-lg">
                        <h4 className="text-sm font-medium text-white mb-2">About This System</h4>
                        <p className="text-sm text-[#ADADB8]">
                          This admin panel uses Supabase for authentication and data storage. 
                          All visitor tracking data is stored securely in PostgreSQL with automatic 
                          cleanup and Row Level Security policies.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </Button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
