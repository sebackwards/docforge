import path from "path";
import os from "os";

// Use a temp directory for template files during tests
process.env.TEMPLATES_ROOT = path.join(os.tmpdir(), "docforge-test-templates");
process.env.EXPORT_OUTPUT_DIR = path.join(os.tmpdir(), "docforge-test-exports");
