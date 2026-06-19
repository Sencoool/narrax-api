import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import * as path from 'path';

/**
 * Extracts plain text from an uploaded Multer file buffer.
 *
 * Currently supports: .txt / text plain MIME type.
 * Extend this service to add PDF or DOCX support without changing callers.
 */
@Injectable()
export class FileParserService {
  /**
   * Extract text content from the uploaded file.
   * @throws UnsupportedMediaTypeException for unsupported file types
   */
  extractText(file: Express.Multer.File): string {
    const ext = path.extname(file.originalname).toLowerCase();
    const isTxt =
      ext === '.txt' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream'; // some clients send this for .txt

    if (!isTxt) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type "${ext}". Only .txt files are supported at this time.`,
      );
    }

    const text = file.buffer.toString('utf-8');

    if (!text.trim()) {
      throw new UnsupportedMediaTypeException('Uploaded file is empty.');
    }

    return text;
  }
}
