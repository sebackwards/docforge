import fs from "fs";
import path from "path";

const TEMPLATES_ROOT = process.env.TEMPLATES_ROOT || "/data/templates";

/**
 * Manages template file storage on disk.
 * Templates are stored in workspace-scoped directories.
 */
export class TemplateStore {
  getFilePath(workspaceId: string, filename: string): string {
    return path.join(TEMPLATES_ROOT, workspaceId, filename);
  }

  readContent(workspaceId: string, filename: string): string {
    const filePath = this.getFilePath(workspaceId, filename);
    return fs.readFileSync(filePath, "utf-8");
  }

  writeContent(workspaceId: string, filename: string, content: string): void {
    const dir = path.join(TEMPLATES_ROOT, workspaceId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), content, "utf-8");
  }

  exists(workspaceId: string, filename: string): boolean {
    return fs.existsSync(this.getFilePath(workspaceId, filename));
  }
}
