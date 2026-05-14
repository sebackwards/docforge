import { Request, Response, NextFunction } from "express";
import { getDb } from "./db";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  workspace_id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE api_key = ?").get(apiKey) as any;

  if (!row) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  req.user = {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    workspace_id: row.workspace_id,
  };

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
