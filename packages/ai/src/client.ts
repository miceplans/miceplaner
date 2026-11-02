import { anthropicCompatible } from './anthropic';
import { openAiCompatible, type LlmClient, type OpenAiCompatOptions } from './llm';

/** 엔드포인트 경로가 `/anthropic`으로 끝나면 Anthropic Messages, 아니면 OpenAI Chat Completions 방식으로 호출한다. */
export function createLlmClient(opts: OpenAiCompatOptions): LlmClient {
  return /\/anthropic\/?$/.test(opts.baseUrl) ? anthropicCompatible(opts) : openAiCompatible(opts);
}
