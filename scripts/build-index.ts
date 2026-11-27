import fs from 'node:fs';
import path from 'node:path';
import {
  DatabaseIndexSchema,
  FeelingLexiconSchema,
  TrackSchema,
  type DatabaseIndex,
  type Track
} from '../src/schema/index.ts';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const TRACKS_DIR = path.join(DATA_DIR, 'tracks');
const FEELINGS_FILE = path.join(DATA_DIR, 'feelings.json');
const DATA_INDEX_OUT = path.join(DATA_DIR, 'index.json');
const PUBLIC_DATA_DIR = path.join(ROOT, 'public', 'data');
const PUBLIC_INDEX_OUT = path.join(PUBLIC_DATA_DIR, 'index.json');
const LLM_GUIDE_SRC = path.join(ROOT, 'LLM_GUIDE.md');
const LLM_GUIDE_PUBLIC = path.join(ROOT, 'public', 'LLM_GUIDE.md');

function buildIndex(): DatabaseIndex {
  const feelingsRaw = JSON.parse(fs.readFileSync(FEELINGS_FILE, 'utf-8'));
  const feelings = FeelingLexiconSchema.parse(feelingsRaw);

  const files = fs
    .readdirSync(TRACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tracks: Track[] = [];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(TRACKS_DIR, file.name), 'utf-8'));
    tracks.push(TrackSchema.parse(raw));
  }

  tracks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const sectionCount = tracks.reduce((sum, t) => sum + t.sections.length, 0);

  const index: DatabaseIndex = DatabaseIndexSchema.parse({
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    trackCount: tracks.length,
    sectionCount,
    feelings,
    tracks
  });

  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  const serialized = JSON.stringify(index, null, 2) + '\n';
  fs.writeFileSync(DATA_INDEX_OUT, serialized, 'utf-8');
  fs.writeFileSync(PUBLIC_INDEX_OUT, serialized, 'utf-8');

  if (fs.existsSync(LLM_GUIDE_SRC)) {
    fs.copyFileSync(LLM_GUIDE_SRC, LLM_GUIDE_PUBLIC);
  }

  return index;
}

const index = buildIndex();
console.log(
  `Built index: ${index.trackCount} track(s), ${index.sectionCount} section(s) -> data/index.json & public/data/index.json`
);
