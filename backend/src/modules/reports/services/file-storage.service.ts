import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { REPORTS_EXPORT_DIR, MAX_EXPORT_SIZE, REPORT_RETENTION_DAYS } from '../constants';

/**
 * Service for local file storage of report exports
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    // Use configured path or default to project root exports directory
    this.baseDir =
      this.configService.get<string>('REPORTS_STORAGE_PATH') ||
      path.join(process.cwd(), REPORTS_EXPORT_DIR);

    this.ensureDirectoryExists(this.baseDir);
  }

  /**
   * Save file to local storage
   *
   * @param buffer - File content as buffer
   * @param filename - Name of the file
   * @param organizationId - Organization ID for directory structure
   * @returns Relative file path
   */
  async saveFile(buffer: Buffer, filename: string, organizationId: string): Promise<string> {
    // Validate file size
    if (buffer.length > MAX_EXPORT_SIZE) {
      throw new InternalServerErrorException(
        `File size exceeds maximum allowed size of ${MAX_EXPORT_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Create organization-specific directory
    const orgDir = path.join(this.baseDir, organizationId);
    this.ensureDirectoryExists(orgDir);

    // Create date-based subdirectory for organization
    const dateDir = this.getDateDirectory();
    const fullDir = path.join(orgDir, dateDir);
    this.ensureDirectoryExists(fullDir);

    // Full file path
    const filePath = path.join(fullDir, filename);
    const relativePath = path.join(organizationId, dateDir, filename);

    try {
      await fs.promises.writeFile(filePath, buffer);
      this.logger.log(`File saved: ${relativePath}`);
      return relativePath;
    } catch (error) {
      this.logger.error(`Failed to save file: ${relativePath}`, error);
      throw new InternalServerErrorException('Failed to save report file');
    }
  }

  /**
   * Get full file path for a relative path
   *
   * @param relativePath - Relative path from storage root
   * @returns Full file path
   */
  getFilePath(relativePath: string): string {
    return path.join(this.baseDir, relativePath);
  }

  /**
   * Check if file exists
   *
   * @param relativePath - Relative path from storage root
   * @returns True if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = this.getFilePath(relativePath);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content
   *
   * @param relativePath - Relative path from storage root
   * @returns File content as buffer
   */
  async readFile(relativePath: string): Promise<Buffer> {
    const fullPath = this.getFilePath(relativePath);
    try {
      return await fs.promises.readFile(fullPath);
    } catch (error) {
      this.logger.error(`Failed to read file: ${relativePath}`, error);
      throw new InternalServerErrorException('Failed to read report file');
    }
  }

  /**
   * Delete file from storage
   *
   * @param relativePath - Relative path from storage root
   */
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.getFilePath(relativePath);
    try {
      await fs.promises.unlink(fullPath);
      this.logger.log(`File deleted: ${relativePath}`);
    } catch (error) {
      // Log but don't throw - file might already be deleted
      this.logger.warn(`Failed to delete file: ${relativePath}`, error);
    }
  }

  /**
   * Get file stats
   *
   * @param relativePath - Relative path from storage root
   * @returns File stats
   */
  async getFileStats(relativePath: string): Promise<fs.Stats | null> {
    const fullPath = this.getFilePath(relativePath);
    try {
      return await fs.promises.stat(fullPath);
    } catch {
      return null;
    }
  }

  /**
   * Clean up old report files
   * Removes files older than retention period
   */
  async cleanupOldFiles(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - REPORT_RETENTION_DAYS);

    let deletedCount = 0;

    try {
      const orgDirs = await fs.promises.readdir(this.baseDir);

      for (const orgDir of orgDirs) {
        const orgPath = path.join(this.baseDir, orgDir);
        const stat = await fs.promises.stat(orgPath);

        if (!stat.isDirectory()) continue;

        const dateDirs = await fs.promises.readdir(orgPath);

        for (const dateDir of dateDirs) {
          const datePath = path.join(orgPath, dateDir);
          const dateStat = await fs.promises.stat(datePath);

          if (!dateStat.isDirectory()) continue;

          // Check if directory is older than retention period
          if (dateStat.mtime < cutoffDate) {
            const files = await fs.promises.readdir(datePath);
            for (const file of files) {
              await fs.promises.unlink(path.join(datePath, file));
              deletedCount++;
            }
            // Remove empty directory
            await fs.promises.rmdir(datePath);
          }
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old report files`);
    } catch (error) {
      this.logger.error('Failed to cleanup old files', error);
    }

    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
  }> {
    let totalFiles = 0;
    let totalSize = 0;
    let oldestFile: Date | null = null;

    try {
      const orgDirs = await fs.promises.readdir(this.baseDir);

      for (const orgDir of orgDirs) {
        const orgPath = path.join(this.baseDir, orgDir);
        const stat = await fs.promises.stat(orgPath);

        if (!stat.isDirectory()) continue;

        const dateDirs = await fs.promises.readdir(orgPath);

        for (const dateDir of dateDirs) {
          const datePath = path.join(orgPath, dateDir);
          const dateStat = await fs.promises.stat(datePath);

          if (!dateStat.isDirectory()) continue;

          const files = await fs.promises.readdir(datePath);

          for (const file of files) {
            const filePath = path.join(datePath, file);
            const fileStat = await fs.promises.stat(filePath);

            totalFiles++;
            totalSize += fileStat.size;

            if (!oldestFile || fileStat.mtime < oldestFile) {
              oldestFile = fileStat.mtime;
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to get storage stats', error);
    }

    return { totalFiles, totalSize, oldestFile };
  }

  /**
   * Ensure directory exists, create if not
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.log(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Get date-based directory name (YYYY-MM)
   */
  private getDateDirectory(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
