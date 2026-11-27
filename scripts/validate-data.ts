import fs from 'node:fs';
import path from 'node:path';
import {
  CompositionRuleLibrarySchema,
  formatZodIssues,
  HarmonyTechniqueLibrarySchema,
  ProgressionLibrarySchema,
  StyleMoodLibrarySchema,
  validateFeelingLexiconData,
  validateTrackData,
  type Track
} from '../src/schema/index.ts';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const TRACKS_DIR = path.join(DATA_DIR, 'tracks');
const THEORY_DIR = path.join(DATA_DIR, 'theory');
const FEELINGS_FILE = path.join(DATA_DIR, 'feelings.json');

interface FileError {
  file: string;
  messages: string[];
}

function readJsonFile(filePath: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export function validateRepositoryData(): {
  ok: boolean;
  trackCount: number;
  sectionCount: number;
  theoryCount: number;
  errors: FileError[];
} {
  const errors: FileError[] = [];

  if (!fs.existsSync(FEELINGS_FILE)) {
    errors.push({ file: 'data/feelings.json', messages: ['File does not exist'] });
  } else {
    const parsed = readJsonFile(FEELINGS_FILE);
    if (!parsed.ok) {
      errors.push({ file: 'data/feelings.json', messages: [`Invalid JSON: ${parsed.error}`] });
    } else {
      const result = validateFeelingLexiconData(parsed.data);
      if (!result.success) {
        errors.push({
          file: 'data/feelings.json',
          messages: result.issues.map((i) => `${i.path}: ${i.message}`)
        });
      }
    }
  }

  const seenTrackIds = new Map<string, string>();
  const validTracks: Track[] = [];

  if (!fs.existsSync(TRACKS_DIR)) {
    errors.push({ file: 'data/tracks/', messages: ['Directory does not exist'] });
  } else {
    const entries = fs
      .readdirSync(TRACKS_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const relPath = `data/tracks/${entry.name}`;
      const fullPath = path.join(TRACKS_DIR, entry.name);
      const parsed = readJsonFile(fullPath);

      if (!parsed.ok) {
        errors.push({ file: relPath, messages: [`Invalid JSON: ${parsed.error}`] });
        continue;
      }

      const result = validateTrackData(parsed.data);
      if (!result.success || !result.data) {
        errors.push({
          file: relPath,
          messages: result.issues.map((i) => `${i.path}: ${i.message}`)
        });
        continue;
      }

      const track = result.data;
      const expectedFileName = `${track.id}.json`;
      if (entry.name !== expectedFileName) {
        errors.push({
          file: relPath,
          messages: [`Filename "${entry.name}" must match track.id "${expectedFileName}"`]
        });
        continue;
      }

      const existing = seenTrackIds.get(track.id);
      if (existing) {
        errors.push({
          file: relPath,
          messages: [`Duplicate track id "${track.id}" (already defined in ${existing})`]
        });
        continue;
      }

      seenTrackIds.set(track.id, relPath);
      validTracks.push(track);
    }
  }

  const theoryFiles = [
    { name: 'progressions.json', schema: ProgressionLibrarySchema },
    { name: 'harmony-techniques.json', schema: HarmonyTechniqueLibrarySchema },
    { name: 'style-moods.json', schema: StyleMoodLibrarySchema },
    { name: 'composition-rules.json', schema: CompositionRuleLibrarySchema }
  ] as const;

  let theoryCount = 0;
  for (const tf of theoryFiles) {
    const relPath = `data/theory/${tf.name}`;
    const fullPath = path.join(THEORY_DIR, tf.name);
    if (!fs.existsSync(fullPath)) {
      errors.push({ file: relPath, messages: ['File does not exist'] });
      continue;
    }
    const parsed = readJsonFile(fullPath);
    if (!parsed.ok) {
      errors.push({ file: relPath, messages: [`Invalid JSON: ${parsed.error}`] });
      continue;
    }
    const result = tf.schema.safeParse(parsed.data);
    if (!result.success) {
      errors.push({
        file: relPath,
        messages: formatZodIssues(result.error).map((i) => `${i.path}: ${i.message}`)
      });
    } else {
      theoryCount += result.data.length;
    }
  }

  const sectionCount = validTracks.reduce((sum, t) => sum + t.sections.length, 0);
  return {
    ok: errors.length === 0,
    trackCount: validTracks.length,
    sectionCount,
    theoryCount,
    errors
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  const result = validateRepositoryData();
  if (!result.ok) {
    console.error('Data validation FAILED:');
    for (const err of result.errors) {
      console.error(`  ${err.file}`);
      for (const msg of err.messages) {
        console.error(`    - ${msg}`);
      }
    }
    process.exit(1);
  }
  console.log(
    `Data validation OK: ${result.trackCount} track(s), ${result.sectionCount} section(s), ${result.theoryCount} theory record(s).`
  );
}
