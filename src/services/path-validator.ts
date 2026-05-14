import path from "path";

const TEMPLATES_ROOT = process.env.TEMPLATES_ROOT || "/data/templates";

export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
}

/**
 * Validates file paths to prevent directory traversal attacks.
 * Resolves the full path and verifies it stays within the workspace directory.
 */
export class PathValidator {
  /**
   * Validates that a filename resolves to a location within the workspace
   * template directory. Returns the sanitized basename if valid.
   */
  validateFilename(filename: string, workspaceId?: string): ValidationResult {
    if (!filename || filename.trim().length === 0) {
      return { valid: false, error: "Filename is required" };
    }

    if (!filename.endsWith(".html")) {
      return { valid: false, error: "Only .html files are supported" };
    }

    const wsDir = workspaceId
      ? path.resolve(TEMPLATES_ROOT, workspaceId)
      : path.resolve(TEMPLATES_ROOT);

    const resolvedPath = path.resolve(wsDir, filename);

    if (!resolvedPath.startsWith(wsDir + path.sep) && resolvedPath !== wsDir) {
      return { valid: false, error: "Path traversal is not allowed" };
    }

    const sanitized = path.basename(resolvedPath);

    return { valid: true, sanitized };
  }
}
