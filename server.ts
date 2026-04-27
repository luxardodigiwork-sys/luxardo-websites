import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "luxardo-super-secret-key-2026";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json());
app.use(cookieParser());

// Initialize SQLite Database
const db = new Database("luxardo.db");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    full_name TEXT,
    phone TEXT,
    last_login DATETIME,
    created_by TEXT,
    force_password_reset INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    admin_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY,
    permissions TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wholesale_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    retail_type TEXT NOT NULL,
    monthly_volume TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    new_email TEXT,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    user_email TEXT,
    total_amount REAL,
    status TEXT,
    verification_status TEXT,
    payment_status TEXT,
    payment_method TEXT,
    payment_id TEXT,
    tracking_id TEXT,
    tracking_url TEXT,
    courier_name TEXT,
    courier_service TEXT,
    dispatch_date DATETIME,
    dispatch_note TEXT,
    assigned_staff_id TEXT,
    assigned_staff_name TEXT,
    internal_remarks TEXT,
    items TEXT,
    shipping_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default admin and permissions if not exists
const seedData = () => {
  const adminEmail = "luxardodigiwork@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "7976672811";

  const stmt = db.prepare("SELECT * FROM users WHERE role = ?");
  const admin = stmt.get("super_admin");

  if (!admin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    const insert = db.prepare(
      "INSERT INTO users (email, password_hash, role, full_name) VALUES (?, ?, ?, ?)",
    );
    insert.run(adminEmail, hash, "super_admin", "Super Admin");
    console.log("Default super admin seeded.");
  }

  // Seed default permissions for roles
  const roles = ["dispatch", "owner", "analysis"];
  const defaultPermissions = {
    dashboard: true,
    orders: true,
    dispatch_actions: false,
    analysis_reports: false,
    customer_details: true,
    export_data: false,
    backend_management: false,
    tracking_controls: false,
    delivery_update_controls: false,
  };

  const permStmt = db.prepare(
    "INSERT OR IGNORE INTO role_permissions (role, permissions) VALUES (?, ?)",
  );
  roles.forEach((role) => {
    const perms = { ...defaultPermissions };
    if (role === "dispatch") {
      perms.dispatch_actions = true;
      perms.tracking_controls = true;
      perms.delivery_update_controls = true;
    } else if (role === "owner") {
      perms.analysis_reports = true;
      perms.export_data = true;
      perms.backend_management = true;
    } else if (role === "analysis") {
      perms.analysis_reports = true;
      perms.export_data = true;
    }
    permStmt.run(role, JSON.stringify(perms));
  });

  // Seed default backend users for each role
  const defaultPassword = "311001";
  const rolesWithUsers = [
    { role: "owner", email: "owner_311001" },
    { role: "dispatch", email: "dispatch_311001" },
    { role: "analysis", email: "analysis_311001" },
  ];

  const userStmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, role, full_name, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
  );

  // Seed default customer user
  const customerEmail = "testuser@luxardo.com";
  const customerPassword = "311001";
  const existingCustomer = userStmt.get(customerEmail) as any;
  if (!existingCustomer) {
    const hash = bcrypt.hashSync(customerPassword, 10);
    insertUser.run(
      customerEmail,
      hash,
      "customer",
      "Test Customer",
      "active",
      "System Admin",
    );
    console.log("Default test customer seeded.");
  } else if (existingCustomer.role !== "customer") {
    // Migration: Ensure correct role
    db.prepare("UPDATE users SET role = ? WHERE email = ?").run(
      "customer",
      customerEmail,
    );
    console.log("Migrated test customer to correct role.");
  }

  rolesWithUsers.forEach((u) => {
    const existing = userStmt.get(u.email);
    if (!existing) {
      const hash = bcrypt.hashSync(defaultPassword, 10);
      insertUser.run(
        u.email,
        hash,
        u.role,
        `${u.role.charAt(0).toUpperCase() + u.role.slice(1)} Test User`,
        "active",
        "System Admin",
      );
      console.log(`Default ${u.role} user seeded: ${u.email}`);
    }
  });
};
seedData();

