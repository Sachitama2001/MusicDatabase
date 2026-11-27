import MiniSearch from 'minisearch';
import type {
  FeelingLexicon,
  RhythmFeel,
  Section,
  SectionLabel,
  Track
} from '../schema';

export interface SectionRecord {
  uid: string;
  track: Track;
  section: Section;
  effectiveBpm: number | undefined;
  effectiveKey: string | undefined;
  effectiveTimeSignature: string | undefined;
  expandedFeelings: string[];
  searchableText: string;
}

export type SortOption = 'relevance' | 'newest' | 'bpmAsc' | 'bpmDesc' | 'ratingDesc';
export type ElementFilter = 'all' | 'rhythm' | 'melody' | 'harmony' | 'hasMidi';

export interface SearchFilter {
  query: string;
  romanQuery?: string;
  keyQuery?: string;
  bpmMin?: number;
  bpmMax?: number;
  sectionLabels?: SectionLabel[];
  rhythmFeels?: RhythmFeel[];
  elementFilter?: ElementFilter;
  feelingTags?: string[];
  feelingTagMode?: 'AND' | 'OR';
  sort?: SortOption;
}

export interface SearchHit {
  record: SectionRecord;
  score: number;
  matchedTerms: string[];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function buildSynonymLookup(lexicon: FeelingLexicon): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const entry of lexicon.entries) {
    const group = new Set<string>([
      normalizeToken(entry.canonical),
      ...entry.synonyms.map(normalizeToken)
    ]);
    for (const term of group) {
      const existing = map.get(term);
      if (existing) {
        for (const g of group) existing.add(g);
      } else {
        map.set(term, new Set(group));
      }
    }
  }
  return map;
}

export function expandQueryTerm(term: string, lookup: Map<string, Set<string>>): string[] {
  const norm = normalizeToken(term);
  if (!norm) return [];
  const expanded = new Set<string>([norm]);

  const direct = lookup.get(norm);
  if (direct) {
    for (const s of direct) expanded.add(s);
  }

  // Also expand if query term is a substring of a lexicon term or vice versa (helpful for Japanese inflection)
  for (const [key, group] of lookup.entries()) {
    if (norm.length >= 2 && (key.includes(norm) || norm.includes(key))) {
      for (const s of group) expanded.add(s);
    }
  }

  return Array.from(expanded);
}

