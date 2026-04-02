const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const jobGrid = document.getElementById("jobGrid");
const jobSearch = document.getElementById("jobSearch");
const jobSort = document.getElementById("jobSort");
const jobCountText = document.getElementById("jobCountText");
const filterButtons = document.querySelectorAll(".filter");
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");
const year = document.getElementById("year");
const studentName = document.getElementById("studentName");
const studentEmailTag = document.getElementById("studentEmailTag");
const logoutBtn = document.getElementById("logoutBtn");
const backToTopBtn = document.getElementById("backToTopBtn");
const heroJobCount = document.getElementById("heroJobCount");
const heroApplicationCount = document.getElementById("heroApplicationCount");
const applicationStats = document.getElementById("applicationStats");
const myApplicationsGrid = document.getElementById("myApplicationsGrid");
const requestCountText = document.getElementById("requestCountText");
const studentRequestsGrid = document.getElementById("studentRequestsGrid");
const applyModal = document.getElementById("applyModal");
const applyForm = document.getElementById("applyForm");
const applyMessage = document.getElementById("applyMessage");
const applyJobId = document.getElementById("applyJobId");
const applyJobTitle = document.getElementById("applyJobTitle");
const applyJobMeta = document.getElementById("applyJobMeta");
const closeModalBtn = document.getElementById("closeModalBtn");

let jobs = [];
let applications = [];
let supportRequests = [];
let activeRole = "all";
let searchTerm = "";
let sortValue = "newest";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status) {
  return `status-${status.toLowerCase()}`;
}

function getToken() {
  return localStorage.getItem("campusConnectToken") || "";
}

async function fetchWithAuth(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${getToken()}`,
    },
  });
}

if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}

function sortJobs(items) {
  const sorted = [...items];

  if (sortValue === "compensation") {
    sorted.sort((a, b) => b.compensation - a.compensation);
  } else if (sortValue === "company") {
    sorted.sort((a, b) => a.company.localeCompare(b.company));
  } else {
    sorted.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }

  return sorted;
}

function getFilteredJobs() {
  const filtered = jobs.filter((job) => {
    const matchesRole = activeRole === "all" || job.roles.includes(activeRole);
    const haystack = `${job.title} ${job.company} ${job.location}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return sortJobs(filtered);
}

