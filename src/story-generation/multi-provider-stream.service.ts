import { Injectable, Logger } from '@nestjs/common';
import type { GenerateOptions } from '../application/ports/ai-provider.port.js';

/** Hard ceiling on a single upstream model request. */
const PROVIDER_TIMEOUT_MS = 120_000;

/** Combines the caller's abort signal with a provider timeout. */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export interface ActiveModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama' | 'custom';
  modelName: string;
  apiKey?: string | null;
  baseUrl?: string | null;
}

export interface StreamOptions extends GenerateOptions {
  signal?: AbortSignal;
}

// Minimal shapes of the streaming payloads we read. JSON.parse returns `any`, so
// each parse site asserts one of these instead of leaking `any` through the
// member accesses (and keeps the eslint typed-lint rules quiet).
interface OllamaStreamChunk {
  message?: { content?: string };
}

interface OpenAiStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

interface AnthropicStreamChunk {
  type?: string;
  delta?: { text?: string };
}

interface GeminiStreamChunk {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

@Injectable()
export class MultiProviderStreamService {
  private readonly logger = new Logger(MultiProviderStreamService.name);

  async *stream(
    systemPrompt: string,
    userMessage: string,
    config: ActiveModelConfig,
    options?: StreamOptions,
  ): AsyncIterable<string> {
    const { provider, modelName, apiKey, baseUrl } = config;
    const temp = options?.temperature ?? 0.7;
    const maxTokens = options?.maxOutputTokens ?? 2048;
    const signal = options?.signal;

    this.logger.log(
      `🌊 [MultiProviderStream] provider=${provider} | model=${modelName}`,
    );

    switch (provider) {
      case 'ollama':
        yield* this.streamOllama(
          systemPrompt,
          userMessage,
          modelName,
          baseUrl,
          temp,
          maxTokens,
          signal,
        );
        break;
      case 'openai':
      case 'custom':
        yield* this.streamOpenAI(
          systemPrompt,
          userMessage,
          modelName,
          apiKey,
          baseUrl,
          temp,
          maxTokens,
          signal,
        );
        break;
      case 'anthropic':
        yield* this.streamAnthropic(
          systemPrompt,
          userMessage,
          modelName,
          apiKey,
          temp,
          maxTokens,
          signal,
        );
        break;
      case 'google':
        yield* this.streamGoogle(
          systemPrompt,
          userMessage,
          modelName,
          apiKey,
          temp,
          maxTokens,
          signal,
        );
        break;
      case 'mistral':
        yield* this.streamOpenAI(
          systemPrompt,
          userMessage,
          modelName,
          apiKey,
          'https://api.mistral.ai/v1',
          temp,
          maxTokens,
          signal,
        );
        break;
      default: {
        // All known providers are handled above, so `provider` narrows to never
        // here; widen it explicitly for the error message.
        const unsupported: string = provider;
        throw new Error(`Unsupported model provider: ${unsupported}`);
      }
    }
  }

  // ─── Ollama ─────────────────────────────────────────────────────────────────
  private async *streamOllama(
    systemPrompt: string,
    userMessage: string,
    modelName: string,
    baseUrl: string | null | undefined,
    temperature: number,
    maxTokens: number,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const root = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const res = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userMessage },
        ],
        stream: true,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
      signal: withTimeout(signal),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama stream error ${res.status}: ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as OllamaStreamChunk;
          const chunk = json.message?.content;
          if (chunk) yield chunk;
        } catch {
          // ignore parse errors on incomplete chunks
        }
      }
    }

    // Flush any trailing fragment that did not end with \n
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer) as OllamaStreamChunk;
        const chunk = json.message?.content;
        if (chunk) yield chunk;
      } catch {
        // ignore trailing fragment that is not valid JSON
      }
    }
  }

  // ─── OpenAI / Custom ────────────────────────────────────────────────────────
  private async *streamOpenAI(
    systemPrompt: string,
    userMessage: string,
    modelName: string,
    apiKey: string | null | undefined,
    baseUrl: string | null | undefined,
    temperature: number,
    maxTokens: number,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const root = baseUrl
      ? baseUrl.replace(/\/+$/, '')
      : 'https://api.openai.com/v1';
    const url = root.endsWith('/chat/completions')
      ? root
      : `${root}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: withTimeout(signal),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') return;
        try {
          const json = JSON.parse(dataStr) as OpenAiStreamChunk;
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore chunk parse errors
        }
      }
    }

    // Flush any trailing data: line that did not end with \n
    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().replace(/^data:\s*/, '');
      if (dataStr !== '[DONE]') {
        try {
          const delta = (JSON.parse(dataStr) as OpenAiStreamChunk).choices?.[0]
            ?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore trailing fragment that is not valid JSON
        }
      }
    }
  }

  // ─── Anthropic ──────────────────────────────────────────────────────────────
  private async *streamAnthropic(
    systemPrompt: string,
    userMessage: string,
    modelName: string,
    apiKey: string | null | undefined,
    temperature: number,
    maxTokens: number,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: userMessage }],
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: withTimeout(signal),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.replace(/^data:\s*/, '');
        try {
          const json = JSON.parse(dataStr) as AnthropicStreamChunk;
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text;
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }

    // Flush any trailing data: line that did not end with \n
    if (buffer.trim().startsWith('data:')) {
      try {
        const json = JSON.parse(
          buffer.trim().replace(/^data:\s*/, ''),
        ) as AnthropicStreamChunk;
        if (json.type === 'content_block_delta' && json.delta?.text) {
          yield json.delta.text;
        }
      } catch {
        // ignore trailing fragment that is not valid JSON
      }
    }
  }

  // ─── Google Gemini ──────────────────────────────────────────────────────────
  private async *streamGoogle(
    systemPrompt: string,
    userMessage: string,
    modelName: string,
    apiKey: string | null | undefined,
    temperature: number,
    maxTokens: number,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemPrompt
          ? { system_instruction: { parts: [{ text: systemPrompt }] } }
          : {}),
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
      signal: withTimeout(signal),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Gemini API error ${res.status}: ${err}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.replace(/^data:\s*/, '');
        try {
          const json = JSON.parse(dataStr) as GeminiStreamChunk;
          const parts = json.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part.text) yield part.text;
            }
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }

    // Flush any trailing data: line that did not end with \n
    if (buffer.trim().startsWith('data:')) {
      try {
        const parts = (
          JSON.parse(
            buffer.trim().replace(/^data:\s*/, ''),
          ) as GeminiStreamChunk
        ).candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) if (part.text) yield part.text;
        }
      } catch {
        // ignore trailing fragment that is not valid JSON
      }
    }
  }
}