function parseRomanToken(token: string): { degree: string; quality: string } {
  const cleaned = token.trim().replace(/♭/g, 'b').replace(/♯/g, '#');
  const match = /^([b#]*[ivIV]+)(.*)$/.exec(cleaned);
  if (!match) {
    return { degree: '', quality: cleaned.toLowerCase() };
  }
  return {
    degree: match[1],
    quality: match[2].toLowerCase()
  };
}

export function matchesRomanSubsequence(
  romanNumerals: string[] | undefined,
  romanQuery: string
): boolean {
  const queryTokens = romanQuery
    .split(/[\s,\->→/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseRomanToken);
  if (queryTokens.length === 0) return true;
  if (!romanNumerals || romanNumerals.length < queryTokens.length) return false;

  const target = romanNumerals.map(parseRomanToken);
  for (let start = 0; start <= target.length - queryTokens.length; start++) {
    let allMatch = true;
    for (let offset = 0; offset < queryTokens.length; offset++) {
      const q = queryTokens[offset];
      const t = target[start + offset];
      if (q.degree) {
        if (t.degree !== q.degree || !t.quality.includes(q.quality)) {
          allMatch = false;
          break;
        }
      } else if (!`${t.degree}${t.quality}`.toLowerCase().includes(q.quality)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

function tokenizeMixedText(text: string): string[] {
  const tokens = new Set<string>();
  const normalized = text.toLowerCase();
  const segments = normalized.split(/[\s,、。・/()[\]{}|:;!?「」『』]+/).filter(Boolean);

  for (const seg of segments) {
    tokens.add(seg);
    // Add Japanese bigrams so substring queries work smoothly with MiniSearch
    if (/[^\x00-\x7f]/.test(seg) && seg.length >= 2) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2));
      }
    }
  }
  return Array.from(tokens);
}

export class MusicSearchEngine {
  private readonly records: SectionRecord[];
  private readonly lookup: Map<string, Set<string>>;
  private readonly miniSearch: MiniSearch<{ uid: string; text: string; feelings: string; title: string }>;

  constructor(tracks: Track[], lexicon: FeelingLexicon) {
    this.lookup = buildSynonymLookup(lexicon);
    this.records = [];

    for (const track of tracks) {
      for (const section of track.sections) {
        const expandedSet = new Set<string>();
        for (const f of [...(track.overallFeelings ?? []), ...section.feelings]) {
          for (const exp of expandQueryTerm(f, this.lookup)) {
            expandedSet.add(exp);
          }
        }

        const textParts = [
          track.title,
          track.artist,
          ...(track.genres ?? []),
          ...(track.overallFeelings ?? []),
          track.notes ?? '',
          section.displayName,
          section.label,
          ...section.feelings,
          section.feelingSummary,
          section.rhythm?.feel ?? '',
          section.rhythm?.grooveDescription ?? '',
          section.rhythm?.drumNotes ?? '',
          section.rhythm?.bassNotes ?? '',
          ...(section.rhythm?.tags ?? []),
          section.melody?.scaleOrMode ?? '',
          section.melody?.contour ?? '',
          section.melody?.hookDescription ?? '',
          section.melody?.register ?? '',
          ...(section.melody?.tags ?? []),
          ...(section.harmony?.chordProgression ?? []),
          ...(section.harmony?.romanNumerals ?? []),
          section.harmony?.cadenceOrMotion ?? '',
          section.harmony?.voicingNotes ?? '',
          section.harmony?.modulationNotes ?? '',
          ...(section.harmony?.tags ?? []),
          ...(section.instruments ?? []),
          ...(section.tags ?? []),
          ...Array.from(expandedSet)
        ];

        this.records.push({
          uid: `${track.id}::${section.id}`,
          track,
          section,
          effectiveBpm: section.localBpm ?? track.bpm,
          effectiveKey: section.localKey ?? track.key,
          effectiveTimeSignature: section.localTimeSignature ?? track.timeSignature,
          expandedFeelings: Array.from(expandedSet),
          searchableText: textParts.filter(Boolean).join(' ').toLowerCase()
        });
      }
    }

    this.miniSearch = new MiniSearch({
      idField: 'uid',
      fields: ['title', 'feelings', 'text'],
      tokenize: tokenizeMixedText,
      searchOptions: {
        boost: { feelings: 3, title: 2, text: 1 },
        prefix: true
      }
    });

    this.miniSearch.addAll(
      this.records.map((r) => ({
        uid: r.uid,
        title: `${r.track.artist} ${r.track.title} ${r.section.displayName}`,
        feelings: `${r.section.feelings.join(' ')} ${r.expandedFeelings.join(' ')}`,
        text: r.searchableText
      }))
    );
  }

  getAllRecords(): SectionRecord[] {
    return this.records;
  }

  getAllFeelingTags(): string[] {
    const counts = new Map<string, number>();
    for (const r of this.records) {
      for (const f of r.section.feelings) {
        counts.set(f, (counts.get(f) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
      .map(([tag]) => tag);
  }

  search(filter: SearchFilter): SearchHit[] {
    const rawTerms = filter.query
      .trim()
      .split(/[\s　]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const miniScores = new Map<string, number>();
    if (rawTerms.length > 0) {
      const expandedAll = rawTerms.flatMap((t) => expandQueryTerm(t, this.lookup));
      const msResults = this.miniSearch.search(expandedAll.join(' '), {
        combineWith: 'OR'
      });
      for (const res of msResults) {
        miniScores.set(String(res.id), res.score);
      }
    }

    const hits: SearchHit[] = [];

    for (const record of this.records) {
      if (!this.passesStructuredFilters(record, filter)) {
        continue;
      }

      if (rawTerms.length === 0) {
        hits.push({ record, score: 1, matchedTerms: [] });
        continue;
      }

      const matchedTerms: string[] = [];
      let termScore = 0;

      for (const rawTerm of rawTerms) {
        const expanded = expandQueryTerm(rawTerm, this.lookup);
        const matchedVariant = expanded.find((variant) =>
          record.searchableText.includes(variant)
        );
        if (matchedVariant) {
          matchedTerms.push(rawTerm);
          const isDirectFeeling = record.section.feelings.some((f) =>
            expanded.includes(normalizeToken(f))
          );
          termScore += isDirectFeeling ? 12 : 6;
        }
      }

      const msScore = miniScores.get(record.uid) ?? 0;

      // Require every query term to match (either directly or via synonym expansion)
      if (matchedTerms.length === rawTerms.length) {
        hits.push({
          record,
          score: termScore + msScore,
          matchedTerms
        });
      }
    }

    return this.sortHits(hits, filter.sort ?? 'relevance');
  }

  private passesStructuredFilters(record: SectionRecord, filter: SearchFilter): boolean {
    if (filter.sectionLabels && filter.sectionLabels.length > 0) {
      if (!filter.sectionLabels.includes(record.section.label)) return false;
    }

    if (filter.rhythmFeels && filter.rhythmFeels.length > 0) {
      const feel = record.section.rhythm?.feel;
      if (!feel || !filter.rhythmFeels.includes(feel)) return false;
    }

    if (filter.elementFilter && filter.elementFilter !== 'all') {
      if (filter.elementFilter === 'rhythm' && !record.section.rhythm) return false;
      if (filter.elementFilter === 'melody' && !record.section.melody) return false;
      if (filter.elementFilter === 'harmony' && !record.section.harmony) return false;
      if (
        filter.elementFilter === 'hasMidi' &&
        (!record.section.midiClips || record.section.midiClips.length === 0)
      ) {
        return false;
      }
    }

    if (filter.bpmMin !== undefined && !Number.isNaN(filter.bpmMin)) {
      if (record.effectiveBpm === undefined || record.effectiveBpm < filter.bpmMin) return false;
    }
    if (filter.bpmMax !== undefined && !Number.isNaN(filter.bpmMax)) {
      if (record.effectiveBpm === undefined || record.effectiveBpm > filter.bpmMax) return false;
    }

    if (filter.keyQuery && filter.keyQuery.trim().length > 0) {
      const kq = filter.keyQuery.trim().toLowerCase();
      if (!record.effectiveKey || !record.effectiveKey.toLowerCase().includes(kq)) {
        return false;
      }
    }

    if (filter.romanQuery && filter.romanQuery.trim().length > 0) {
      if (!matchesRomanSubsequence(record.section.harmony?.romanNumerals, filter.romanQuery)) {
        return false;
      }
    }

    if (filter.feelingTags && filter.feelingTags.length > 0) {
      const mode = filter.feelingTagMode ?? 'OR';
      const checkTag = (tag: string) => {
        const expanded = expandQueryTerm(tag, this.lookup);
        return expanded.some(
          (variant) =>
            record.expandedFeelings.includes(variant) || record.searchableText.includes(variant)
        );
      };
      const matched =
        mode === 'AND'
          ? filter.feelingTags.every(checkTag)
          : filter.feelingTags.some(checkTag);
      if (!matched) return false;
    }

    return true;
  }

  private sortHits(hits: SearchHit[], sort: SortOption): SearchHit[] {
    const copy = [...hits];
    copy.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.record.track.updatedAt.localeCompare(a.record.track.updatedAt);
        case 'bpmAsc':
          return (a.record.effectiveBpm ?? 9999) - (b.record.effectiveBpm ?? 9999);
        case 'bpmDesc':
          return (b.record.effectiveBpm ?? -1) - (a.record.effectiveBpm ?? -1);
        case 'ratingDesc':
          return (b.record.section.rating ?? 0) - (a.record.section.rating ?? 0);
        case 'relevance':
        default:
          return (
            b.score - a.score ||
            (b.record.section.rating ?? 0) - (a.record.section.rating ?? 0) ||
            b.record.track.updatedAt.localeCompare(a.record.track.updatedAt)
          );
      }
    });
    return copy;
  }
}

export function formatSectionForChatGpt(track: Track, section: Section): string {
  const bpm = section.localBpm ?? track.bpm;
  const key = section.localKey ?? track.key;
  const ts = section.localTimeSignature ?? track.timeSignature ?? '4/4';

  const lines: string[] = [
    `### 参照セクション: ${track.artist} - ${track.title} [${section.displayName}]`,
    `- Track ID: \`${track.id}\` / Section ID: \`${section.id}\``,
    `- BPM: ${bpm ?? '未設定'} / Key: ${key ?? '未設定'} / Time Signature: ${ts}`,
    `- Feelings: ${section.feelings.join(', ')}`,
    `- Summary: ${section.feelingSummary}`
  ];

  if (section.rhythm) {
    lines.push(
      `- Rhythm (${section.rhythm.feel ?? 'unspecified'}): ${[
        section.rhythm.grooveDescription,
        section.rhythm.drumNotes,
        section.rhythm.bassNotes
      ]
        .filter(Boolean)
        .join(' / ')}`
    );
  }
  if (section.harmony) {
    if (section.harmony.romanNumerals?.length) {
      lines.push(`- Roman Numerals: ${section.harmony.romanNumerals.join(' -> ')}`);
    }
    if (section.harmony.chordProgression?.length) {
      lines.push(`- Chords: ${section.harmony.chordProgression.join(' -> ')}`);
    }
    if (section.harmony.cadenceOrMotion) {
      lines.push(`- Harmony Motion: ${section.harmony.cadenceOrMotion}`);
    }
  }
  if (section.melody) {
    lines.push(
      `- Melody: ${[
        section.melody.scaleOrMode,
        section.melody.contour,
        section.melody.hookDescription
      ]
        .filter(Boolean)
        .join(' / ')}`
    );
  }
  lines.push(
    '',
    'この参照セクションの雰囲気と構成要素を活かして、LLM_GUIDE.md の MidiClip JSON 形式で piano / bass / drum の4小節パターンを作成してください。'
  );
  return lines.join('\n');
}
