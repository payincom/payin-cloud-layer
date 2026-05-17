import {
  calculateWebhookRetryDelayMs,
  shouldRetryWebhookDelivery,
} from './webhooks.js';
import {
  markCloudWebhookDeliveryFailed,
  markCloudWebhookDeliverySucceeded,
  type CloudNotificationDeliveryRepository,
  type CloudWebhookDeliveryRecord,
} from './notification-delivery.js';

export interface WebhookDeliveryTransportResult {
  statusCode?: number;
  errorMessage?: string;
}

export interface WebhookDeliveryTransport {
  send(delivery: CloudWebhookDeliveryRecord): Promise<WebhookDeliveryTransportResult> | WebhookDeliveryTransportResult;
}

export interface WebhookDeliveryWorkerRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
}

export interface WebhookDeliveryWorkerOptions {
  repository: CloudNotificationDeliveryRepository;
  transport: WebhookDeliveryTransport;
  retry?: WebhookDeliveryWorkerRetryOptions;
  now?: () => Date;
}

export interface WebhookDeliveryWorkerResult {
  claimed: number;
  succeeded: number;
  failed: number;
  retryScheduled: number;
}

export class WebhookDeliveryWorker {
  private readonly now: () => Date;

  constructor(private readonly options: WebhookDeliveryWorkerOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async processDue(input: { limit: number }): Promise<WebhookDeliveryWorkerResult> {
    const claimed = await this.options.repository.claimDue({ now: this.now(), limit: input.limit });
    const result: WebhookDeliveryWorkerResult = { claimed: claimed.length, succeeded: 0, failed: 0, retryScheduled: 0 };

    for (const delivery of claimed) {
      const outcome = await this.sendOne(delivery);
      result[outcome] += 1;
    }

    return result;
  }

  private async sendOne(delivery: CloudWebhookDeliveryRecord): Promise<'succeeded' | 'failed' | 'retryScheduled'> {
    const now = this.now();
    try {
      const response = await this.options.transport.send(delivery);
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
        await this.options.repository.replace(markCloudWebhookDeliverySucceeded(delivery, { statusCode: response.statusCode, deliveredAt: now }));
        return 'succeeded';
      }

      return this.recordFailure(delivery, response.statusCode, response.errorMessage, now);
    } catch (error) {
      return this.recordFailure(delivery, undefined, error instanceof Error ? error.message : 'Webhook delivery failed', now);
    }
  }

  private async recordFailure(delivery: CloudWebhookDeliveryRecord, statusCode: number | undefined, errorMessage: string | undefined, failedAt: Date): Promise<'failed' | 'retryScheduled'> {
    const maxAttempts = this.options.retry?.maxAttempts ?? 5;
    const nextAttemptNumber = delivery.attemptCount + 1;
    const retryable = nextAttemptNumber < maxAttempts && shouldRetryWebhookDelivery({ statusCode, errorCode: statusCode === undefined ? 'TRANSPORT_ERROR' : undefined });
    const nextAttemptAt = retryable ? new Date(failedAt.getTime() + calculateWebhookRetryDelayMs({
      attempt: nextAttemptNumber,
      baseDelayMs: this.options.retry?.baseDelayMs,
      maxDelayMs: this.options.retry?.maxDelayMs,
      jitterRatio: this.options.retry?.jitterRatio,
      random: this.options.retry?.random,
    })) : undefined;

    await this.options.repository.replace(markCloudWebhookDeliveryFailed(delivery, { statusCode, errorMessage, failedAt, nextAttemptAt }));
    return retryable ? 'retryScheduled' : 'failed';
  }
}
