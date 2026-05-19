import { Injectable, Logger } from '@nestjs/common';
import { DebtMarker } from '@prisma/client';
import { ScannedDebtMarker } from '../interfaces';

/**
 * Language-specific comment patterns
 */
interface CommentPattern {
  singleLine: RegExp[];
  multiLineStart: RegExp;
  multiLineEnd: RegExp;
}

/**
 * Supported language comment patterns
 */
const LANGUAGE_PATTERNS: Record<string, CommentPattern> = {
  // JavaScript, TypeScript, Java, Go - C-style comments
  cStyle: {
    singleLine: [/^\s*\/\/(.*)$/],
    multiLineStart: /\/\*\*?/,
    multiLineEnd: /\*\//,
  },
  // Python - hash comments and docstrings
  python: {
    singleLine: [/^\s*#(.*)$/],
    multiLineStart: /"""|'''/,
    multiLineEnd: /"""|'''/,
  },
};

/**
 * File extension to language pattern mapping
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.js': 'cStyle',
  '.jsx': 'cStyle',
  '.ts': 'cStyle',
  '.tsx': 'cStyle',
  '.java': 'cStyle',
  '.go': 'cStyle',
  '.py': 'python',
};

/**
 * Debt marker regex patterns
 *
 * These patterns match debt markers in various formats:
 * - TODO: description
 * - TODO(author): description
 * - FIXME: description
 * - HACK: description
 * - XXX: description
 */
const DEBT_MARKER_PATTERNS: Record<DebtMarker, RegExp> = {
  TODO: /\bTODO\b(?:\s*\([^)]*\))?\s*:?\s*(.+)?/i,
  FIXME: /\bFIXME\b(?:\s*\([^)]*\))?\s*:?\s*(.+)?/i,
  HACK: /\bHACK\b(?:\s*\([^)]*\))?\s*:?\s*(.+)?/i,
  XXX: /\bXXX\b(?:\s*\([^)]*\))?\s*:?\s*(.+)?/i,
};

/**
 * Combined pattern to detect any debt marker
 */
const ANY_DEBT_MARKER_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/i;

/**
 * Service for scanning code files for technical debt markers
 */
@Injectable()
export class DebtScannerService {
  private readonly logger = new Logger(DebtScannerService.name);

  /**
   * Get the language pattern for a file based on its extension
   *
   * @param filePath - Path to the file
   * @returns Language pattern or null if unsupported
   */
  getLanguagePattern(filePath: string): CommentPattern | null {
    const ext = this.getFileExtension(filePath);
    const languageKey = EXTENSION_TO_LANGUAGE[ext];

    if (!languageKey) {
      return null;
    }

    return LANGUAGE_PATTERNS[languageKey];
  }

  /**
   * Check if a file type is supported for debt scanning
   *
   * @param filePath - Path to the file
   * @returns True if the file type is supported
   */
  isFileSupported(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return ext in EXTENSION_TO_LANGUAGE;
  }

  /**
   * Get file extension from path
   *
   * @param filePath - Path to the file
   * @returns File extension including the dot (e.g., '.ts')
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) {
      return '';
    }
    return filePath.substring(lastDot).toLowerCase();
  }

  /**
   * Scan file content for debt markers
   *
   * @param filePath - Path to the file
   * @param content - File content to scan
   * @returns Array of scanned debt markers with line numbers
   */
  scanFileContent(filePath: string, content: string): ScannedDebtMarker[] {
    const markers: ScannedDebtMarker[] = [];
    const lines = content.split('\n');

    const languagePattern = this.getLanguagePattern(filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1; // 1-indexed line numbers

      // Check if line contains any debt marker
      if (!ANY_DEBT_MARKER_PATTERN.test(line)) {
        continue;
      }

      // If we have language patterns, verify the marker is in a comment
      if (languagePattern) {
        const isInComment = this.isLineInComment(line, languagePattern);
        if (!isInComment) {
          continue;
        }
      }

      // Extract the debt marker
      const marker = this.extractDebtMarker(line, filePath, lineNumber);
      if (marker) {
        markers.push(marker);
      }
    }

    return markers;
  }

  /**
   * Check if a line is a comment line
   *
   * @param line - Line content
   * @param pattern - Language comment pattern
   * @returns True if the line is a comment
   */
  private isLineInComment(line: string, pattern: CommentPattern): boolean {
    // Check single-line comment patterns
    for (const singleLinePattern of pattern.singleLine) {
      if (singleLinePattern.test(line)) {
        return true;
      }
    }

    // Check if line contains inline comment (e.g., code // TODO: fix this)
    if (line.includes('//') || line.includes('#')) {
      return true;
    }

    // Check multi-line comment markers
    if (pattern.multiLineStart.test(line) || pattern.multiLineEnd.test(line)) {
      return true;
    }

    // Check for lines that look like they're inside a multi-line comment
    // (starts with * which is common in JSDoc/JavaDoc style comments)
    if (/^\s*\*/.test(line)) {
      return true;
    }

    return false;
  }

  /**
   * Extract debt marker from a line
   *
   * @param line - Line content
   * @param filePath - Path to the file
   * @param lineNumber - Line number (1-indexed)
   * @returns Scanned debt marker or null if not found
   */
  private extractDebtMarker(
    line: string,
    filePath: string,
    lineNumber: number,
  ): ScannedDebtMarker | null {
    for (const [markerType, pattern] of Object.entries(DEBT_MARKER_PATTERNS)) {
      const match = line.match(pattern);
      if (match) {
        // Extract the content after the marker
        let content = match[1]?.trim() || '';

        // If no content captured, try to extract everything after the marker
        if (!content) {
          const markerMatch = line.match(new RegExp(`\\b${markerType}\\b[:\\s]*(.*)`, 'i'));
          content = markerMatch?.[1]?.trim() || '';
        }

        // Clean up the content - remove trailing comment markers
        content = content.replace(/\*\/\s*$/, '').trim();

        return {
          markerType: markerType as DebtMarker,
          content: content || `${markerType} marker`,
          filePath,
          lineNumber,
        };
      }
    }

    return null;
  }

  /**
   * Scan a diff patch for new debt markers (added lines only)
   *
   * @param filePath - Path to the file
   * @param patch - Git diff patch content
   * @returns Array of scanned debt markers from added lines
   */
  scanDiffPatch(filePath: string, patch: string): ScannedDebtMarker[] {
    if (!patch) {
      return [];
    }

    const markers: ScannedDebtMarker[] = [];
    const lines = patch.split('\n');

    let currentLineNumber = 0;

    for (const line of lines) {
      // Parse diff hunk header to get line numbers
      // Format: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (hunkMatch) {
        currentLineNumber = parseInt(hunkMatch[1], 10) - 1;
        continue;
      }

      // Track line numbers
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentLineNumber++;

        // This is an added line - check for debt markers
        const lineContent = line.substring(1); // Remove the '+' prefix

        if (ANY_DEBT_MARKER_PATTERN.test(lineContent)) {
          const languagePattern = this.getLanguagePattern(filePath);

          // If we have language patterns, verify the marker is in a comment
          if (!languagePattern || this.isLineInComment(lineContent, languagePattern)) {
            const marker = this.extractDebtMarker(lineContent, filePath, currentLineNumber);
            if (marker) {
              markers.push(marker);
            }
          }
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        // Deleted line - don't increment line number
      } else if (!line.startsWith('\\')) {
        // Context line
        currentLineNumber++;
      }
    }

    return markers;
  }

  /**
   * Scan a diff patch for removed debt markers (deleted lines only)
   *
   * @param filePath - Path to the file
   * @param patch - Git diff patch content
   * @returns Array of scanned debt markers from deleted lines
   */
  scanDiffPatchForRemovals(filePath: string, patch: string): ScannedDebtMarker[] {
    if (!patch) {
      return [];
    }

    const markers: ScannedDebtMarker[] = [];
    const lines = patch.split('\n');

    let currentLineNumber = 0;

    for (const line of lines) {
      // Parse diff hunk header to get line numbers
      const hunkMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/);
      if (hunkMatch) {
        currentLineNumber = parseInt(hunkMatch[1], 10) - 1;
        continue;
      }

      // Track line numbers for old file
      if (line.startsWith('-') && !line.startsWith('---')) {
        currentLineNumber++;

        // This is a deleted line - check for debt markers
        const lineContent = line.substring(1); // Remove the '-' prefix

        if (ANY_DEBT_MARKER_PATTERN.test(lineContent)) {
          const languagePattern = this.getLanguagePattern(filePath);

          // If we have language patterns, verify the marker is in a comment
          if (!languagePattern || this.isLineInComment(lineContent, languagePattern)) {
            const marker = this.extractDebtMarker(lineContent, filePath, currentLineNumber);
            if (marker) {
              markers.push(marker);
            }
          }
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added line - don't increment old line number
      } else if (!line.startsWith('\\')) {
        // Context line
        currentLineNumber++;
      }
    }

    return markers;
  }
}
