/** Idempotent development seed for a login-ready writer, episode, and Ollama config. */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from 'argon2';

const email = 'local@narrax.test';
const title = 'The Harbour Lamp';
const modelLabel = 'Local Ollama';
const episodeText =
  '<p>The lamp was still warm when she reached for it. Outside, the harbour was quiet enough to hear the tide turn.</p>';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const password = process.env.SEED_LOCAL_PASSWORD;
  if (!databaseUrl) throw new Error('Set DATABASE_URL before seeding');
  if (!password || password.length < 8)
    throw new Error('Set SEED_LOCAL_PASSWORD to at least 8 characters');

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    let user = await prisma.user.findUnique({ where: { email } });
    const createdUser = !user;
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: 'Local Writer', password: await hash(password) },
      });
    } else if (!user.password) {
      throw new Error(
        `${email} already exists without a password; use a different account or add a password through auth`,
      );
    }

    let novel = await prisma.novel.findFirst({
      where: { authorId: user.id, title },
    });
    novel ??= await prisma.novel.create({
      data: {
        title,
        summary: 'A keeper and a stranger return to the same pier.',
        status: 'draft',
        authorId: user.id,
      },
    });

    let episode = await prisma.episode.findFirst({
      where: { novelId: novel.id, order: 1 },
    });
    episode ??= await prisma.episode.create({
      data: {
        novelId: novel.id,
        title: 'Episode 1',
        content: episodeText,
        order: 1,
        isPublished: false,
      },
    });

    const model = await prisma.userModelConfig.findFirst({
      where: { userId: user.id, label: modelLabel },
    });
    if (!model) {
      const hasDefault = await prisma.userModelConfig.findFirst({
        where: { userId: user.id, isDefault: true },
      });
      await prisma.userModelConfig.create({
        data: {
          userId: user.id,
          label: modelLabel,
          provider: 'ollama',
          modelName: process.env.OLLAMA_MODEL ?? 'qwen2.5',
          baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
          isDefault: !hasDefault,
        },
      });
    }
    console.log(`seed: ${email} novel ${novel.id} episode ${episode.id} (${createdUser ? 'new account' : 'existing account'})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
