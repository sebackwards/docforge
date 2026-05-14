import { exec } from "child_process";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { PathValidator } from "./path-validator";
import { TemplateStore } from "./template-store";

const TEMPLATES_ROOT = process.env.TEMPLATES_ROOT || "/data/templates";
const EXPORT_OUTPUT_DIR = process.env.EXPORT_OUTPUT_DIR || "/tmp/exports";

export interface ExportResult {
  jobId: string;
  status: "completed" | "failed";
  outputPath?: string;
  error?: string;
}

/**
 * Handles PDF export of templates using wkhtmltopdf.
 * Validates the filename for path traversal before constructing the export command.
 */
export class ExportService {
  private pathValidator: PathValidator;
  private templateStore: TemplateStore;

  constructor() {
    this.pathValidator = new PathValidator();
    this.templateStore = new TemplateStore();
  }

  /**
   * Export a template to PDF.
   * The filename is validated against path traversal before being used.
   */
  async exportToPdf(workspaceId: string, filename: string): Promise<ExportResult> {
    const jobId = uuidv4();

    // Validate the filename to prevent path traversal
    const validation = this.pathValidator.validateFilename(filename, workspaceId);
    if (!validation.valid) {
      return { jobId, status: "failed", error: validation.error };
    }

    const sanitizedFilename = validation.sanitized!;

    // Verify the template file exists
    if (!this.templateStore.exists(workspaceId, sanitizedFilename)) {
      return { jobId, status: "failed", error: "Template file not found" };
    }

    const inputPath = path.join(TEMPLATES_ROOT, workspaceId, sanitizedFilename);
    const outputPath = path.join(EXPORT_OUTPUT_DIR, `${jobId}.pdf`);

    // Execute the PDF conversion
    const result = await this.runExport(inputPath, outputPath);

    return {
      jobId,
      status: result.success ? "completed" : "failed",
      outputPath: result.success ? outputPath : undefined,
      error: result.error,
    };
  }

  private runExport(inputPath: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Construct the wkhtmltopdf command
      const cmd = `wkhtmltopdf --quiet "${inputPath}" "${outputPath}"`;

      exec(cmd, { timeout: 30000 }, (error, _stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
}
