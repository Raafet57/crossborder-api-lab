import { NextFunction, Request, Response } from "express";

const AUTH_KEY = process.env.AUTH_KEY ?? "demo_key";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("Authorization");
  const expected = `Bearer ${AUTH_KEY}`;

  if (authHeader !== expected) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="demo"');
    res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Unauthorized",
      details: {
        expected: "Authorization: Bearer <token>",
      },
    });
    return;
  }

  next();
}
