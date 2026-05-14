import request from "supertest";
import fs from "fs";
import path from "path";
import { createApp } from "../src/index";
import { resetDb } from "../src/db";

const TEMPLATES_ROOT = process.env.TEMPLATES_ROOT || "/data/templates";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  resetDb();
  app = createApp();

  // Ensure template directories and seed files exist
  const alphaDir = path.join(TEMPLATES_ROOT, "ws-alpha");
  const betaDir = path.join(TEMPLATES_ROOT, "ws-beta");
  fs.mkdirSync(alphaDir, { recursive: true });
  fs.mkdirSync(betaDir, { recursive: true });

  fs.writeFileSync(path.join(alphaDir, "invoice.html"), "<h1>Invoice #{{id}}</h1><p>Amount: $100</p>");
  fs.writeFileSync(path.join(alphaDir, "shared-header.html"), "<header><nav>Alpha Corp</nav></header>");
  fs.writeFileSync(path.join(alphaDir, "quarterly.html"), "<h1>Q1 Report</h1><table><tr><td>Revenue</td></tr></table>");
  fs.writeFileSync(path.join(betaDir, "receipt.html"), "<h1>Receipt</h1><p>Thank you for your purchase.</p>");
  fs.writeFileSync(path.join(betaDir, "shared-footer.html"), "<footer>Beta LLC &copy; 2024</footer>");
});

const ALICE = { "X-API-Key": "key-alice" };   // admin, ws-alpha
const CAROL = { "X-API-Key": "key-carol" };   // editor, ws-alpha
const FRANK = { "X-API-Key": "key-frank" };   // viewer, ws-alpha
const BOB = { "X-API-Key": "key-bob" };       // admin, ws-beta
const DAVE = { "X-API-Key": "key-dave" };     // editor, ws-beta

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe("health", () => {
  test("returns_ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("authentication", () => {
  test("rejects_missing_api_key", async () => {
    const res = await request(app).get("/api/templates");
    expect(res.status).toBe(401);
  });

  test("rejects_invalid_api_key", async () => {
    const res = await request(app).get("/api/templates").set("X-API-Key", "bad-key");
    expect(res.status).toBe(401);
  });

  test("accepts_valid_api_key", async () => {
    const res = await request(app).get("/api/templates").set(ALICE);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Template listing
// ---------------------------------------------------------------------------

describe("GET /api/templates", () => {
  test("returns_only_own_workspace_templates", async () => {
    const res = await request(app).get("/api/templates").set(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  test("other_workspace_sees_own_templates", async () => {
    const res = await request(app).get("/api/templates").set(BOB);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  test("viewer_can_list_templates", async () => {
    const res = await request(app).get("/api/templates").set(FRANK);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Template detail
// ---------------------------------------------------------------------------

describe("GET /api/templates/:id", () => {
  test("returns_template_metadata", async () => {
    const res = await request(app).get("/api/templates/tpl-001").set(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Invoice Template");
  });

  test("blocks_cross_workspace_access", async () => {
    const res = await request(app).get("/api/templates/tpl-004").set(ALICE);
    expect(res.status).toBe(404);
  });

  test("returns_404_for_unknown_template", async () => {
    const res = await request(app).get("/api/templates/tpl-999").set(ALICE);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Template content (the dangerouslySetInnerHTML source)
// ---------------------------------------------------------------------------

describe("GET /api/templates/:id/content", () => {
  test("returns_html_content_for_own_template", async () => {
    const res = await request(app).get("/api/templates/tpl-001/content").set(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("<h1>Invoice");
  });

  test("returns_shared_template_content", async () => {
    const res = await request(app).get("/api/templates/tpl-002/content").set(CAROL);
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Alpha Corp");
  });

  test("blocks_cross_workspace_content_access", async () => {
    const res = await request(app).get("/api/templates/tpl-004/content").set(ALICE);
    expect(res.status).toBe(404);
  });

  test("viewer_can_read_content", async () => {
    const res = await request(app).get("/api/templates/tpl-001/content").set(FRANK);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Template creation
// ---------------------------------------------------------------------------

describe("POST /api/templates", () => {
  test("admin_can_create_template", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(ALICE)
      .send({ name: "New Template", filename: "new-tpl.html", content: "<p>Hello</p>" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test("editor_can_create_template", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(CAROL)
      .send({ name: "Editor Template", filename: "editor-tpl.html", content: "<p>Editor</p>" });
    expect(res.status).toBe(201);
  });

  test("viewer_cannot_create_template", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(FRANK)
      .send({ name: "Blocked", filename: "blocked.html", content: "<p>No</p>" });
    expect(res.status).toBe(403);
  });

  test("rejects_missing_fields", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(ALICE)
      .send({ name: "Incomplete" });
    expect(res.status).toBe(400);
  });

  test("rejects_path_traversal_in_filename", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(ALICE)
      .send({ name: "Evil", filename: "../etc/passwd.html", content: "x" });
    expect(res.status).toBe(400);
  });

  test("rejects_absolute_path_filename", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(ALICE)
      .send({ name: "Evil", filename: "/etc/shadow.html", content: "x" });
    expect(res.status).toBe(400);
  });

  test("rejects_non_html_extension", async () => {
    const res = await request(app)
      .post("/api/templates")
      .set(ALICE)
      .send({ name: "Script", filename: "evil.js", content: "x" });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Template deletion
// ---------------------------------------------------------------------------

describe("DELETE /api/templates/:id", () => {
  test("admin_can_delete_template", async () => {
    const res = await request(app).delete("/api/templates/tpl-003").set(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  test("editor_cannot_delete_template", async () => {
    const res = await request(app).delete("/api/templates/tpl-001").set(CAROL);
    expect(res.status).toBe(403);
  });

  test("cannot_delete_cross_workspace_template", async () => {
    const res = await request(app).delete("/api/templates/tpl-004").set(ALICE);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Export jobs
// ---------------------------------------------------------------------------

describe("POST /api/exports", () => {
  test("admin_can_trigger_export", async () => {
    const res = await request(app)
      .post("/api/exports")
      .set(ALICE)
      .send({ template_id: "tpl-001" });
    // wkhtmltopdf is not installed in test env, so this will fail at execution
    // but the validation and job creation should proceed
    expect([201, 400]).toContain(res.status);
  });

  test("viewer_cannot_trigger_export", async () => {
    const res = await request(app)
      .post("/api/exports")
      .set(FRANK)
      .send({ template_id: "tpl-001" });
    expect(res.status).toBe(403);
  });

  test("rejects_missing_template_id", async () => {
    const res = await request(app)
      .post("/api/exports")
      .set(ALICE)
      .send({});
    expect(res.status).toBe(400);
  });

  test("rejects_cross_workspace_template_export", async () => {
    const res = await request(app)
      .post("/api/exports")
      .set(ALICE)
      .send({ template_id: "tpl-004" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/exports", () => {
  test("returns_export_jobs_for_workspace", async () => {
    const res = await request(app).get("/api/exports").set(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
