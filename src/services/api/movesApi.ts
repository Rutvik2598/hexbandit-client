import { api } from './client';
import type {
  MoveRequestResponse,
  RequestMoveRequest,
  EvaluateRequest,
  AnalyzeRequest,
  AnalysisResult,
} from '@/shared/types/api';
import {
  POLL_INTERVAL_MS,
  POLL_FAST_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  POLL_BUDGET_FACTOR,
  POLL_BUDGET_FLOOR_MS,
  POLL_TRANSIENT_MAX,
  POLL_TRANSIENT_BACKOFF_MS,
} from '@/shared/constants';

export async function requestMove(req: RequestMoveRequest): Promise<MoveRequestResponse> {
  return api.post<MoveRequestResponse>('/moves/request', req);
}

export async function requestEvaluate(req: EvaluateRequest): Promise<MoveRequestResponse> {
  return api.post<MoveRequestResponse>('/moves/evaluate', req);
}

export async function pollRequest(requestId: string): Promise<MoveRequestResponse> {
  return api.get<MoveRequestResponse>(`/moves/${requestId}`);
}

async function cancelRequest(requestId: string): Promise<void> {
  await api.delete(`/moves/${requestId}`);
}

export async function analyzeMoveStep(req: AnalyzeRequest): Promise<AnalysisResult> {
  return api.post<AnalysisResult>('/moves/analyze', req);
}

// Poll a move/evaluate request to completion
export async function pollUntilComplete(
  requestId: string,
  options?: {
    onProgress?: (progress: number, message: string) => void;
    onThinkBudget?: (budgetS: number, elapsedS: number) => void;
    abortSignal?: AbortSignal;
  },
): Promise<MoveRequestResponse> {
  let deadline = Date.now() + POLL_TIMEOUT_MS;
  let deadlineExtended = false;
  let transientErrors = 0;

  while (Date.now() < deadline) {
    if (options?.abortSignal?.aborted) {
      throw new Error('Aborted');
    }

    let pollResult: MoveRequestResponse;
    try {
      pollResult = await pollRequest(requestId);
      transientErrors = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isTransient = /50[234]/.test(msg);
      if (isTransient && transientErrors < POLL_TRANSIENT_MAX) {
        transientErrors++;
        await sleep(POLL_TRANSIENT_BACKOFF_MS);
        continue;
      }
      throw err;
    }

    const { status, thinking_progress, thinking_message, think_time_budget_s, think_time_elapsed_s } = pollResult;

    if (options?.onProgress) {
      options.onProgress(thinking_progress, thinking_message);
    }

    // Extend deadline based on budget
    if (!deadlineExtended && think_time_budget_s != null && think_time_budget_s > 0) {
      const budgetMs = Math.max(POLL_BUDGET_FLOOR_MS, think_time_budget_s * POLL_BUDGET_FACTOR * 1000);
      deadline = Math.max(deadline, Date.now() + budgetMs);
      deadlineExtended = true;
    }

    if (think_time_budget_s != null && think_time_elapsed_s != null) {
      options?.onThinkBudget?.(think_time_budget_s, think_time_elapsed_s);
    }

    if (status === 'complete' || status === 'error') {
      return pollResult;
    }

    const interval = (thinking_progress > 80) ? POLL_FAST_INTERVAL_MS : POLL_INTERVAL_MS;
    await sleep(interval);
  }

  // Timeout — cancel the request
  cancelRequest(requestId).catch(() => {});
  throw new Error('Move request timed out');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
