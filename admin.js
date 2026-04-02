const adminName = document.getElementById("adminName");
const adminSummary = document.getElementById("adminSummary");
const chartGrid = document.getElementById("chartGrid");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const addJobForm = document.getElementById("addJobForm");
const jobFormMessage = document.getElementById("jobFormMessage");
const adminJobsBoard = document.getElementById("adminJobsBoard");
const requestsTableWrap = document.getElementById("requestsTableWrap");
const applicationsTableWrap = document.getElementById("applicationsTableWrap");
const requestSearch = document.getElementById("requestSearch");
const requestFilter = document.getElementById("requestFilter");
const requestSort = document.getElementById("requestSort");
const applicationSearch = document.getElementById("applicationSearch");
const applicationFilter = document.getElementById("applicationFilter");
const applicationSort = document.getElementById("applicationSort");

let jobs = [];
let requests = [];
let applications = [];

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

async function ensureAdminSession() {
  const response = await fetchWithAuth("/api/session");

  if (!response.ok) {
    localStorage.clear();
    window.location.href = "/";
    return null;
  }

  const session = await response.json();

  if (session.role !== "admin") {
    localStorage.clear();
    window.location.href = "/";
    return null;
  }

  adminName.textContent = session.name;
  return session;
}

function sortByRule(items, rule, dateKey) {
  const sorted = [...items];

  if (rule === "oldest") {
    sorted.sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
  } else if (rule === "status") {
    sorted.sort((a, b) => a.status.localeCompare(b.status));
  } else {
    sorted.sort((a, b) => new Date(b[dateKey]) - new Date(a[dateKey]));
  }

  return sorted;
}

function getFilteredRequests() {
  const search = (requestSearch?.value || "").trim().toLowerCase();
  const status = requestFilter?.value || "all";
  const sort = requestSort?.value || "newest";

  const filtered = requests.filter((item) => {
    const haystack = `${item.name} ${item.email} ${item.message}`.toLowerCase();
    const matchesSearch = haystack.includes(search);
    const matchesStatus = status === "all" || item.status === status;
    return matchesSearch && matchesStatus;
  });

  return sortByRule(filtered, sort, "createdAt");
}

function getFilteredApplications() {
  const search = (applicationSearch?.value || "").trim().toLowerCase();
  const status = applicationFilter?.value || "all";
  const sort = applicationSort?.value || "newest";

  const filtered = applications.filter((item) => {
    const haystack = `${item.studentName} ${item.studentEmail} ${item.jobTitle} ${item.company} ${item.note}`.toLowerCase();
    const matchesSearch = haystack.includes(search);
    const matchesStatus = status === "all" || item.status === status;
    return matchesSearch && matchesStatus;
  });

  return sortByRule(filtered, sort, "appliedAt");
}

function renderSummary() {
  const uniqueStudents = new Set([
    ...requests.map((item) => item.email.toLowerCase()),
    ...applications.map((item) => item.studentEmail.toLowerCase()),
  ]).size;

  adminSummary.innerHTML = `
    <article class="summary-card">
      <h3>${jobs.length}</h3>
      <p>Live jobs</p>
    </article>
    <article class="summary-card">
      <h3>${requests.length}</h3>
      <p>Support requests</p>
    </article>
    <article class="summary-card">
      <h3>${applications.length}</h3>
      <p>Applications</p>
    </article>
    <article class="summary-card">
      <h3>${uniqueStudents}</h3>
      <p>Active students</p>
    </article>
  `;
}