// Middleware to verify JWT
const authenticate = (req: any, res: any, next: any) => {
  const token =
    req.cookies.admin_token ||
    req.cookies.user_token ||
    req.cookies.backend_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Refresh user data from DB to ensure it's still valid/active
    const stmt = db.prepare(
      "SELECT id, email, role, full_name, force_password_reset FROM users WHERE id = ? AND status = ?",
    );
    const user = stmt.get(decoded.id, "active") as any;

    if (!user)
      return res.status(401).json({ error: "User not found or disabled" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden: Super Admin only" });
  }
  next();
};

// API Routes

// 1. Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user = stmt.get(email) as any;

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (user.status !== "active") {
    return res.status(403).json({ error: "Account is disabled" });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      force_password_reset: user.force_password_reset,
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  // Update last login
  db.prepare(
    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(user.id);

  logActivity(user.id, user.email, "login");

  // Fetch permissions
  const permStmt = db.prepare(
    "SELECT permissions FROM role_permissions WHERE role = ?",
  );
  const perms = permStmt.get(user.role) as any;
  const permissions = perms ? JSON.parse(perms.permissions) : {};

  // STRICT SEPARATION: Separate tokens for different flows
  let cookieName = "user_token";
  if (["super_admin", "admin"].includes(user.role)) {
    cookieName = "admin_token";
  } else if (["dispatch", "owner", "analysis"].includes(user.role)) {
    cookieName = "backend_token";
  }

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/", // Ensure cookie is accessible across all paths
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      force_password_reset: user.force_password_reset,
      full_name: user.full_name,
      permissions,
    },
  });
});

// 2. Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.clearCookie("user_token");
  res.clearCookie("backend_token");
  res.json({ success: true });
});

// 3. Check Auth Status
app.get("/api/auth/me", authenticate, (req: any, res) => {
  const user = { ...req.user };

  // Attach permissions
  const permStmt = db.prepare(
    "SELECT permissions FROM role_permissions WHERE role = ?",
  );
  const perms = permStmt.get(user.role) as any;
  if (perms) {
    user.permissions = JSON.parse(perms.permissions);
  } else {
    user.permissions = {};
  }

  res.json({ user });
});

