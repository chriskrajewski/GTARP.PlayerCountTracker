"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/lib/admin-api';

export function ServerIdMigrateCard() {
  const [oldServerId, setOldServerId] = useState('');
  const [newServerId, setNewServerId] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const canMigrate = oldServerId.trim().length > 0 && newServerId.trim().length > 0 && oldServerId !== newServerId;

  const handleMigrate = async () => {
    if (!canMigrate) return;

    const confirmed = window.confirm(
      `Migrate server ID "${oldServerId}" → "${newServerId}"?\n\nThis will update all historical data across all tables. This action cannot be easily undone.`
    );
    if (!confirmed) return;

    setMigrating(true);
    setResult(null);

    try {
      const response = await adminAPI.migrateServerId(oldServerId.trim(), newServerId.trim());
      setResult(response.data);
      setOldServerId('');
      setNewServerId('');
      toast({
        title: 'Migration complete',
        description: `Server ID migrated from "${oldServerId}" to "${newServerId}"`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Migration failed';
      toast({
        title: 'Migration failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Card className="bg-[#1a1a1e] border-[#26262c]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <ArrowRight className="h-5 w-5" />
          Migrate Server ID
        </CardTitle>
        <CardDescription className="text-[#ADADB8]">
          Change a server&apos;s FiveM ID while preserving all historical data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">
            This migrates all data (player counts, capacity, resources, predictions) from the old ID to the new one. Use when a server changes its cfx.re code.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-3">
          <div className="flex-1 space-y-1.5 w-full">
            <Label className="text-white text-sm">Old Server ID</Label>
            <Input
              value={oldServerId}
              onChange={(e) => setOldServerId(e.target.value)}
              placeholder="e.g. 3lamjz"
              disabled={migrating}
              className="bg-[#26262c] border-[#40404a] text-white"
            />
          </div>
          <ArrowRight className="h-5 w-5 text-[#ADADB8] hidden md:block mb-2" />
          <div className="flex-1 space-y-1.5 w-full">
            <Label className="text-white text-sm">New Server ID</Label>
            <Input
              value={newServerId}
              onChange={(e) => setNewServerId(e.target.value)}
              placeholder="e.g. kekbkv"
              disabled={migrating}
              className="bg-[#26262c] border-[#40404a] text-white"
            />
          </div>
          <Button
            onClick={handleMigrate}
            disabled={!canMigrate || migrating}
            className="bg-[#9147ff] hover:bg-[#772ce8] text-white w-full md:w-auto"
          >
            {migrating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Migrating...
              </>
            ) : (
              'Migrate'
            )}
          </Button>
        </div>

        {result && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-sm text-emerald-200 font-medium mb-1">
              ✓ Migrated &quot;{result.server_name}&quot; from {result.old_id} → {result.new_id}
            </p>
            <div className="text-xs text-emerald-300/70 space-y-0.5">
              {Object.entries(result.migrated || {}).map(([table, count]) => (
                <span key={table} className="inline-block mr-3">
                  {table}: {count as number} rows
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
