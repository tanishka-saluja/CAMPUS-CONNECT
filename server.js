const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { readFile, writeFile } = require("fs/promises");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const REQUESTS_FILE = path.join(DATA_DIR, "requests.json");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "vitvellore123";
const STATUS_VALUES = new Set(["Pending", "Approved", "Rejected"]);
const VALID_ROLES = new Set(["cse", "ece", "management"]);
const sessions = new Map();

const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/student.html": "student.html",
  "/admin.html": "admin.html",
  "/styles.css": "styles.css",
  "/script.js": "script.js",
  "/login.js": "login.js",
  "/admin.js": "admin.js",
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(message);
}

async function readJson(filePath, fallback) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanKey(value) {
  return cleanText(value, 30).toLowerCase();
}

function cleanUrl(value) {
  const url = cleanText(value, 300);
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : "";
}

function normalizeEmail(value) {
  return cleanText(value, 120).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStudentEmail(email) {
  return /^[^\s@]+@vitstudent\.ac\.in$/i.test(email);
}

function createSession(sessionData) {
  const token = crypto.randomUUID();
  sessions.set(token, sessionData);
  return token;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

function getSession(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return { token, data: sessions.get(token) || null };
}

function requireSession(req, res, expectedRole) {
  const session = getSession(req);

  if (!session || !session.data) {
    sendJson(res, 401, { message: "Unauthorized" });
    return null;
  }

  if (expectedRole && session.data.role !== expectedRole) {
    sendJson(res, 403, { message: "Forbidden" });
    return null;
  }

  return session;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", () => {
      reject(new Error("Request error"));
    });
  });
}

function normalizeJob(job, index) {
  const roles = Array.isArray(job.roles)
    ? job.roles.map(cleanKey).filter((role) => VALID_ROLES.has(role))
    : [];

  return {
    id: Number(job.id) || index + 1,
    company: cleanText(job.company, 80),
    title: cleanText(job.title, 80),
    type: cleanText(job.type, 30) || "Internship",
    location: cleanText(job.location, 60),
    mode: cleanText(job.mode, 30) || "Hybrid",
    packageLabel: cleanText(job.packageLabel, 60),
    compensation: Number(job.compensation) || 0,
    roles: roles.length ? roles : ["cse"],
    description: cleanText(job.description, 240),
    postedAt: cleanText(job.postedAt, 40) || new Date().toISOString(),
  };
}

function normalizeRequest(request, index) {
  return {
    id: Number(request.id) || index + 1,
    name: cleanText(request.name, 80),
    email: normalizeEmail(request.email),
    role: cleanText(request.role, 30) || "student",
    message: cleanText(request.message, 500),
    status: STATUS_VALUES.has(request.status) ? request.status : "Pending",
    createdAt: cleanText(request.createdAt, 40) || new Date().toISOString(),
  };
}

function normalizeApplication(application, index) {
  return {
    id: Number(application.id) || index + 1,
    jobId: Number(application.jobId) || 0,
    studentName: cleanText(application.studentName, 80),
    studentEmail: normalizeEmail(application.studentEmail),
    jobTitle: cleanText(application.jobTitle, 80),
    company: cleanText(application.company, 80),
    resumeUrl: cleanUrl(application.resumeUrl),
    note: cleanText(application.note, 500),
    status: STATUS_VALUES.has(application.status) ? application.status : "Pending",
    appliedAt: cleanText(application.appliedAt, 40) || new Date().toISOString(),
  };
}

