'use client';

/**
 * Character_Catalog surface for the Streamer_Profile (R3.1–R3.5).
 *
 * DESIGN DECISION — controlled CLIENT component:
 * The design calls this surface "server-renderable", but selecting a character
 * must drive the clips panel (R3.5), which is inherently interactive. Rather
 * than split presentation from interactivity, this is a small CONTROLLED client
 * component: it owns no selection state of its own and instead receives the
 * `selectedCharacter` and an `onSelect` callback from a parent client wrapper
 * (the `character-clips-panel.tsx` from task 12.1 owns the selection state and
 * fetches the selected character's clips). Each catalog entry renders as a real
 * `<button>` so selection is keyboard- and screen-reader-accessible, with
 * `aria-pressed` reflecting the selected entry. The `'use client'` directive is
 * required for the click handlers.
 *
 * The catalog data is derived server-side and already ordered by `lastSeen`
 * descending (most-recent first) by the Data_Layer's `buildCharacterCatalog`,
 * so this component renders `entries` in the order it receives them (R3.2).
 */

import { VenetianMask, CalendarClock, Film } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CharacterCatalogEntry } from '@/lib/streamer-characters';

interface CharacterCatalogProps {
  /**
   * Catalog entries to render, MOST-RECENT FIRST. The Data_Layer already orders
   * the catalog by `lastSeen` descending, so they are rendered as given (R3.2).
   */
  entries: CharacterCatalogEntry[];
  /** The currently selected character name, or `null` when none is selected. */
  selectedCharacter: string | null;
  /** Invoked with the character name when an entry is selected (drives clips, R3.5). */
  onSelect: (characterName: string) => void;
}

/**
 * Format an ISO timestamp to a friendly, locale-aware date (R3.3). Falls back
 * to the raw value if the string is not a parseable date so the UI never shows
 * "Invalid Date".
 */
function formatSeenDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** A single selectable character entry rendered as an accessible button (R3.5). */
function CharacterEntry({
  entry,
  selected,
  onSelect,
}: {
  entry: CharacterCatalogEntry;
  selected: boolean;
  onSelect: (characterName: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.characterName)}
      aria-pressed={selected}
      aria-label={`View clips for ${entry.characterName}, last seen ${formatSeenDate(
        entry.lastSeen,
      )}`}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-all',
        selected
          ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-100 shadow-[0_0_20px_rgba(0,217,255,0.12)]'
          : 'border-[#26262c] bg-[#18181b]/60 text-gray-200 hover:border-cyan-500/40 hover:text-cyan-200',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <VenetianMask
          className={selected ? 'h-4 w-4 shrink-0 text-cyan-300' : 'h-4 w-4 shrink-0 text-cyan-400/70'}
          aria-hidden="true"
        />
        <span className="truncate text-sm font-medium">{entry.characterName}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-[#ADADB8]">
        {entry.clipCount > 0 && (
          <span className="inline-flex items-center gap-1" title={`${entry.clipCount} clips`}>
            <Film className="h-3.5 w-3.5 text-purple-400/70" aria-hidden="true" />
            {entry.clipCount.toLocaleString()}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5 text-cyan-400/70" aria-hidden="true" />
          {formatSeenDate(entry.lastSeen)}
        </span>
      </span>
    </button>
  );
}

/**
 * Renders a streamer's Character_Catalog as a list of distinct, selectable
 * character names ordered most-recent first (R3.1, R3.2), each showing the date
 * the character was most recently observed (R3.3). When the catalog is empty it
 * shows a "no characters identified" message (R3.4). Selecting an entry invokes
 * `onSelect` to drive the clips panel (R3.5).
 */
export function CharacterCatalog({ entries, selectedCharacter, onSelect }: CharacterCatalogProps) {
  return (
    <Card variant="glass">
      <CardContent className="py-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <VenetianMask className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          Characters
        </h2>

        {entries.length === 0 ? (
          <p className="text-sm text-[#ADADB8]">No characters identified for this streamer yet.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Character catalog">
            {entries.map((entry) => (
              <li key={entry.characterName}>
                <CharacterEntry
                  entry={entry}
                  selected={selectedCharacter === entry.characterName}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default CharacterCatalog;
