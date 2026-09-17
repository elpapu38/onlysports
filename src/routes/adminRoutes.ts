import { Router } from "express";
import { adminAuth } from "@/middleware/adminAuth";

export const adminRoutes = Router();
adminRoutes.use(adminAuth);

adminRoutes.get("/", (_req, res) => {
  res.render("admin/dashboard", { title: "Panel administrativo" });
});
