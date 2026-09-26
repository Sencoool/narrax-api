import { upsertNovelContextSchema } from './upsert-novel-context.dto';

/**
 * `null` means "clear this field", an omitted field means "leave it alone". The
 * schema has to keep those apart: if it silently filled omitted fields with null,
 * every partial save would wipe the rest of the story bible.
 */
describe('UpsertNovelContextDto nullability', () => {
  it('accepts null for every field', () => {
    const parsed = upsertNovelContextSchema.parse({
      characters: null,
      worldBuilding: null,
      plotOutline: null,
      writingStyle: null,
    });

    expect(parsed).toEqual({
      characters: null,
      worldBuilding: null,
      plotOutline: null,
      writingStyle: null,
    });
  });

  it('keeps omitted fields absent instead of filling them with null', () => {
    const parsed = upsertNovelContextSchema.parse({ worldBuilding: 'a place' });

    expect('plotOutline' in parsed).toBe(false);
    expect('characters' in parsed).toBe(false);
    expect('writingStyle' in parsed).toBe(false);
  });

  it('still rejects a wrong type', () => {
    expect(() =>
      upsertNovelContextSchema.parse({ worldBuilding: 42 }),
    ).toThrow();
  });

  it('still enforces the length limits', () => {
    expect(() =>
      upsertNovelContextSchema.parse({ plotOutline: 'x'.repeat(5001) }),
    ).toThrow();
  });

  it('treats an empty character list as a clear, not as an omission', () => {
    const parsed = upsertNovelContextSchema.parse({ characters: [] });

    expect(parsed).toEqual({ characters: [] });
  });

  it('still accepts a normal full payload', () => {
    const parsed = upsertNovelContextSchema.parse({
      characters: [{ name: 'Ari', role: 'protagonist' }],
      worldBuilding: 'A harbour town',
      plotOutline: 'She waits for the stranger',
      writingStyle: 'Quiet, present tense',
    });

    expect(parsed.characters).toHaveLength(1);
    expect(parsed.worldBuilding).toBe('A harbour town');
  });
});