function buildChartBars(items) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return items
    .map((item) => {
      const width = `${(item.value / max) * 100}%`;
      return `
        <div class="chart-row">
          <div class="chart-labels">
            <span>${escapeHtml(item.label)}</span>
            <strong>${item.value}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCharts() {
  const requestStatus = {
    Pending: requests.filter((item) => item.status === "Pending").length,
    Approved: requests.filter((item) => item.status === "Approved").length,
    Rejected: requests.filter((item) => item.status === "Rejected").length,
  };

  const applicationStatus = {
    Pending: applications.filter((item) => item.status === "Pending").length,
    Approved: applications.filter((item) => item.status === "Approved").length,
    Rejected: applications.filter((item) => item.status === "Rejected").length,
  };

  chartGrid.innerHTML = `
    <article class="chart-card">
      <p class="label">Platform Totals</p>
      <h3>Jobs vs requests vs applications</h3>
      ${buildChartBars([
        { label: "Jobs", value: jobs.length },
        { label: "Requests", value: requests.length },
        { label: "Applications", value: applications.length },
      ])}
    </article>
    <article class="chart-card">
      <p class="label">Request Status</p>
      <h3>Support pipeline</h3>
      ${buildChartBars([
        { label: "Pending", value: requestStatus.Pending },
        { label: "Approved", value: requestStatus.Approved },
        { label: "Rejected", value: requestStatus.Rejected },
      ])}
    </article>
    <article class="chart-card">
      <p class="label">Application Status</p>
      <h3>Hiring pipeline</h3>
      ${buildChartBars([
        { label: "Pending", value: applicationStatus.Pending },
        { label: "Approved", value: applicationStatus.Approved },
        { label: "Rejected", value: applicationStatus.Rejected },
      ])}
    </article>
  `;
}

function renderJobsBoard() {
  if (!adminJobsBoard) return;

  if (!jobs.length) {
    adminJobsBoard.innerHTML = '<p class="empty-state">No jobs available.</p>';
    return;
  }

  adminJobsBoard.innerHTML = jobs
    .slice(0, 6)
    .map((job) => {
      return `
        <article class="mini-job-card">
          <p class="company-name">${escapeHtml(job.company)}</p>
          <h3>${escapeHtml(job.title)}</h3>
          <p class="job-meta">${escapeHtml(job.location)} | ${escapeHtml(job.mode)}</p>
          <div class="badge-row">
            <span class="soft-badge">${escapeHtml(job.type)}</span>
            <span class="soft-badge">${escapeHtml(job.roles.join(" / ").toUpperCase())}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRequestsTable() {
  const filteredRequests = getFilteredRequests();

  if (!filteredRequests.length) {
    requestsTableWrap.innerHTML = '<p class="empty-state">No requests match the current filters.</p>';
    return;
  }

  requestsTableWrap.innerHTML = `
    <div class="table-scroll">
      <table class="request-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Email</th>
            <th>Message</th>
            <th>Status</th>
            <th>Actions</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRequests
            .map((item) => {
              return `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.email)}</td>
                  <td>${escapeHtml(item.message)}</td>
                  <td>
                    <span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
                  </td>
                  <td>
                    <div class="action-group">
                      <button class="action-btn approve-btn" data-kind="request" data-id="${item.id}" data-status="Approved" type="button" ${item.status === "Approved" ? "disabled" : ""}>
                        Approve
                      </button>
                      <button class="action-btn reject-btn" data-kind="request" data-id="${item.id}" data-status="Rejected" type="button" ${item.status === "Rejected" ? "disabled" : ""}>
                        Reject
                      </button>
                    </div>
                  </td>
                  <td>${escapeHtml(formatDate(item.createdAt))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderApplicationsTable() {
  const filteredApplications = getFilteredApplications();

  if (!filteredApplications.length) {
    applicationsTableWrap.innerHTML = '<p class="empty-state">No applications match the current filters.</p>';
    return;
  }

  applicationsTableWrap.innerHTML = `
    <div class="table-scroll">
      <table class="request-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Job</th>
            <th>Resume</th>
            <th>Note</th>
            <th>Status</th>
            <th>Actions</th>
            <th>Applied</th>
          </tr>
        </thead>
        <tbody>
          ${filteredApplications
            .map((item) => {
              return `
                <tr>
                  <td>${escapeHtml(item.studentName)}<br><span class="table-subtext">${escapeHtml(item.studentEmail)}</span></td>
                  <td>${escapeHtml(item.jobTitle)}<br><span class="table-subtext">${escapeHtml(item.company)}</span></td>
                  <td><a class="text-link" href="${escapeHtml(item.resumeUrl)}" target="_blank" rel="noreferrer">Open link</a></td>
                  <td>${escapeHtml(item.note)}</td>
                  <td>
                    <span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
                  </td>
                  <td>
                    <div class="action-group">
                      <button class="action-btn approve-btn" data-kind="application" data-id="${item.id}" data-status="Approved" type="button" ${item.status === "Approved" ? "disabled" : ""}>
                        Approve
                      </button>
                      <button class="action-btn reject-btn" data-kind="application" data-id="${item.id}" data-status="Rejected" type="button" ${item.status === "Rejected" ? "disabled" : ""}>
                        Reject
                      </button>
                    </div>
                  </td>
                  <td>${escapeHtml(formatDate(item.appliedAt))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function rerenderDashboard() {
  renderSummary();
  renderCharts();
  renderJobsBoard();
  renderRequestsTable();
  renderApplicationsTable();
}

async function loadJobs() {
  const response = await fetch("/api/jobs");
  if (!response.ok) throw new Error("Unable to load jobs.");
  jobs = await response.json();
}

async function loadRequests() {
  const response = await fetchWithAuth("/api/admin/requests");
  if (!response.ok) throw new Error("Unable to load requests.");
  requests = await response.json();
}

async function loadApplications() {
  const response = await fetchWithAuth("/api/admin/applications");
  if (!response.ok) throw new Error("Unable to load applications.");
  applications = await response.json();
}

async function updateStatus(kind, id, status) {
  const endpoint =
    kind === "request"
      ? `/api/admin/requests/${id}`
      : `/api/admin/applications/${id}`;

  const response = await fetchWithAuth(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Unable to update status.");

  if (kind === "request") {
    requests = requests.map((item) => {
      return item.id === Number(id) ? { ...item, status } : item;
    });
  } else {
    applications = applications.map((item) => {
      return item.id === Number(id) ? { ...item, status } : item;
    });
  }

  rerenderDashboard();
}

async function handleActionClick(event) {
  const button = event.target.closest(".action-btn");
  if (!button) return;

  button.disabled = true;
  try {
    await updateStatus(button.dataset.kind, button.dataset.id, button.dataset.status);
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
}

if (requestsTableWrap) {
  requestsTableWrap.addEventListener("click", handleActionClick);
}

if (applicationsTableWrap) {
  applicationsTableWrap.addEventListener("click", handleActionClick);
}

[requestSearch, requestFilter, requestSort].forEach((element) => {
  if (!element) return;
  element.addEventListener("input", renderRequestsTable);
  element.addEventListener("change", renderRequestsTable);
});

[applicationSearch, applicationFilter, applicationSort].forEach((element) => {
  if (!element) return;
  element.addEventListener("input", renderApplicationsTable);
  element.addEventListener("change", renderApplicationsTable);
});

if (addJobForm && jobFormMessage) {
  addJobForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!addJobForm.checkValidity()) {
      jobFormMessage.textContent = "Fill all job fields.";
      addJobForm.reportValidity();
      return;
    }

    const submitButton = addJobForm.querySelector("button");
    const payload = Object.fromEntries(new FormData(addJobForm).entries());

    jobFormMessage.textContent = "Adding job...";
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetchWithAuth("/api/admin/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to add job.");

      jobs = [result.job, ...jobs];
      addJobForm.reset();
      jobFormMessage.textContent = result.message;
      rerenderDashboard();
    } catch (error) {
      jobFormMessage.textContent = error.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", async () => {
    await fetchWithAuth("/api/logout", { method: "POST" });
    localStorage.clear();
    window.location.href = "/";
  });
}

ensureAdminSession().then(async (session) => {
  if (!session) return;

  try {
    await Promise.all([loadJobs(), loadRequests(), loadApplications()]);
    rerenderDashboard();
  } catch (error) {
    adminSummary.innerHTML = '<p class="empty-state">Unable to load dashboard.</p>';
  }
});
