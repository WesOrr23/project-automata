/**
 * File format for Project Automata save files.
 *
 * v1 shape:
 * {
 *   "kind": "automata-file",
 *   "formatVersion": 1,
 *   "metadata": { name, description?, createdAt, modifiedAt },
 *   "automaton": <serialized Automaton (Sets as arrays)>
 * }
 *
 * Serialization converts Sets to sorted arrays for stable JSON
 * (deterministic output → diff-friendly, predictable ordering).
 *
 * Parsing is strict: malformed input returns Result.err with a typed
 * error variant rather than producing a half-loaded automaton. The
 * `kind` field discriminates against unrelated JSON files; the
 * `formatVersion` field discriminates against future versions (v1
 * parser refuses v2+ rather than silently dropping unknown fields).
 */

import { Automaton, Transition } from '../engine/types';
import { Result, ok, err, EngineError } from '../engine/result';

export const FORMAT_KIND = 'automata-file';
export const FORMAT_VERSION = 1;

export type AutomataFileMetadata = {
  name: string;
  description?: string;
  createdAt: string;   // ISO-8601
  modifiedAt: string;  // ISO-8601
};

export type AutomataFile = {
  kind: typeof FORMAT_KIND;
  formatVersion: number;
  metadata: AutomataFileMetadata;
  automaton: Automaton;
};

/**
 * Serialize an automaton + metadata to a JSON string suitable for
 * saving to disk. Converts Sets to sorted arrays so the output is
 * deterministic.
 */
export function serializeAutomaton(
  automaton: Automaton,
  metadata: AutomataFileMetadata
): string {
  const wrapped = {
    kind: FORMAT_KIND,
    formatVersion: FORMAT_VERSION,
    metadata,
    automaton: {
      type: automaton.type,
      states: Array.from(automaton.states).sort((a, b) => a - b),
      alphabet: Array.from(automaton.alphabet).sort(),
      transitions: automaton.transitions.map((t) => ({
        from: t.from,
        to: Array.from(t.to).sort((a, b) => a - b),
        symbol: t.symbol,
      })),
      startState: automaton.startState,
      acceptStates: Array.from(automaton.acceptStates).sort((a, b) => a - b),
      nextStateId: automaton.nextStateId,
    },
  };
  return JSON.stringify(wrapped, null, 2);
}

/**
 * Parse a JSON string into an AutomataFile. Strict — every required
 * field must be present and well-typed. The Automaton's Set-typed
 * fields are reconstructed from arrays.
 *
 * Failure cases (Result.err):
 *  - 'parse-invalid-json'   — JSON didn't parse
 *  - 'parse-wrong-kind'     — `kind` field missing or wrong
 *  - 'parse-bad-version'    — `formatVersion` is not 1
 *  - 'parse-malformed'      — required fields missing or wrong-typed
 */
export function parseAutomataFile(input: string): Result<AutomataFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    return err('parse-invalid-json');
  }
  if (raw === null || typeof raw !== 'object') return err('parse-malformed');

  const obj = raw as Record<string, unknown>;
  if (obj.kind !== FORMAT_KIND) return err('parse-wrong-kind');
  if (obj.formatVersion !== FORMAT_VERSION) return err('parse-bad-version');

  if (obj.metadata === null || typeof obj.metadata !== 'object') return err('parse-malformed');
  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.name !== 'string') return err('parse-malformed');
  if (meta.description !== undefined && typeof meta.description !== 'string') return err('parse-malformed');
  if (typeof meta.createdAt !== 'string') return err('parse-malformed');
  if (typeof meta.modifiedAt !== 'string') return err('parse-malformed');

  const automatonResult = parseAutomaton(obj.automaton);
  if (!automatonResult.ok) return automatonResult;

  const metadata: AutomataFileMetadata = {
    name: meta.name,
    createdAt: meta.createdAt,
    modifiedAt: meta.modifiedAt,
    ...(meta.description !== undefined ? { description: meta.description } : {}),
  };

  return ok({
    kind: FORMAT_KIND,
    formatVersion: FORMAT_VERSION,
    metadata,
    automaton: automatonResult.value,
  });
}

function parseAutomaton(raw: unknown): Result<Automaton> {
  if (raw === null || typeof raw !== 'object') return err('parse-malformed');
  const a = raw as Record<string, unknown>;

  if (a.type !== 'DFA' && a.type !== 'NFA') return err('parse-malformed');
  if (!Array.isArray(a.states)) return err('parse-malformed');
  if (!a.states.every((s) => typeof s === 'number' && Number.isInteger(s))) return err('parse-malformed');
  if (!Array.isArray(a.alphabet)) return err('parse-malformed');
  if (!a.alphabet.every((s) => typeof s === 'string')) return err('parse-malformed');
  if (!Array.isArray(a.transitions)) return err('parse-malformed');
  if (typeof a.startState !== 'number' || !Number.isInteger(a.startState)) return err('parse-malformed');
  if (!Array.isArray(a.acceptStates)) return err('parse-malformed');
  if (!a.acceptStates.every((s) => typeof s === 'number' && Number.isInteger(s))) return err('parse-malformed');
  if (typeof a.nextStateId !== 'number' || !Number.isInteger(a.nextStateId)) return err('parse-malformed');

  const transitions: Transition[] = [];
  for (const t of a.transitions) {
    if (t === null || typeof t !== 'object') return err('parse-malformed');
    const tr = t as Record<string, unknown>;
    if (typeof tr.from !== 'number' || !Number.isInteger(tr.from)) return err('parse-malformed');
    if (!Array.isArray(tr.to)) return err('parse-malformed');
    if (!tr.to.every((s) => typeof s === 'number' && Number.isInteger(s))) return err('parse-malformed');
    if (tr.symbol !== null && typeof tr.symbol !== 'string') return err('parse-malformed');
    transitions.push({
      from: tr.from,
      to: new Set(tr.to as number[]),
      symbol: tr.symbol as string | null,
    });
  }

  const automaton: Automaton = {
    type: a.type,
    states: new Set(a.states as number[]),
    alphabet: new Set(a.alphabet as string[]),
    transitions,
    startState: a.startState,
    acceptStates: new Set(a.acceptStates as number[]),
    nextStateId: a.nextStateId,
  };
  return ok(automaton);
}

/**
 * Returns a default metadata object with current timestamps and the
 * given (or default) name.
 */
export function defaultMetadata(name = 'Untitled automaton'): AutomataFileMetadata {
  const now = new Date().toISOString();
  return { name, createdAt: now, modifiedAt: now };
}

/**
 * Augments the EngineError union with file-format errors. We extend
 * the existing union via re-export so callsites only ever see one
 * error vocabulary. The new variants are added in
 * `src/engine/result.ts`'s errorMessage switch in the same iteration.
 */
export type FileFormatError = Extract<
  EngineError,
  'parse-invalid-json' | 'parse-wrong-kind' | 'parse-bad-version' | 'parse-malformed'
>;
