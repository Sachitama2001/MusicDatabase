import MiniSearch from 'minisearch';
import type {
  ChordEvent,
  FeelingLexicon,
  Section,
  SectionLabel,
  Track
} from '../schema';

export interface SectionRecord {
  uid: string;
  track: Track;
  section: Section;
  effectiveBpm: number;
  effectiveKey: string;
  effectiveTimeSignature: string;
  expandedFeelings: string[];
  searchableText: string;
}

export type SortOption = 'relevance' | 'newest' | 'bpmAsc' | 'bpmDesc' | 'ratingDesc';

export interface SearchFilter {
  query: string;
  romanQuery?: string;
  chordQuery?: string;
  keyQuery?: string;
  bpmMin?: number;
  bpmMax?: number;
  sectionLabels?: SectionLabel[];
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

  for (const [key, group] of lookup.entries()) {
    if (norm.length >= 2 && (key.includes(norm) || norm.includes(key))) {
      for (const s of group) expanded.add(s);
    }
  }

  return Array.from(expanded);
}

function parseRomanToken(token: string): { degree: string; quality: string } {
  const cleaned = token.trim().replace(/♭/g, 'b').replace(/♯/g, '#');
  const match = /^([b#]*(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i))(.*)$/.exec(cleaned);
  if (!match) {
    return { degree: '', quality: cleaned.toLowerCase() };
  }
  return {
    degree: match[1],
    quality: match[2].toLowerCase()
  };
}

export function matchesRomanSubsequence(
  romanNumerals: string[],
  romanQuery: string
): boolean {
  const queryTokens = romanQuery
    .split(/[\s,\->→|]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseRomanToken);
  if (queryTokens.length === 0) return true;
  if (romanNumerals.length < queryTokens.length) return false;

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

export function matchesChordSubsequence(
  chordSymbols: string[],
  chordQuery: string
): boolean {
  const queryTokens = chordQuery
    .split(/[\s,\->→|]+/)
    .map((t) => t.trim().replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase())
    .filter(Boolean);
  if (queryTokens.length === 0) return true;
  if (chordSymbols.length < queryTokens.length) return false;

  const target = chordSymbols.map((s) =>
    s.trim().replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase()
  );
  for (let start = 0; start <= target.length - queryTokens.length; start++) {
    let allMatch = true;
    for (let offset = 0; offset < queryTokens.length; offset++) {
      if (!target[start + offset].includes(queryTokens[offset])) {
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
    if (/[^\x00-\x7f]/.test(seg) && seg.length >= 2) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2));
      }
    }
  }
  return Array.from(tokens);
}

export class ChordSearchEngine {
  private readonly records: SectionRecord[];
  private readonly lookup: Map<string, Set<string>>;
  private readonly miniSearch: MiniSearch<{ uid: string; text: string; feelings: string; title: string }>;

  constructor(tracks: Track[], lexicon: FeelingLexicon) {
    this.lookup = buildSynonymLookup(lexicon);
    this.records = [];

    for (const track of tracks) {
      for (const section of track.sections) {
        const expandedSet = new Set<string>();
        for (const f of section.feelings) {
          for (const exp of expandQueryTerm(f, this.lookup)) {
            expandedSet.add(exp);
          }
        }

        const textParts = [
          track.title,
          track.artist,
          track.key,
          ...(track.genres ?? []),
          section.displayName,
          section.label,
          section.localKey ?? '',
          ...section.feelings,
          section.feelingSummary,
          section.cadenceOrMotion ?? '',
          ...section.chords.flatMap((c) => [c.symbol, c.roman, c.note ?? '']),
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
      if (!this.passesStructuredFilters(record, filter)) continue;

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

      if (matchedTerms.length === rawTerms.length) {
        hits.push({
          record,
          score: termScore + (miniScores.get(record.uid) ?? 0),
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

    if (filter.bpmMin !== undefined && !Number.isNaN(filter.bpmMin)) {
      if (record.effectiveBpm < filter.bpmMin) return false;
    }
    if (filter.bpmMax !== undefined && !Number.isNaN(filter.bpmMax)) {
      if (record.effectiveBpm > filter.bpmMax) return false;
    }

    if (filter.keyQuery && filter.keyQuery.trim().length > 0) {
      if (!record.effectiveKey.toLowerCase().includes(filter.keyQuery.trim().toLowerCase())) {
        return false;
      }
    }

    if (filter.romanQuery && filter.romanQuery.trim().length > 0) {
      const romans = record.section.chords.map((c) => c.roman);
      if (!matchesRomanSubsequence(romans, filter.romanQuery)) return false;
    }

    if (filter.chordQuery && filter.chordQuery.trim().length > 0) {
      const symbols = record.section.chords.map((c) => c.symbol);
      if (!matchesChordSubsequence(symbols, filter.chordQuery)) return false;
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
          return a.record.effectiveBpm - b.record.effectiveBpm;
        case 'bpmDesc':
          return b.record.effectiveBpm - a.record.effectiveBpm;
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

export function formatChordsAsQuickLine(chords: ChordEvent[]): string {
  return chords.map((c) => `${c.symbol}(${c.beats})`).join(' ');
}

export function formatSectionForChatGpt(track: Track, section: Section): string {
  const bpm = section.localBpm ?? track.bpm;
  const key = section.localKey ?? track.key;
  const ts = section.localTimeSignature ?? track.timeSignature;
  const lines = [
    `### 参照コード進行: ${track.artist} - ${track.title} [${section.displayName}]`,
    `- ChordTube: ${track.source.url}`,
    `- BPM: ${bpm} / Key: ${key} / Time: ${ts}`,
    `- Feelings: ${section.feelings.join(', ')}`,
    `- Summary: ${section.feelingSummary}`,
    `- Roman: ${section.chords.map((c) => `${c.roman}(${c.beats})`).join(' -> ')}`,
    `- Chords: ${formatChordsAsQuickLine(section.chords)}`
  ];
  if (section.cadenceOrMotion) {
    lines.push(`- Motion: ${section.cadenceOrMotion}`);
  }
  for (const annotation of section.theoryAnnotations ?? []) {
    lines.push(`- Theory: ${annotation.technique} [${annotation.matchType}; ${annotation.confidence}] — ${annotation.note}`);
    if (annotation.theoryRefs.length) lines.push(`  Theory refs: ${annotation.theoryRefs.join(', ')}`);
    for (const source of annotation.sources) {
      lines.push(`  Source: [${source.recordId}] ${source.title}${source.url ? ` (${source.url})` : ''}${source.reviewStatus === 'pending' ? ' [pending]' : ''}`);
    }
    if (annotation.sourceNote) lines.push(`  Chord source: ${annotation.sourceNote}`);
    if (annotation.caveat) lines.push(`  Caveat: ${annotation.caveat}`);
  }
  lines.push(
    '',
    'このコード進行の雰囲気を活かして、別のキーへの移調案や代理コードのアレンジ案を `コード名(拍数)` の1行記法で提案してください。'
  );
  return lines.join('\n');
}
