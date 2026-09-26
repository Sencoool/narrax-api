import { LoggerService, LogLevel } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// ─── ANSI color codes ────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // levels
  log: '\x1b[32m', // green
  error: '\x1b[31m', // red
  warn: '\x1b[33m', // yellow
  debug: '\x1b[36m', // cyan
  verbose: '\x1b[35m', // magenta
  // meta
  gray: '\x1b[90m',
  white: '\x1b[97m',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function levelTag(level: string): string {
  const tags: Record<string, string> = {
    log: 'LOG',
    error: 'ERR',
    warn: 'WRN',
    debug: 'DBG',
    verbose: 'VRB',
  };
  return tags[level] ?? level.toUpperCase().slice(0, 3);
}

function colorForLevel(level: string): string {
  return (C as Record<string, string>)[level] ?? C.white;
}

// ─── File writer ─────────────────────────────────────────────────────────────

class FileWriter {
  private currentDate = '';
  private filePath = '';
  private stream: fs.WriteStream | null = null;

  private readonly logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    fs.mkdirSync(this.logsDir, { recursive: true });
  }

  write(line: string): void {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (today !== this.currentDate) {
      this.rotate(today);
    }
    this.stream?.write(line + '\n');
  }

  private rotate(date: string): void {
    this.stream?.end();
    this.currentDate = date;
    this.filePath = path.join(this.logsDir, `narrax-${date}.log`);
    this.stream = fs.createWriteStream(this.filePath, { flags: 'a' });
  }
}

// ─── NarraxLogger ─────────────────────────────────────────────────────────

/**
 * Custom NestJS LoggerService that writes to:
 * 1. Console — colorized, human-readable
 * 2. logs/narrax-YYYY-MM-DD.log — plain text, daily rotation
 */
export class NarraxLogger implements LoggerService {
  private static readonly writer = new FileWriter();

  private readonly enabledLevels: Set<LogLevel>;

  constructor(
    levels: LogLevel[] = ['log', 'warn', 'error', 'debug', 'verbose'],
  ) {
    this.enabledLevels = new Set(levels);
  }

  log(message: unknown, context?: string): void {
    this.output('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.output('error', message, context);
    if (trace) this.output('error', trace, context);
  }

  warn(message: unknown, context?: string): void {
    this.output('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.output('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.output('verbose', message, context);
  }

  // ─── Core output ────────────────────────────────────────────────────────

  private output(level: LogLevel, message: unknown, context?: string): void {
    if (!this.enabledLevels.has(level)) return;

    const ts = timestamp();
    const tag = levelTag(level);
    const ctx = context ? `[${context}]` : '';
    const msg = typeof message === 'string' ? message : JSON.stringify(message);

    // ── Console (colorized) ──────────────────────────────────────────────
    const color = colorForLevel(level);
    const consoleLine = [
      `${C.gray}${ts}${C.reset}`,
      `${color}${C.bold}${tag}${C.reset}`,
      ctx ? `${C.dim}${ctx}${C.reset}` : '',
      msg,
    ]
      .filter(Boolean)
      .join(' ');

    // Use process.stdout directly to avoid NestJS intercepting and double-printing
    process.stdout.write(consoleLine + '\n');

    // ── File (plain text, no ANSI) ───────────────────────────────────────
    const fileLine = [ts, tag, ctx, msg].filter(Boolean).join(' ');
    NarraxLogger.writer.write(fileLine);
  }
}
