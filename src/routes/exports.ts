import { Router } from "express";
import { requireAuth, requireRole } from "../auth";
import { getDb } from "../db";
import { ExportService } from "../services/export-service";

const router = Router();
const exportService = new ExportService();

// POST /exports — trigger a PDF export for a template
// Requires editor or admin role.
router.post("/", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  const { template_id } = req.body;

  if (!template_id) {
    res.status(400).json({ error: "template_id is required" });
    return;
  }

  const db = getDb();
  const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(template_id) as any;

  if (!template || template.workspace_id !== req.user!.workspace_id) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const result = await exportService.exportToPdf(req.user!.workspace_id, template.filename);

  if (result.status === "failed") {
    res.status(400).json({ error: result.error, jobId: result.jobId });
    return;
  }

  // Record the export job
  db.prepare(
    "INSERT INTO export_jobs (id, template_id, status, output_path, created_by) VALUES (?, ?, ?, ?, ?)"
  ).run(result.jobId, template_id, result.status, result.outputPath, req.user!.id);

  res.status(201).json({
    jobId: result.jobId,
    status: result.status,
    outputPath: result.outputPath,
  });
});

// GET /exports — list export jobs for the caller's workspace
router.get("/", requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT e.id, e.template_id, e.status, e.output_path, e.created_at
    FROM export_jobs e
    JOIN templates t ON e.template_id = t.id
    WHERE t.workspace_id = ?
    ORDER BY e.created_at DESC
  `).all(req.user!.workspace_id);

  res.json({ data: rows });
});

export default router;
