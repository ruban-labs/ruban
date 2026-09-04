import type {JsonValue} from '../types';

const objectToString = Object.prototype.toString;

function assertFiniteJsonValue(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Worker messages cannot contain non-finite numbers');
    return;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError(`Worker messages must be JSON values, not ${typeof value}`);
  }

  if (typeof value !== 'object') throw new TypeError('Worker messages must be JSON values');
  if (seen.has(value)) throw new TypeError('Worker messages cannot contain circular references');
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) assertFiniteJsonValue(item, seen);
  } else if (objectToString.call(value) === '[object Object]') {
    for (const key of Object.keys(value)) {
      assertFiniteJsonValue((value as Record<string, unknown>)[key], seen);
    }
  } else {
    throw new TypeError('Worker messages must contain plain JSON objects or arrays');
  }

  seen.delete(value);
}

export function serializeJson(value: JsonValue): string {
  assertFiniteJsonValue(value, new Set<object>());
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') throw new TypeError('Worker messages must serialize to JSON');
  return serialized;
}

export function parseJson(value: string): JsonValue {
  try {
    const parsed: unknown = JSON.parse(value);
    assertFiniteJsonValue(parsed, new Set<object>());
    return parsed as JsonValue;
  } catch (error) {
    throw new TypeError(`Worker protocol received invalid JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/** UTF-8 byte count without relying on a Node builtin or TextEncoder polyfill. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}
