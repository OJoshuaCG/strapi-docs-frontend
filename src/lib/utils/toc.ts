import type { TocEntry } from '@/lib/domain/types';
import { slugify } from './slugify';

export function extractToc(body: string | unknown): TocEntry[] {
  if (typeof body !== 'string') return [];
  const entries: TocEntry[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^(#{2,6})\s+(.+)/);
    if (!match) continue;
    const level = match[1].length as TocEntry['level'];
    const text = match[2].trim();
    entries.push({ level, text, id: slugify(text) });
  }
  return entries;
}
