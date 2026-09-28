import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';

const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
} as const;

type ImageMime = keyof typeof IMAGE_TYPES;

function detectedMime(buffer: Buffer): ImageMime | null {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return 'image/jpeg';
  if (
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  )
    return 'image/webp';
  return null;
}

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  private storageDirectory(): string {
    return resolve(process.env.UPLOAD_DIR || 'uploads', 'characters');
  }

  private pathFor(id: string, extension: string): string {
    const root = this.storageDirectory();
    const path = join(root, `${id}${extension}`);
    const inside = relative(root, path);
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) {
      throw new BadRequestException('Invalid media path');
    }
    return path;
  }

  private async checkOwnership(
    userId: string,
    novelId: string,
    characterId: string,
  ): Promise<void> {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { authorId: true },
    });
    if (!novel || novel.authorId !== userId)
      throw new ForbiddenException('You do not own this novel');
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { novelId: true },
    });
    if (!character || character.novelId !== novelId)
      throw new NotFoundException('Character not found in this novel');
  }

  async upload(
    userId: string,
    novelId: string,
    characterId: string,
    file?: Express.Multer.File,
  ) {
    await this.checkOwnership(userId, novelId, characterId);
    const maxMb = Number(process.env.MAX_UPLOAD_MB) || 5;
    const limit = Math.min(Math.max(maxMb, 1), 20) * 1024 * 1024;
    if (
      !file?.buffer ||
      file.buffer.length === 0 ||
      file.buffer.length > limit
    ) {
      throw new BadRequestException('Image is missing or too large');
    }
    const mime = detectedMime(file.buffer);
    if (!mime || file.mimetype !== mime)
      throw new BadRequestException('Upload a PNG, JPEG, or WebP image');

    const id = randomUUID();
    const path = this.pathFor(id, IMAGE_TYPES[mime]);
    await mkdir(this.storageDirectory(), { recursive: true });
    await writeFile(path, file.buffer, { flag: 'wx' });
    try {
      const old = await this.prisma.mediaAsset.findMany({
        where: { characterId, type: 'character' },
        select: { id: true },
      });
      const asset = await this.prisma.$transaction(async (tx) => {
        await tx.mediaAsset.deleteMany({
          where: { characterId, type: 'character' },
        });
        return tx.mediaAsset.create({
          data: {
            id,
            ownerId: userId,
            novelId,
            characterId,
            type: 'character',
            url: `/media/${id}`,
          },
        });
      });
      for (const previous of old) {
        for (const extension of Object.values(IMAGE_TYPES)) {
          await unlink(this.pathFor(previous.id, extension)).catch(
            () => undefined,
          );
        }
      }
      return asset;
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  async read(
    userId: string,
    id: string,
  ): Promise<{ body: Buffer; mime: ImageMime }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.type !== 'character')
      throw new NotFoundException('Image not found');
    if (asset.ownerId !== userId)
      throw new ForbiddenException('Image belongs to another user');

    for (const [mime, extension] of Object.entries(IMAGE_TYPES) as [
      ImageMime,
      string,
    ][]) {
      const path = this.pathFor(id, extension);
      try {
        const info = await stat(path);
        if (info.isFile()) return { body: await readFile(path), mime };
      } catch {
        // Try the next supported extension.
      }
    }
    throw new NotFoundException('Image file not found');
  }
}
