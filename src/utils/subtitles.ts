export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(raw: string): number {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = Number(parts[2]);
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    return m * 60 + s;
  }
  return NaN;
}

export function parseWebVtt(vttContent: string): SubtitleCue[] {
  const normalized = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    const timingLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingLineIdx === -1) continue;

    const timingLine = lines[timingLineIdx];
    const [rawStart, rawEndWithSettings] = timingLine.split('-->');
    if (!rawStart || !rawEndWithSettings) continue;

    const rawEnd = rawEndWithSettings.trim().split(/\s+/)[0];
    const start = parseTimestamp(rawStart);
    const end = parseTimestamp(rawEnd);

    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const textLines = lines
      .slice(timingLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (textLines) {
      cues.push({ start, end, text: textLines });
    }
  }

  return cues;
}

export function getActiveSubtitleCues(
  cues: SubtitleCue[],
  currentTime: number,
  offsetSeconds = 0
): string[] {
  const t = currentTime - offsetSeconds;
  const active: string[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (t >= cue.start && t <= cue.end) {
      active.push(cue.text);
    }
  }
  return active;
}
