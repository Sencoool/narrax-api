import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MediaService } from './media.service.js';

describe('MediaService', () => {
  const originalUploadDir = process.env.UPLOAD_DIR;
  let uploadDir: string;
  const prisma = {
    novel: { findUnique: jest.fn() },
    character: { findUnique: jest.fn() },
    mediaAsset: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const tx = {
    mediaAsset: { deleteMany: jest.fn(), create: jest.fn() },
  };
  const service = new MediaService(prisma as never);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

  beforeEach(async () => {
    jest.clearAllMocks();
    uploadDir = await mkdtemp(join(tmpdir(), 'narrax-media-test-'));
    process.env.UPLOAD_DIR = uploadDir;
    prisma.novel.findUnique.mockResolvedValue({ authorId: 'owner' });
    prisma.character.findUnique.mockResolvedValue({ novelId: 'novel-1' });
    prisma.mediaAsset.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.mediaAsset.create.mockImplementation(
      ({ data }: { data: unknown }) => data,
    );
  });

  afterEach(async () => {
    if (
      resolve(uploadDir).startsWith(resolve(tmpdir()) + '\\') ||
      resolve(uploadDir).startsWith(resolve(tmpdir()) + '/')
    ) {
      await rm(uploadDir, { recursive: true, force: true });
    }
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  });

  it('rejects a file whose content is not a supported image', async () => {
    await expect(
      service.upload('owner', 'novel-1', 'character-1', {
        mimetype: 'image/svg+xml',
        buffer: Buffer.from('<svg/>'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an oversized image', async () => {
    await expect(
      service.upload('owner', 'novel-1', 'character-1', {
        mimetype: 'image/png',
        buffer: Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores a generated filename even if the supplied filename is a traversal attempt', async () => {
    const asset = await service.upload('owner', 'novel-1', 'character-1', {
      originalname: '../../escape.png',
      mimetype: 'image/png',
      buffer: png,
    } as Express.Multer.File);
    const files = await readdir(join(uploadDir, 'characters'));
    expect(files).toEqual([`${asset.id}.png`]);
    expect(asset.url).toBe(`/media/${asset.id}`);
  });

  it('denies an image owned by another user', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({
      ownerId: 'other',
      type: 'character',
    });
    await expect(service.read('owner', 'asset-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reads the stored image for its owner with the detected MIME type', async () => {
    const asset = await service.upload('owner', 'novel-1', 'character-1', {
      mimetype: 'image/png',
      buffer: png,
    } as Express.Multer.File);
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: asset.id,
      ownerId: 'owner',
      type: 'character',
    });
    await expect(service.read('owner', asset.id)).resolves.toEqual({
      body: png,
      mime: 'image/png',
    });
  });
});