function renderJobs() {
  if (!jobGrid) return;

  const filteredJobs = getFilteredJobs();
  const appliedJobIds = new Set(applications.map((item) => item.jobId));

  if (jobCountText) {
    jobCountText.textContent = `${filteredJobs.length} jobs match your current search.`;
  }

  if (heroJobCount) {
    heroJobCount.textContent = String(jobs.length);
  }

  if (!filteredJobs.length) {
    jobGrid.innerHTML = '<p class="empty-state">No jobs found for this search.</p>';
    return;
  }

  jobGrid.innerHTML = filteredJobs
    .map((job) => {
      const applied = appliedJobIds.has(job.id);
      const roleTags = job.roles.map((role) => role.toUpperCase()).join(" / ");

      return `
        <article class="job-card">
          <div class="job-head">
            <div>
              <p class="company-name">${escapeHtml(job.company)}</p>
              <h3>${escapeHtml(job.title)}</h3>
            </div>
            <span class="chip">${escapeHtml(job.type)}</span>
          </div>
          <p class="job-meta">${escapeHtml(job.location)} | ${escapeHtml(job.mode)} | ${escapeHtml(job.packageLabel)}</p>
          <p class="job-desc">${escapeHtml(job.description)}</p>
          <div class="badge-row">
            <span class="soft-badge">${escapeHtml(roleTags)}</span>
            <span class="soft-badge">${formatDate(job.postedAt)}</span>
          </div>
          <div class="job-actions">
            <button class="btn apply-btn" type="button" data-job-id="${job.id}" ${applied ? "disabled" : ""}>
              ${applied ? "Applied" : "Apply Now"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderApplicationStats() {
  if (!applicationStats) return;

  const pending = applications.filter((item) => item.status === "Pending").length;
  const approved = applications.filter((item) => item.status === "Approved").length;
  const rejected = applications.filter((item) => item.status === "Rejected").length;

  if (heroApplicationCount) {
    heroApplicationCount.textContent = String(applications.length);
  }

  applicationStats.innerHTML = `
    <article class="metric-card">
      <h3>${applications.length}</h3>
      <p>Total applications</p>
    </article>
    <article class="metric-card">
      <h3>${pending}</h3>
      <p>Pending review</p>
    </article>
    <article class="metric-card">
      <h3>${approved}</h3>
      <p>Approved</p>
    </article>
    <article class="metric-card">
      <h3>${rejected}</h3>
      <p>Rejected</p>
    </article>
  `;
}

function renderApplications() {
  if (!myApplicationsGrid) return;

  renderApplicationStats();

  if (!applications.length) {
    myApplicationsGrid.innerHTML = '<p class="empty-state">You have not applied to any job yet.</p>';
    return;
  }

  myApplicationsGrid.innerHTML = applications
    .map((application) => {
      return `
        <article class="application-card">
          <div class="application-head">
            <div>
              <p class="company-name">${escapeHtml(application.company)}</p>
              <h3>${escapeHtml(application.jobTitle)}</h3>
            </div>
            <span class="status-pill ${statusClass(application.status)}">${escapeHtml(application.status)}</span>
          </div>
          <p class="job-meta">${escapeHtml(application.location || "")} | ${escapeHtml(application.type || "")} | ${escapeHtml(application.packageLabel || "")}</p>
          <p class="status-line">Current status: <strong>${escapeHtml(application.status)}</strong></p>
          <p class="job-desc">${escapeHtml(application.note)}</p>
          <div class="application-footer">
            <a class="text-link" href="${escapeHtml(application.resumeUrl)}" target="_blank" rel="noreferrer">View resume</a>
            <span>${formatDate(application.appliedAt)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSupportRequests() {
  if (!studentRequestsGrid || !requestCountText) return;

  requestCountText.textContent = `${supportRequests.length} requests submitted`;

  if (!supportRequests.length) {
    studentRequestsGrid.innerHTML = '<p class="empty-state">No support requests yet.</p>';
    return;
  }

  studentRequestsGrid.innerHTML = supportRequests
    .map((request) => {
      return `
        <article class="request-card">
          <div class="application-head">
            <div>
              <p class="company-name">Placement Support</p>
              <h3>${escapeHtml(request.message)}</h3>
            </div>
            <span class="status-pill ${statusClass(request.status)}">${escapeHtml(request.status)}</span>
          </div>
          <p class="status-line">Current status: <strong>${escapeHtml(request.status)}</strong></p>
          <p class="job-meta">${formatDate(request.createdAt)}</p>
        </article>
      `;
    })
    .join("");
}

async function loadJobs() {
  if (!jobGrid) return;

  try {
    const response = await fetch("/api/jobs");
    if (!response.ok) throw new Error("Failed to load jobs");
    jobs = await response.json();
    renderJobs();
  } catch (error) {
    jobGrid.innerHTML = '<p class="empty-state">Unable to load jobs.</p>';
  }
}

async function loadApplications() {
  if (!myApplicationsGrid) return;

  try {
    const response = await fetchWithAuth("/api/student/applications");
    if (!response.ok) throw new Error("Failed to load applications");
    applications = await response.json();
    renderApplications();
    renderJobs();
  } catch (error) {
    myApplicationsGrid.innerHTML = '<p class="empty-state">Unable to load applications.</p>';
  }
}

async function loadSupportRequests() {
  if (!studentRequestsGrid) return;

  try {
    const response = await fetchWithAuth("/api/student/requests");
    if (!response.ok) throw new Error("Failed to load support requests");
    supportRequests = await response.json();
    renderSupportRequests();
  } catch (error) {
    studentRequestsGrid.innerHTML = '<p class="empty-state">Unable to load support requests.</p>';
  }
}

async function ensureStudentSession() {
  const response = await fetchWithAuth("/api/session");

  if (!response.ok) {
    localStorage.clear();
    window.location.href = "/";
    return null;
  }

  const session = await response.json();

  if (session.role !== "student") {
    localStorage.clear();
    window.location.href = "/";
    return null;
  }

  if (studentName) {
    studentName.textContent = session.name;
  }

  if (studentEmailTag) {
    studentEmailTag.textContent = session.email;
  }

  if (contactForm) {
    const nameField = contactForm.querySelector('input[name="name"]');
    const emailField = contactForm.querySelector('input[name="email"]');

    if (nameField) {
      nameField.value = session.name;
      nameField.readOnly = true;
    }

    if (emailField) {
      emailField.value = session.email;
      emailField.readOnly = true;
    }
  }

  return session;
}

function openApplyModal(jobId) {
  const job = jobs.find((item) => item.id === Number(jobId));
  if (!job || !applyModal || !applyForm) return;

  applyJobId.value = String(job.id);
  applyJobTitle.textContent = `${job.title} - ${job.company}`;
  applyJobMeta.textContent = `${job.location} | ${job.mode} | ${job.packageLabel}`;
  applyMessage.textContent = "";
  applyForm.reset();
  applyJobId.value = String(job.id);
  applyModal.classList.remove("hidden");
}

function closeApplyModal() {
  if (!applyModal) return;
  applyModal.classList.add("hidden");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeRole = button.dataset.role;
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderJobs();
  });
});

if (jobSearch) {
  jobSearch.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim();
    renderJobs();
  });
}

