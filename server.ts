import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  // Block private IPv4 ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  return false;
}

function buildProxyUrl(targetUrl: string, referer?: string): string {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  return `/api/proxy?${params.toString()}`;
}

function rewriteM3u8Playlist(content: string, baseUrl: string, referer?: string): string {
  const base = new URL(baseUrl);
  const lines = content.split(/\r?\n/);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." attributes inside #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP, etc.
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, rawUri: string) => {
          try {
            const abs = new URL(rawUri, base).toString();
            return `URI="${buildProxyUrl(abs, referer)}"`;
          } catch {
            return `URI="${rawUri}"`;
          }
        });
      }

      // Rewrite playlist/segment URL lines
      try {
        const abs = new URL(trimmed, base).toString();
        return buildProxyUrl(abs, referer);
      } catch {
        return line;
      }
    })
    .join('\n');
}

function convertSrtToVtt(srt: string): string {
  const normalized = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const converted = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );
  return `WEBVTT\n\n${converted}\n`;
}

function convertAssToVtt(ass: string): string {
  const lines = ass.split(/\r?\n/);
  const cues: string[] = [];
  let formatFields: string[] = [];

  for (const line of lines) {
    if (line.startsWith('Format:')) {
      formatFields = line
        .slice(7)
        .split(',')
        .map((s) => s.trim().toLowerCase());
    } else if (line.startsWith('Dialogue:')) {
      const raw = line.slice(9).trim();
      const parts = raw.split(',');
      const startIdx = formatFields.indexOf('start');
      const endIdx = formatFields.indexOf('end');
      const textIdx = formatFields.indexOf('text');
      const sIdx = startIdx >= 0 ? startIdx : 1;
      const eIdx = endIdx >= 0 ? endIdx : 2;
      const tIdx = textIdx >= 0 ? textIdx : 9;

      if (parts.length > tIdx) {
        const start = formatAssTime(parts[sIdx].trim());
        const end = formatAssTime(parts[eIdx].trim());
        const rawText = parts.slice(tIdx).join(',');
        const cleanText = rawText
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\N/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\\h/g, ' ')
          .trim();
        if (start && end && cleanText) {
          cues.push(`${start} --> ${end}\n${cleanText}`);
        }
      }
    }
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

function formatAssTime(t: string): string {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/.exec(t);
  if (!match) return '';
  const h = match[1].padStart(2, '0');
  const m = match[2];
  const s = match[3];
  const ms = `${match[4]}0`;
  return `${h}:${m}:${s}.${ms}`;
}

async function startServer() {
  const app = express();

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/proxy', async (req: Request, res: Response) => {
    const target = typeof req.query.url === 'string' ? req.query.url : '';
    const referer = typeof req.query.referer === 'string' ? req.query.referer : '';
    const subFormat = typeof req.query.subFormat === 'string' ? req.query.subFormat : '';

    if (!target) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(target);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        res.status(400).json({ error: 'Unsupported protocol' });
        return;
      }
      if (isBlockedHostname(parsedUrl.hostname)) {
        res.status(403).json({ error: 'Blocked host' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      Accept: '*/*',
    };

    if (referer) {
      headers['Referer'] = referer;
      try {
        headers['Origin'] = new URL(referer).origin;
      } catch {
        // Ignore invalid referer origin
      }
    }

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    req.on('close', () => controller.abort());

    try {
      const upstream = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = upstream.headers.get('content-type') || '';
      const lowerUrl = parsedUrl.pathname.toLowerCase();

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send(`Upstream returned ${upstream.status}`);
        return;
      }

      // Handle subtitles conversion to WebVTT when requested
      if (subFormat === 'srt' || subFormat === 'ass' || subFormat === 'vtt') {
        const text = await upstream.text();
        let vttText = text;
        if (subFormat === 'srt' || (!text.trim().startsWith('WEBVTT') && lowerUrl.endsWith('.srt'))) {
          vttText = convertSrtToVtt(text);
        } else if (subFormat === 'ass' || lowerUrl.endsWith('.ass') || text.includes('[Script Info]')) {
          vttText = convertAssToVtt(text);
        }
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(vttText);
        return;
      }

      const isPlaylist =
        lowerUrl.endsWith('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('x-mpegurl');

      if (isPlaylist) {
        const text = await upstream.text();
        if (text.trimStart().startsWith('#EXTM3U')) {
          const rewritten = rewriteM3u8Playlist(text, upstream.url || parsedUrl.toString(), referer || undefined);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.status(200).send(rewritten);
          return;
        }
        // Not a standard #EXTM3U playlist (e.g. encrypted playlist payload)
        res.setHeader('Content-Type', contentType || 'text/plain; charset=utf-8');
        res.status(200).send(text);
        return;
      }

      // Binary / segment / MP4 stream passthrough with range support
      if (contentType) res.setHeader('Content-Type', contentType);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      res.status(upstream.status);

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          if (!res.write(Buffer.from(value))) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      };
      await pump();
    } catch (err) {
      clearTimeout(timeout);
      if (!res.headersSent) {
        const message = err instanceof Error ? err.message : 'Proxy request failed';
        res.status(502).json({ error: message });
      }
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ANIVEXA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
