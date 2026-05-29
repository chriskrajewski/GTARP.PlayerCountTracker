"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, DatabaseZap, AlertTriangle, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/lib/admin-api';

interface DataGap {
  gap_start: string;
  gap_end: string;
  duration_seconds: number;
  duration_human: string;
}

export function BackfillDataCard() {
  const [autoDetect, setAutoDetect] = useState(true);
  const [gapStart, setGapStart] = useState('');
  const [gapEnd, setGapEnd] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(180);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [running, setRunning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const canRun = autoDetect ? gaps.length > 0 : (gapStart.trim().length > 0 && gapEnd.trim().length > 0);

  const detectGaps = async () => {
    setDetecting(true);
    try {
      const response = await adminAPI.detectDataGaps();
      setGaps(response.data?.gaps || []);
      if (!response.data?.gaps?.length) {
        toast({
          title: 'No gaps detected',
          description: 'No significant data gaps found in the last 48 hours.',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed';
      toast({
        title: 'Gap detection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (autoDetect) {
      detectGaps();
    }
  }, [autoDetect]);

  const handleSelectGap = (gap: DataGap) => {
    setGapStart(gap.gap_start);
    setGapEnd(gap.gap_end);
    setAutoDetect(false);
  };

  const handleBackfill = async () => {
    if (!canRun) return;

    const targetStart = autoDetect && gaps.length > 0 ? gaps[0].gap_start : gapStart;
    const targetEnd = autoDetect && gaps.length > 0 ? gaps[0].gap_end : gapEnd;

    const confirmed = window.confirm(
      `Backfill player counts?\n\nGap: ${new Date(targetStart).toLocaleString()} → ${new Date(targetEnd).toLocaleString()}\n\nEstimated data will be inserted based on the average of the previous ${lookbackDays} days.`
    );
    if (!confirmed) return;

    setRunning(true);
    setResult(null);

    try {
      const params: any = {
        interval_seconds: intervalSeconds,
        lookback_days: lookbackDays,
      };
      if (autoDetect && gaps.length > 0) {
        params.gap_start = gaps[0].gap_start;
        params.gap_end = gaps[0].gap_end;
      } else if (!autoDetect) {
        params.gap_start = gapStart;
        params.gap_end = gapEnd;
      }

      const response = await adminAPI.backfillPlayerCounts(params);
      setResult(response.data);
      toast({
        title: 'Backfill complete',
        description: `Inserted ${response.data?.total_inserted || 0} records`,
      });
      // Refresh gaps after backfill
      detectGaps();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backfill failed';
      toast({
        title: 'Backfill failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="bg-[#1a1a1e] border-[#26262c]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <DatabaseZap className="h-5 w-5" />
          Backfill Player Counts
        </CardTitle>
        <CardDescription className="text-[#ADADB8]">
          Fill gaps in player count data using historical averages from the same time-of-day
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Detected Gaps */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-white font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Detected Gaps (last 48h)
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={detectGaps}
              disabled={detecting}
              className="text-[#ADADB8] hover:text-white h-7 px-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${detecting ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {detecting ? (
            <div className="p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 text-sm text-[#ADADB8]">
              Scanning for gaps...
            </div>
          ) : gaps.length === 0 ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-300">
              No data gaps detected
            </div>
          ) : (
            <div className="space-y-2">
              {gaps.map((gap, i) => (
                <div
                  key={i}
                  className="p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-red-500/30 text-red-300 text-xs">
                        {gap.duration_human}
                      </Badge>
                      <span className="text-xs text-[#ADADB8] truncate">
                        {new Date(gap.gap_start).toLocaleString()} → {new Date(gap.gap_end).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectGap(gap)}
                    className="text-cyan-400 hover:text-cyan-300 h-7 px-2 text-xs flex-shrink-0"
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#26262c] pt-4">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Inserts estimated records based on averages from the previous N days. Max 48 hours per run.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 mb-4">
            <div>
              <Label className="text-white font-medium">Use largest detected gap</Label>
              <p className="text-xs text-[#ADADB8] mt-0.5">
                Automatically backfill the biggest gap found above
              </p>
            </div>
            <Switch
              checked={autoDetect}
              onCheckedChange={setAutoDetect}
              disabled={running}
            />
          </div>

          {!autoDetect && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Gap Start (ISO 8601 / UTC)</Label>
                <Input
                  value={gapStart}
                  onChange={(e) => setGapStart(e.target.value)}
                  placeholder="2026-05-29T06:45:00Z"
                  disabled={running}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white text-sm">Gap End (ISO 8601 / UTC)</Label>
                <Input
                  value={gapEnd}
                  onChange={(e) => setGapEnd(e.target.value)}
                  placeholder="2026-05-29T19:33:00Z"
                  disabled={running}
                  className="bg-[#26262c] border-[#40404a] text-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-white text-sm">Interval (seconds)</Label>
              <Input
                type="number"
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                min={60}
                max={900}
                disabled={running}
                className="bg-[#26262c] border-[#40404a] text-white"
              />
              <p className="text-xs text-[#ADADB8]">Default: 180s (3 min)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white text-sm">Lookback Days</Label>
              <Input
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
                min={1}
                max={30}
                disabled={running}
                className="bg-[#26262c] border-[#40404a] text-white"
              />
              <p className="text-xs text-[#ADADB8]">Days to average from</p>
            </div>
          </div>

          <Button
            onClick={handleBackfill}
            disabled={!canRun || running}
            className="bg-[#9147ff] hover:bg-[#772ce8] text-white w-full md:w-auto"
          >
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Backfill...
              </>
            ) : autoDetect ? (
              'Backfill Largest Gap'
            ) : (
              'Run Backfill'
            )}
          </Button>
        </div>

        {result && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
            <p className="text-sm text-emerald-200 font-medium">
              ✓ Backfill complete — {result.total_inserted} records inserted
            </p>
            <p className="text-xs text-emerald-300/70">
              Gap: {new Date(result.gap_start).toLocaleString()} → {new Date(result.gap_end).toLocaleString()}
            </p>
            <div className="text-xs text-emerald-300/70 grid grid-cols-2 md:grid-cols-3 gap-1">
              {result.servers?.map((s: any) => (
                <span key={s.server_id}>
                  {s.server_name}: {s.records_inserted}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
