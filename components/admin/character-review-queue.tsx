"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  AlertTriangle,
  UserCheck,
  UserX,
  Pencil,
  Check,
  X,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/lib/admin-api';
import type { ReviewQueueItem } from '@/lib/streamer-characters';

/** Shape of the backfill `result` returned by `{ kind: 'backfill' }` (R9.1). */
interface BackfillResult {
  processed: number;
  reused: number;
  aiCalls: number;
  /** Distinct unprocessed titles left after this run's per-run cap; re-run to resume. */
  remaining?: number;
}

/**
 * Admin review queue for low-confidence character extractions (R6.1).
 *
 * On mount it GETs the pending review queue from `/api/admin/characters`
 * (via {@link adminAPI.getCharacterReviewQueue}, which resolves to the raw
 * `{ success, items }` body). Each item exposes three actions that POST to the
 * same route:
 *
 *  - Confirm      → `{ kind: 'confirm', extractionId }`        (R6.3)
 *  - Override     → `{ kind: 'override', extractionId, name }` (R6.4)
 *  - No character → `{ kind: 'no-character', extractionId }`   (R6.5)
 *
 * A successful action removes the item from the local list (it leaves the
 * pending queue per R6.3) and shows a success toast; a failure keeps the item
 * and shows an error toast.
 *
 * Visual conventions mirror `components/admin/backfill-data-card.tsx`: the
 * `#1a1a1e` / `#26262c` dark palette, cyan/purple accents, shadcn primitives,
 * lucide icons, and `useToast` for feedback.
 */
