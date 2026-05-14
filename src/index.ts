import express from "express";
import templatesRouter from "./routes/templates";
import exportsRouter from "./routes/exports";

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/templates", templatesRouter);
  app.use("/api/exports", exportsRouter);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`docforge listening on port ${PORT}`);
  });
}