if (jobSort) {
  jobSort.addEventListener("change", (event) => {
    sortValue = event.target.value;
    renderJobs();
  });
}

if (jobGrid) {
  jobGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".apply-btn");
    if (!button) return;
    openApplyModal(button.dataset.jobId);
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", closeApplyModal);
}

if (applyModal) {
  applyModal.addEventListener("click", (event) => {
    if (event.target === applyModal) closeApplyModal();
  });
}

if (applyForm && applyMessage) {
  applyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!applyForm.checkValidity()) {
      applyMessage.textContent = "Fill all fields.";
      applyForm.reportValidity();
      return;
    }

    const submitButton = applyForm.querySelector("button");
    const formData = new FormData(applyForm);
    const payload = Object.fromEntries(formData.entries());

    applyMessage.textContent = "Submitting application...";
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetchWithAuth("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to submit application.");

      applyMessage.textContent = result.message;
      await loadApplications();
      window.setTimeout(closeApplyModal, 800);
    } catch (error) {
      applyMessage.textContent = error.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (contactForm && formMessage) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!contactForm.checkValidity()) {
      formMessage.textContent = "Please fill all fields.";
      contactForm.reportValidity();
      return;
    }

    const submitButton = contactForm.querySelector("button");
    const payload = {
      message: contactForm.querySelector('textarea[name="message"]').value.trim(),
    };

    formMessage.textContent = "Submitting...";
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetchWithAuth("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Submission failed");

      formMessage.textContent = result.message;
      contactForm.querySelector('textarea[name="message"]').value = "";
      await loadSupportRequests();
    } catch (error) {
      formMessage.textContent = error.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetchWithAuth("/api/logout", { method: "POST" });
    localStorage.clear();
    window.location.href = "/";
  });
}

if (backToTopBtn) {
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

if (year) {
  year.textContent = new Date().getFullYear();
}

ensureStudentSession().then(async (session) => {
  if (!session) return;

  await Promise.all([loadJobs(), loadApplications(), loadSupportRequests()]);

  const refreshStudentData = () => {
    loadJobs();
    loadApplications();
    loadSupportRequests();
  };

  window.setInterval(refreshStudentData, 5000);
  window.addEventListener("focus", refreshStudentData);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshStudentData();
    }
  });
});