// 5. Register (for customers)
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, phone, country } = req.body;

  try {
    const userStmt = db.prepare("SELECT * FROM users WHERE email = ?");
    if (userStmt.get(email)) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = bcrypt.hashSync(password, 10);
    const insertUser = db.prepare(
      "INSERT INTO users (email, password_hash, role, full_name, phone, country, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const result = insertUser.run(
      email,
      hash,
      "customer",
      name,
      phone || "",
      country || "",
      "active",
      "Self Registration",
    );

    const token = jwt.sign(
      { id: result.lastInsertRowid, email, role: "customer" },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.cookie("user_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({
      success: true,
      user: {
        id: result.lastInsertRowid.toString(),
        email,
        role: "customer",
        full_name: name,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// 6. Request Password Recovery (Mock Email)
app.post("/api/auth/recover-password", (req, res) => {
  const { email } = req.body;
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user = stmt.get(email) as any;

  if (user) {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    db.prepare(
      "DELETE FROM verification_codes WHERE user_id = ? AND type = ?",
    ).run(user.id, "password_recovery");
    db.prepare(
      "INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES (?, ?, ?, ?)",
    ).run(user.id, code, "password_recovery", expiresAt);

    // In a real app, send email here. For now, we return it in dev mode or log it.
    console.log(`[MOCK EMAIL] Password recovery code for ${email}: ${code}`);
    res.json({
      success: true,
      message: "Verification code sent to email.",
      mockCode: code,
    }); // Returning mockCode for testing
  } else {
    // Prevent email enumeration
    res.json({
      success: true,
      message: "If the email exists, a code was sent.",
    });
  }
});

// 5. Verify Password Recovery Code & Reset
app.post("/api/auth/reset-password", (req, res) => {
  const { email, code, newPassword } = req.body;
  const userStmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user = userStmt.get(email) as any;

  if (!user) return res.status(400).json({ error: "Invalid request" });

  const codeStmt = db.prepare(
    "SELECT * FROM verification_codes WHERE user_id = ? AND type = ? AND code = ? AND expires_at > ?",
  );
  const verification = codeStmt.get(
    user.id,
    "password_recovery",
    code,
    new Date().toISOString(),
  );

  if (!verification) {
    return res
      .status(400)
      .json({ error: "Invalid or expired verification code" });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hash,
    user.id,
  );
  db.prepare("DELETE FROM verification_codes WHERE id = ?").run(
    (verification as any).id,
  );

  res.json({ success: true, message: "Password reset successfully" });
});

// 6. Request Email Change (Requires Auth)
app.post("/api/auth/request-email-change", authenticate, (req: any, res) => {
  const { newEmail } = req.body;
  const userId = req.user.id;

  // Check if email already exists
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(newEmail);
  if (existing) return res.status(400).json({ error: "Email already in use" });

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare(
    "DELETE FROM verification_codes WHERE user_id = ? AND type = ?",
  ).run(userId, "email_change");
  db.prepare(
    "INSERT INTO verification_codes (user_id, code, type, new_email, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, code, "email_change", newEmail, expiresAt);

  console.log(
    `[MOCK EMAIL] Email change code for ${req.user.email} to ${newEmail}: ${code}`,
  );
  res.json({
    success: true,
    message: "Verification code sent to current email.",
    mockCode: code,
  });
});

// 7. Verify Email Change
app.post("/api/auth/verify-email-change", authenticate, (req: any, res) => {
  const { code } = req.body;
  const userId = req.user.id;

  const codeStmt = db.prepare(
    "SELECT * FROM verification_codes WHERE user_id = ? AND type = ? AND code = ? AND expires_at > ?",
  );
  const verification = codeStmt.get(
    userId,
    "email_change",
    code,
    new Date().toISOString(),
  ) as any;

  if (!verification) {
    return res
      .status(400)
      .json({ error: "Invalid or expired verification code" });
  }

  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(
    verification.new_email,
    userId,
  );
  db.prepare("DELETE FROM verification_codes WHERE id = ?").run(
    verification.id,
  );

  res.json({
    success: true,
    message: "Email updated successfully. Please log in again.",
  });
});

// --- Wholesale Applications API ---

// Public: Submit application
app.post("/api/wholesale-applications", (req, res) => {
  const {
    full_name,
    company_name,
    email,
    phone,
    country,
    city,
    retail_type,
    monthly_volume,
    message,
  } = req.body;

  if (
    !full_name ||
    !company_name ||
    !email ||
    !phone ||
    !country ||
    !city ||
    !retail_type ||
    !monthly_volume
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO wholesale_applications 
      (full_name, company_name, email, phone, country, city, retail_type, monthly_volume, message) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      full_name,
      company_name,
      email,
      phone,
      country,
      city,
      retail_type,
      monthly_volume,
      message,
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Wholesale application error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Admin: Get all applications
app.get("/api/wholesale-applications", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const applications = db
    .prepare("SELECT * FROM wholesale_applications ORDER BY created_at DESC")
    .all();
  res.json({ applications });
});

// Admin: Update application status
app.put("/api/wholesale-applications/:id", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { id } = req.params;
  const { status } = req.body;

  const result = db
    .prepare("UPDATE wholesale_applications SET status = ? WHERE id = ?")
    .run(status, id);
  if (result.changes === 0)
    return res.status(404).json({ error: "Application not found" });

  logActivity(
    null,
    req.user.email,
    "update_wholesale_status",
    `Updated application ${id} to ${status}`,
  );
  res.json({ success: true });
});

// Helper for logging activity
const logActivity = (
  userId: number | null,
  adminEmail: string | null,
  action: string,
  details: string | null = null,
) => {
  try {
    const stmt = db.prepare(
      "INSERT INTO activity_logs (user_id, admin_email, action, details) VALUES (?, ?, ?, ?)",
    );
    stmt.run(userId, adminEmail, action, details);
  } catch (err) {
    console.error("Logging error:", err);
  }
};

// --- Backend Management API ---

// Get activity logs
app.get("/api/activity-logs", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { role, userId } = req.query;
  let query =
    "SELECT al.*, u.full_name, u.role as user_role FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id";
  const params: any[] = [];

  if (role) {
    query += " WHERE u.role = ?";
    params.push(role);
  } else if (userId) {
    query += " WHERE al.user_id = ?";
    params.push(userId);
  }

  query += " ORDER BY al.created_at DESC LIMIT 100";
  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

// Get all backend users
app.get("/api/backend-users", authenticate, (req: any, res) => {
  // Only admin or owner can see backend users
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const users = db
    .prepare(
      "SELECT id, email, role, status, full_name, phone, last_login, created_by, created_at FROM users WHERE role != ?",
    )
    .all("super_admin");
  res.json({ users });
});

// Create backend user
app.post("/api/backend-users", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { email, password, role, full_name, phone, status } = req.body;
  const validRoles = ["dispatch", "owner", "analysis", "admin"];

  if (!validRoles.includes(role))
    return res.status(400).json({ error: "Invalid role" });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const insert = db.prepare(
      "INSERT INTO users (email, password_hash, role, full_name, phone, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const result = insert.run(
      email,
      hash,
      role,
      full_name,
      phone,
      status || "active",
      req.user.email,
    );

    logActivity(
      result.lastInsertRowid as number,
      req.user.email,
      "create_user",
      `Created ${role} user: ${email}`,
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Database error" });
  }
});

// Update backend user
app.put("/api/backend-users/:id", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { id } = req.params;
  const { role, status, password, full_name, phone, force_password_reset } =
    req.body;

  let query =
    "UPDATE users SET role = ?, status = ?, full_name = ?, phone = ?, force_password_reset = ?";
  const params: any[] = [
    role,
    status,
    full_name,
    phone,
    force_password_reset ? 1 : 0,
  ];

  if (password) {
    query += ", password_hash = ?";
    params.push(bcrypt.hashSync(password, 10));
  }

  query += " WHERE id = ? AND role != ?";
  params.push(id, "super_admin");

  const result = db.prepare(query).run(...params);
  if (result.changes === 0)
    return res
      .status(404)
      .json({ error: "User not found or cannot edit super admin" });

  logActivity(Number(id), req.user.email, "update_user", `Updated user: ${id}`);
  if (password) {
    logActivity(
      Number(id),
      req.user.email,
      "password_change",
      `Changed password for user: ${id}`,
    );
  }

  res.json({ success: true });
});

// Delete backend user
app.delete("/api/backend-users/:id", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { id } = req.params;
  const result = db
    .prepare("DELETE FROM users WHERE id = ? AND role != ?")
    .run(id, "super_admin");
  if (result.changes === 0)
    return res
      .status(404)
      .json({ error: "User not found or cannot delete super admin" });

  logActivity(Number(id), req.user.email, "delete_user", `Deleted user: ${id}`);

  res.json({ success: true });
});

// Role Permissions API
app.get("/api/role-permissions", authenticate, (req: any, res) => {
  const perms = db.prepare("SELECT * FROM role_permissions").all();
  const formatted = perms.reduce((acc: any, curr: any) => {
    acc[curr.role] = JSON.parse(curr.permissions);
    return acc;
  }, {});
  res.json({ permissions: formatted });
});

app.get("/api/role-permissions/:role", authenticate, (req: any, res) => {
  const { role } = req.params;
  const perms = db
    .prepare("SELECT permissions FROM role_permissions WHERE role = ?")
    .get(role) as any;
  if (!perms) return res.status(404).json({ error: "Role not found" });
  res.json({ permissions: JSON.parse(perms.permissions) });
});

app.put("/api/role-permissions/:role", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { role } = req.params;
  const { permissions } = req.body;

  db.prepare(
    "INSERT OR REPLACE INTO role_permissions (role, permissions) VALUES (?, ?)",
  ).run(role, JSON.stringify(permissions));
  res.json({ success: true });
});

// Admin Assistant Chatbot API
app.post("/api/admin/chat", authenticate, async (req: any, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const systemInstruction = `You are the Luxardo Admin Panel Assistant. You help the store owner and staff navigate and use the admin panel. 
You know everything about the admin panel. Here is the structure and functionality:
- Dashboard (/admin/dashboard): Overview of store performance, recent orders, and key metrics.
- Products (/admin/products): Manage inventory, add/edit/remove products, set prices, and stock levels.
- Collections (/admin/collections): Organize products into collections (like Tuxedos, Suits) to make them easier for customers to find.
- Media (/admin/media): Upload and manage images and videos used across the website.
- Content (/admin/content): Edit the text and hero images for the homepage, about page, and other sections of the website.
- Partners (/admin/partners): Manage wholesale partners and B2B relationships.
- Backend Management (/admin/backend-management): Manage admin users, roles, and view activity logs.
- Settings (/admin/settings): Configure general store settings and security preferences.

Answer questions clearly and concisely in Hindi or English as requested by the user. Guide them to the correct section if they ask how to do something.`;

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: formattedMessages,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ reply: response.text });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

// --- Settings API ---
app.get("/api/settings/:key", authenticate, (req: any, res) => {
  const { key } = req.params;
  const setting = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as any;
  res.json({ value: setting ? JSON.parse(setting.value) : null });
});

app.post("/api/settings/:key", authenticate, (req: any, res) => {
  if (
    req.user.role !== "super_admin" &&
    req.user.role !== "admin" &&
    req.user.role !== "owner"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { key } = req.params;
  const { value } = req.body;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    key,
    JSON.stringify(value),
  );
  res.json({ success: true });
});

// --- Razorpay API ---
import Razorpay from "razorpay";

app.post("/api/payment/create-order", async (req: any, res) => {
  try {
    const { amount } = req.body; // amount in INR
    const setting = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("razorpay_settings") as any;
    const rpSettings = setting ? JSON.parse(setting.value) : null;

    if (!rpSettings || !rpSettings.keyId || !rpSettings.secretKey) {
      return res.status(500).json({ error: "Razorpay is not configured" });
    }

    const razorpay = new Razorpay({
      key_id: rpSettings.keyId,
      key_secret: rpSettings.secretKey,
    });

    const options = {
      amount: Math.round(amount * 100), // amount in smallest currency unit
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ order, keyId: rpSettings.keyId });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

app.post("/api/payment/verify", async (req: any, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData,
    } = req.body;
    const setting = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("razorpay_settings") as any;
    const rpSettings = setting ? JSON.parse(setting.value) : null;

    if (!rpSettings || !rpSettings.secretKey) {
      return res.status(500).json({ error: "Razorpay is not configured" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", rpSettings.secretKey)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Payment verified successfully

      // Generate Order ID
      const orderId = `LUX${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;

      // Create order object
      const newOrder = {
        id: orderId,
        userId: orderData.userId,
        userName: orderData.userName,
        userEmail: orderData.userEmail,
        totalAmount: orderData.totalAmount,
        status: "placed",
        verificationStatus: "dispatch_ready", // Unlock dispatch workflow
        paymentStatus: "confirmed",
        paymentMethod: "razorpay",
        paymentId: razorpay_payment_id,
        trackingId: null,
        courierStatus: "pending",
        createdAt: new Date().toISOString(),
        items: orderData.items,
        shippingAddress: orderData.shippingAddress,
      };

      // Save to database
      const insertOrder = db.prepare(`
        INSERT INTO orders (
          id, user_id, user_name, user_email, total_amount, status, 
          verification_status, payment_status, payment_method, payment_id, 
          items, shipping_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertOrder.run(
        newOrder.id,
        newOrder.userId,
        newOrder.userName,
        newOrder.userEmail,
        newOrder.totalAmount,
        newOrder.status,
        newOrder.verificationStatus,
        newOrder.paymentStatus,
        newOrder.paymentMethod,
        newOrder.paymentId,
        JSON.stringify(newOrder.items),
        JSON.stringify(newOrder.shippingAddress),
        newOrder.createdAt,
      );

      res.json({
        success: true,
        paymentId: razorpay_payment_id,
        order: newOrder,
      });
    } else {
      res.status(400).json({ success: false, error: "Invalid signature" });
    }
  } catch (error) {
    console.error("Razorpay verify error:", error);
    res
      .status(500)
      .json({ error: "Failed to verify payment and create order" });
  }
});

// --- DTDC API (Mock) ---
app.post("/api/dtdc/create-shipment", async (req: any, res) => {
  try {
    const { orderId, shipmentData } = req.body;

    // In a real scenario, this would call the DTDC API
    // const dtdcResponse = await fetch('https://api.dtdc.com/...', { ... });

    // Mock DTDC response
    const trackingId = `DTDC${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Update order in database if it exists
    const updateOrder = db.prepare(`
      UPDATE orders 
      SET tracking_id = ?, courier_name = 'DTDC', status = 'shipped', dispatch_date = ? 
      WHERE id = ?
    `);
    updateOrder.run(trackingId, new Date().toISOString(), orderId);

    res.json({
      success: true,
      trackingId,
      message: "Shipment created successfully with DTDC",
    });
  } catch (error) {
    console.error("DTDC create shipment error:", error);
    res.status(500).json({ error: "Failed to create shipment with DTDC" });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