export function CharacterReviewQueue() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-item id of the action currently in flight, so we can disable its row.
  const [pendingId, setPendingId] = useState<number | null>(null);
  // Per-item override draft text, keyed by extraction id.
  const [overrideDrafts, setOverrideDrafts] = useState<Record<number, string>>({});
  // The extraction id whose inline override input is open, or null.
  const [editingId, setEditingId] = useState<number | null>(null);
  // Backfill control: target username, in-flight flag, and last run's counts.
  const [backfillUsername, setBackfillUsername] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const { toast } = useToast();

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getCharacterReviewQueue();
      // The admin route returns `{ success, items }` directly (not under `data`).
      if (response?.success) {
        setItems(Array.isArray(response.items) ? response.items : []);
      } else {
        setItems([]);
        setError('Failed to load review queue');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load review queue';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const removeItem = (extractionId: number) => {
    setItems((prev) => prev.filter((item) => item.id !== extractionId));
    setEditingId((prev) => (prev === extractionId ? null : prev));
    setOverrideDrafts((prev) => {
      const next = { ...prev };
      delete next[extractionId];
      return next;
    });
  };

  /**
   * Trigger a character-extraction backfill for a single streamer (R9.1). POSTs
   * `{ kind: 'backfill', username }` to `/api/admin/characters`, which reads the
   * streamer's recent stream titles, runs extraction, and inserts rows into
   * `character_extractions`. Each run is capped (new extractions are bounded per
   * invocation to avoid serverless timeouts), so when `remaining > 0` the admin
   * re-runs to resume. On success it reports the run counts and refreshes the
   * review queue so any new low-confidence extractions appear immediately.
   */
  const handleBackfill = async () => {
    const username = backfillUsername.trim();
    if (!username) {
      toast({
        title: 'Username required',
        description: 'Enter a streamer username to backfill.',
        variant: 'destructive',
      });
      return;
    }
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const response = await adminAPI.postCharacterAction({ kind: 'backfill', username });
      if (response?.success) {
        const result = (response.result ?? null) as BackfillResult | null;
        setBackfillResult(result);
        const remaining = result?.remaining ?? 0;
        toast({
          title: remaining > 0 ? 'Backfill batch complete' : 'Backfill complete',
          description: result
            ? `${result.processed} processed, ${result.reused} reused, ${result.aiCalls} AI calls for ${username}` +
              (remaining > 0 ? ` — ${remaining} left, run again to continue.` : '')
            : `Backfill finished for ${username}`,
        });
        // Surface any newly created pending extractions.
        loadQueue();
      } else {
        toast({
          title: 'Backfill failed',
          description: 'The backfill could not be started. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backfill failed';
      toast({
        title: 'Backfill failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setBackfilling(false);
    }
  };

  /**
   * POST a single admin action. On success the item leaves the pending queue
   * (R6.3) and is removed locally; on failure the item stays put and an error
   * toast is shown.
   */
  const submitAction = async (
    action: Record<string, unknown>,
    extractionId: number,
    successMessage: string,
  ) => {
    setPendingId(extractionId);
    try {
      const response = await adminAPI.postCharacterAction(action);
      if (response?.success) {
        removeItem(extractionId);
        toast({
          title: 'Review saved',
          description: successMessage,
        });
      } else {
        toast({
          title: 'Action failed',
          description: 'The review could not be saved. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      toast({
        title: 'Action failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleConfirm = (item: ReviewQueueItem) => {
    submitAction(
      { kind: 'confirm', extractionId: item.id },
      item.id,
      `Confirmed "${item.characterName ?? 'no character'}" for ${item.streamerDisplayName}`,
    );
  };

  const handleNoCharacter = (item: ReviewQueueItem) => {
    submitAction(
      { kind: 'no-character', extractionId: item.id },
      item.id,
      `Marked as no character for ${item.streamerDisplayName}`,
    );
  };

  const handleOverride = (item: ReviewQueueItem) => {
    const name = (overrideDrafts[item.id] ?? '').trim();
    if (!name) {
      toast({
        title: 'Name required',
        description: 'Enter a corrected character name before saving.',
        variant: 'destructive',
      });
      return;
    }
    submitAction(
      { kind: 'override', extractionId: item.id, name },
      item.id,
      `Overrode character to "${name}" for ${item.streamerDisplayName}`,
    );
  };

  return (
    <Card className="bg-[#1a1a1e] border-[#26262c]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <ListChecks className="h-5 w-5" />
              Character Review Queue
            </CardTitle>
            <CardDescription className="text-[#ADADB8]">
              Confirm, correct, or reject low-confidence character extractions
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadQueue}
            disabled={loading}
            className="text-[#ADADB8] hover:text-white h-7 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/*
          Backfill control (R9.1): kicks off character extraction for one
          streamer. There is no automatic processor, so this is how an admin
          starts/refreshes a streamer's character data. Mirrors the
          backfill-data-card styling.
        */}
        <div className="p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Run character backfill</span>
          </div>
          <p className="text-xs text-[#ADADB8]">
            Extract characters from a streamer&apos;s recent stream titles. New low-confidence
            results appear in the queue below for review.
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={backfillUsername}
              onChange={(e) => setBackfillUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !backfilling) handleBackfill();
              }}
              placeholder="Streamer username (e.g. penta)"
              disabled={backfilling}
              className="bg-[#26262c] border-[#40404a] text-white h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={handleBackfill}
              disabled={backfilling || backfillUsername.trim().length === 0}
              className="bg-[#9147ff] hover:bg-[#772ce8] text-white h-8 px-3 text-xs flex-shrink-0"
            >
              {backfilling ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Run backfill
                </>
              )}
            </Button>
          </div>
          {backfillResult && (
            <p className="text-xs text-emerald-300">
              ✓ {backfillResult.processed} processed, {backfillResult.reused} reused,{' '}
              {backfillResult.aiCalls} AI calls
              {(backfillResult.remaining ?? 0) > 0 && (
                <span className="text-amber-300">
                  {' '}
                  — {backfillResult.remaining} title{backfillResult.remaining === 1 ? '' : 's'} left,
                  run again to continue.
                </span>
              )}
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 text-sm text-[#ADADB8]">
            Loading review queue...
          </div>
        ) : error ? (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-300">
            No characters awaiting review
          </div>
        ) : (
          items.map((item) => {
            const busy = pendingId === item.id;
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className="p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {item.streamerDisplayName}
                      </span>
                      {item.characterName ? (
                        <Badge
                          variant="outline"
                          className="border-cyan-500/30 text-cyan-300 text-xs"
                        >
                          {item.characterName}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-[#40404a] text-[#ADADB8] text-xs italic"
                        >
                          no character
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#ADADB8] truncate">{item.sourceTitle}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="border-purple-500/30 text-purple-300 text-xs"
                      >
                        {Math.round(item.confidence * 100)}% confidence
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-[#40404a] text-[#ADADB8] text-xs uppercase"
                      >
                        {item.method}
                      </Badge>
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={overrideDrafts[item.id] ?? ''}
                      onChange={(e) =>
                        setOverrideDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Corrected character name"
                      disabled={busy}
                      className="bg-[#26262c] border-[#40404a] text-white h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleOverride(item)}
                      disabled={busy}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 px-2 flex-shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      className="text-[#ADADB8] hover:text-white h-8 px-2 flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => handleConfirm(item)}
                    disabled={busy}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3 text-xs"
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(isEditing ? null : item.id)}
                    disabled={busy}
                    className="border-[#40404a] text-[#ADADB8] hover:text-white hover:bg-[#26262c] h-8 px-3 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Override
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNoCharacter(item)}
                    disabled={busy}
                    className="border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10 h-8 px-3 text-xs"
                  >
                    <UserX className="h-3.5 w-3.5 mr-1" />
                    No character
                  </Button>
                  {busy && (
                    <RefreshCw className="h-3.5 w-3.5 text-[#ADADB8] animate-spin" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default CharacterReviewQueue;
