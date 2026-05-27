import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Coverage module constants
 */

// Queue name for coverage processing jobs
export const COVERAGE_QUEUE = 'coverage-processing';

// Maximum file size for coverage uploads (100MB)
export const MAX_COVERAGE_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

// Supported coverage formats
export enum CoverageFormat {
  LCOV = 'LCOV',
  COBERTURA = 'COBERTURA',
  NYC_JSON = 'NYC_JSON',
  JACOCO = 'JACOCO',
}

// Coverage report status
export enum CoverageStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Upload directory for coverage files
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'coverage');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer configuration for coverage file uploads
export const COVERAGE_UPLOAD_CONFIG = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = extname(file.originalname) || '.txt';
      cb(null, `coverage-${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_COVERAGE_FILE_SIZE,
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    // Accept common coverage file extensions
    const allowedExtensions = ['.lcov', '.xml', '.json', '.info', '.txt'];
    const ext = extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(
        new Error(`Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(', ')}`),
        false,
      );
    }
  },
};

// Allowed MIME types for coverage files
export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'application/xml',
  'text/xml',
  'application/json',
  'application/octet-stream',
];
