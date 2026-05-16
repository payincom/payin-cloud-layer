import { describe, expect, it } from 'vitest';
import {
  calculateWebhookRetryDelayMs,
  createWebhookSignaturePayload,
  shouldRetryWebhookDelivery,
} from '../../src/index.js';

describe('Cloud webhook retry/signature contract', () => {
  it('creates deterministic signature payloads from timestamp and body', () => {
    expect(createWebhookSignaturePayload({
      timestamp: 1778930000,
      body: '{"id":"evt-1"}',
    })).toBe('1778930000.{"id":"evt-1"}');
  });

  it('retries transient HTTP status codes and network failures only', () => {
    expect(shouldRetryWebhookDelivery({ statusCode: 500 })).toBe(true);
    expect(shouldRetryWebhookDelivery({ statusCode: 429 })).toBe(true);
    expect(shouldRetryWebhookDelivery({ errorCode: 'ECONNRESET' })).toBe(true);
    expect(shouldRetryWebhookDelivery({ statusCode: 400 })).toBe(false);
    expect(shouldRetryWebhookDelivery({ statusCode: 404 })).toBe(false);
    expect(shouldRetryWebhookDelivery({ statusCode: 200 })).toBe(false);
  });

  it('uses bounded exponential backoff with jitter disabled by default for deterministic tests', () => {
    expect(calculateWebhookRetryDelayMs({ attempt: 1, baseDelayMs: 1000, maxDelayMs: 30000 })).toBe(1000);
    expect(calculateWebhookRetryDelayMs({ attempt: 2, baseDelayMs: 1000, maxDelayMs: 30000 })).toBe(2000);
    expect(calculateWebhookRetryDelayMs({ attempt: 6, baseDelayMs: 1000, maxDelayMs: 30000 })).toBe(30000);
  });

  it('can apply deterministic jitter when a jitter ratio is provided', () => {
    expect(calculateWebhookRetryDelayMs({ attempt: 2, baseDelayMs: 1000, maxDelayMs: 30000, jitterRatio: 0.1, random: () => 1 })).toBe(2200);
    expect(calculateWebhookRetryDelayMs({ attempt: 2, baseDelayMs: 1000, maxDelayMs: 30000, jitterRatio: 0.1, random: () => 0 })).toBe(1800);
  });
});
