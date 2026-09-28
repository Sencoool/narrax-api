export interface OllamaModel {
  name: string;
  sizeBytes: number;
}

export async function listOllamaModels(
  baseUrl: string,
): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      models?: { name?: string; size?: number }[];
    };
    return (body.models ?? [])
      .filter((model): model is { name: string; size?: number } => !!model.name)
      .map((model) => ({ name: model.name, sizeBytes: model.size ?? 0 }));
  } catch {
    return [];
  }
}
