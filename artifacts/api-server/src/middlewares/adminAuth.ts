import type { NextFunction, Request, Response } from "express";

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Connexion requise." });
    return;
  }

  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase())
    .filter(Boolean);
  const email = req.user.email?.trim().toLocaleLowerCase();

  if (!email || !allowedEmails.includes(email)) {
    res.status(403).json({ error: "Ce compte n'est pas autorisé." });
    return;
  }

  next();
}