async function readJobs() {
  const jobs = await readJson(JOBS_FILE, []);
  return jobs
    .map(normalizeJob)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

async function readStats() {
  return readJson(STATS_FILE, []);
}

async function readRequests() {
  const requests = await readJson(REQUESTS_FILE, []);
  return requests
    .map(normalizeRequest)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function writeRequests(requests) {
  await writeJson(REQUESTS_FILE, requests.map(normalizeRequest));
}

async function readApplications() {
  const applications = await readJson(APPLICATIONS_FILE, []);
  return applications
    .map(normalizeApplication)
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
}

async function writeApplications(applications) {
  await writeJson(APPLICATIONS_FILE, applications.map(normalizeApplication));
}

async function writeJobs(jobs) {
  await writeJson(JOBS_FILE, jobs.map(normalizeJob));
}

function isValidStatus(status) {
  return STATUS_VALUES.has(status);
}

async function handleApi(req, res, pathname) {
  const requestStatusMatch = pathname.match(/^\/api\/admin\/requests\/(\d+)$/);
  const applicationStatusMatch = pathname.match(/^\/api\/admin\/applications\/(\d+)$/);

  if (req.method === "POST" && pathname === "/api/login") {
    try {
      const body = await parseBody(req);
      const role = cleanText(body.role, 20);

      if (role === "student") {
        const name = cleanText(body.name, 80);
        const email = normalizeEmail(body.email);

        if (!name || !email) {
          return sendJson(res, 400, { message: "Name and email are required." });
        }

        if (!isStudentEmail(email)) {
          return sendJson(res, 400, {
            message: "Use your @vitstudent.ac.in email",
          });
        }

        const token = createSession({
          role: "student",
          name,
          email,
        });

        return sendJson(res, 200, {
          message: "Student login successful.",
          token,
          role: "student",
          name,
          redirectTo: "/student.html",
        });
      }

      if (role === "admin") {
        const username = cleanText(body.username, 80);
        const password = cleanText(body.password, 80);

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
          return sendJson(res, 401, { message: "Invalid admin credentials." });
        }

        const token = createSession({
          role: "admin",
          name: "Placement Admin",
          username,
        });

        return sendJson(res, 200, {
          message: "Admin login successful.",
          token,
          role: "admin",
          name: "Placement Admin",
          redirectTo: "/admin.html",
        });
      }

      return sendJson(res, 400, { message: "Select a valid role." });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  if (req.method === "GET" && pathname === "/api/session") {
    const session = requireSession(req, res);
    if (!session) return;

    return sendJson(res, 200, {
      role: session.data.role,
      name: session.data.name,
      email: session.data.email || "",
    });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = getTokenFromRequest(req);
    if (token) sessions.delete(token);
    return sendJson(res, 200, { message: "Logged out." });
  }

  if (req.method === "GET" && pathname === "/api/jobs") {
    const jobs = await readJobs();
    return sendJson(res, 200, jobs);
  }

  if (req.method === "GET" && pathname === "/api/stats") {
    const stats = await readStats();
    return sendJson(res, 200, stats);
  }

  if (req.method === "POST" && pathname === "/api/requests") {
    const session = requireSession(req, res, "student");
    if (!session) return;

    try {
      const body = await parseBody(req);
      const message = cleanText(body.message, 500);

      if (!message) {
        return sendJson(res, 400, { message: "Message is required." });
      }

      const requests = await readRequests();
      const newRequest = {
        id: Date.now(),
        name: session.data.name,
        email: session.data.email,
        role: "student",
        message,
        status: "Pending",
        createdAt: new Date().toISOString(),
      };

      requests.push(newRequest);
      await writeRequests(requests);

      return sendJson(res, 201, {
        message: "Support request submitted.",
        request: newRequest,
      });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  if (req.method === "POST" && pathname === "/api/applications") {
    const session = requireSession(req, res, "student");
    if (!session) return;

    try {
      const body = await parseBody(req);
      const jobId = Number(body.jobId);
      const resumeUrl = cleanUrl(body.resumeUrl);
      const note = cleanText(body.note, 500);

      if (!jobId || !resumeUrl || !note) {
        return sendJson(res, 400, {
          message: "Job, resume link, and note are required.",
        });
      }

      const jobs = await readJobs();
      const job = jobs.find((item) => item.id === jobId);

      if (!job) {
        return sendJson(res, 404, { message: "Job not found." });
      }

      const applications = await readApplications();
      const exists = applications.some((item) => {
        return item.jobId === jobId && item.studentEmail === session.data.email;
      });

      if (exists) {
        return sendJson(res, 400, { message: "You already applied to this job." });
      }

      const newApplication = {
        id: Date.now(),
        jobId,
        studentName: session.data.name,
        studentEmail: session.data.email,
        jobTitle: job.title,
        company: job.company,
        resumeUrl,
        note,
        status: "Pending",
        appliedAt: new Date().toISOString(),
      };

      applications.push(newApplication);
      await writeApplications(applications);

      return sendJson(res, 201, {
        message: "Application submitted.",
        application: newApplication,
      });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  if (req.method === "GET" && pathname === "/api/student/applications") {
    const session = requireSession(req, res, "student");
    if (!session) return;

    const applications = await readApplications();
    const jobs = await readJobs();
    const studentApplications = applications
      .filter((item) => item.studentEmail === session.data.email)
      .map((item) => {
        const job = jobs.find((jobItem) => jobItem.id === item.jobId);
        return {
          ...item,
          location: job ? job.location : "",
          type: job ? job.type : "",
          mode: job ? job.mode : "",
          packageLabel: job ? job.packageLabel : "",
        };
      });

    return sendJson(res, 200, studentApplications);
  }

  if (req.method === "GET" && pathname === "/api/student/requests") {
    const session = requireSession(req, res, "student");
    if (!session) return;

      const requests = await readRequests();
      const studentRequests = requests.filter((item) => item.email === session.data.email);
      return sendJson(res, 200, studentRequests);
  }

  if (req.method === "GET" && pathname === "/api/admin/requests") {
    const session = requireSession(req, res, "admin");
    if (!session) return;

    const requests = await readRequests();
    return sendJson(res, 200, requests);
  }

  if (req.method === "GET" && pathname === "/api/admin/applications") {
    const session = requireSession(req, res, "admin");
    if (!session) return;

    const applications = await readApplications();
    return sendJson(res, 200, applications);
  }

  if (req.method === "POST" && pathname === "/api/admin/jobs") {
    const session = requireSession(req, res, "admin");
    if (!session) return;

    try {
      const body = await parseBody(req);
      const company = cleanText(body.company, 80);
      const title = cleanText(body.title, 80);
      const type = cleanText(body.type, 30);
      const location = cleanText(body.location, 60);
      const mode = cleanText(body.mode, 30);
      const packageLabel = cleanText(body.packageLabel, 60);
      const compensation = Number(body.compensation);
      const department = cleanKey(body.department);
      const description = cleanText(body.description, 240);

      if (
        !company ||
        !title ||
        !type ||
        !location ||
        !mode ||
        !packageLabel ||
        !description ||
        !VALID_ROLES.has(department) ||
        !Number.isFinite(compensation) ||
        compensation <= 0
      ) {
        return sendJson(res, 400, { message: "Fill all job fields correctly." });
      }

      const jobs = await readJobs();
      const newJob = {
        id: Date.now(),
        company,
        title,
        type,
        location,
        mode,
        packageLabel,
        compensation,
        roles: [department],
        description,
        postedAt: new Date().toISOString(),
      };

      jobs.push(newJob);
      await writeJobs(jobs);

      return sendJson(res, 201, {
        message: "Job added successfully.",
        job: newJob,
      });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  if (req.method === "PATCH" && requestStatusMatch) {
    const session = requireSession(req, res, "admin");
    if (!session) return;

    try {
      const requestId = Number(requestStatusMatch[1]);
      const body = await parseBody(req);
      const status = cleanText(body.status, 20);

      if (!isValidStatus(status)) {
        return sendJson(res, 400, { message: "Invalid status." });
      }

      const requests = await readRequests();
      const updatedRequests = requests.map((item) => {
        return item.id === requestId ? { ...item, status } : item;
      });

      const updatedRequest = updatedRequests.find((item) => item.id === requestId);
      if (!updatedRequest) {
        return sendJson(res, 404, { message: "Request not found." });
      }

      await writeRequests(updatedRequests);
      return sendJson(res, 200, {
        message: "Request status updated.",
        request: updatedRequest,
      });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  if (req.method === "PATCH" && applicationStatusMatch) {
    const session = requireSession(req, res, "admin");
    if (!session) return;

    try {
      const applicationId = Number(applicationStatusMatch[1]);
      const body = await parseBody(req);
      const status = cleanText(body.status, 20);

      if (!isValidStatus(status)) {
        return sendJson(res, 400, { message: "Invalid status." });
      }

      const applications = await readApplications();
      const updatedApplications = applications.map((item) => {
        return item.id === applicationId ? { ...item, status } : item;
      });

      const updatedApplication = updatedApplications.find((item) => item.id === applicationId);
      if (!updatedApplication) {
        return sendJson(res, 404, { message: "Application not found." });
      }

      await writeApplications(updatedApplications);
      return sendJson(res, 200, {
        message: "Application status updated.",
        application: updatedApplication,
      });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  return sendJson(res, 404, { message: "API route not found." });
}

async function handleStatic(res, pathname) {
  const fileName = STATIC_FILES[pathname];

  if (!fileName) {
    sendText(res, 404, "Page not found.");
    return;
  }

  try {
    const filePath = path.join(ROOT_DIR, fileName);
    const content = await readFile(filePath);
    const extension = path.extname(fileName);

    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
    });
    res.end(content);
  } catch (error) {
    sendText(res, 500, "Unable to load file.");
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith("/api/")) {
    await handleApi(req, res, pathname);
    return;
  }

  await handleStatic(res, pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Campus Connect server running on http://127.0.0.1:${PORT}`);
});
