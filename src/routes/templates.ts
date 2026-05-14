import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, requireRole } from "../auth";
import { getDb } from "../db";
import { TemplateStore } from "../services/template-store";
import { PathValidator, ValidationResult } from "../services/path-validator";

const router = Router();
const templateStore = new TemplateStore();
const pathValidator = new PathValidator();

// GET /templates — list templates in the caller's workspace
router.get("/", requireAuth, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, name, filename, is_shared, created_at FROM templates WHERE workspace_id = ?")
    .all(req.user!.workspace_id);
  res.json({ data: rows });
});

// GET /templates/:id — get template metadata
router.get("/:id", requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id) as any;

  if (!row || row.workspace_id !== req.user!.workspace_id) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.json(row);
});

// GET /templates/:id/content — read the template HTML content from disk
// This content is rendered by the frontend using dangerouslySetInnerHTML.
// It is considered safe because it comes from the trusted templates directory.
router.get("/:id/content", requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id) as any;

  if (!row || row.workspace_id !== req.user!.workspace_id) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  try {
    const content = templateStore.readContent(row.workspace_id, row.filename);
    res.json({ content, filename: row.filename, name: row.name });
  } catch {
    res.status(404).json({ error: "Template file not found on disk" });
  }
});

// POST /templates — create a new template (admin/editor only)
router.post("/", requireAuth, requireRole("admin", "editor"), (req, res) => {
  const { name, filename, content } = req.body;

  if (!name || !filename || !content) {
    res.status(400).json({ error: "name, filename, and content are required" });
    return;
  }

  const validation = pathValidator.validateFilename(filename, req.user!.workspace_id);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const db = getDb();
  const id = uuidv4();

  // Write the template file to disk using the sanitized filename
  templateStore.writeContent(req.user!.workspace_id, validation.sanitized!, content);

  // Record in database
  db.prepare(
    "INSERT INTO templates (id, name, filename, workspace_id, created_by) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, validation.sanitized!, req.user!.workspace_id, req.user!.id);

  res.status(201).json({ id, name, filename: validation.sanitized! });
});

// DELETE /templates/:id — delete a template (admin only)
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id) as any;

  if (!row || row.workspace_id !== req.user!.workspace_id) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  res.json({ deleted: true });
});

export default router;
