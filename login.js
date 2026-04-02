const roleButtons = document.querySelectorAll(".role-btn");
const studentLoginForm = document.getElementById("studentLoginForm");
const adminLoginForm = document.getElementById("adminLoginForm");
const loginMessage = document.getElementById("loginMessage");
const studentEmailInput = studentLoginForm?.querySelector('input[name="email"]');
const studentEmailRegex = /^[^\s@]+@vitstudent\.ac\.in$/i;

function saveSession(data) {
  localStorage.setItem("campusConnectToken", data.token);
  localStorage.setItem("campusConnectRole", data.role);
  localStorage.setItem("campusConnectName", data.name);
}

function clearSession() {
  localStorage.removeItem("campusConnectToken");
  localStorage.removeItem("campusConnectRole");
  localStorage.removeItem("campusConnectName");
}

async function redirectIfSessionExists() {
  const token = localStorage.getItem("campusConnectToken");
  const role = localStorage.getItem("campusConnectRole");

  if (!token || !role) return;

  try {
    const response = await fetch("/api/session", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Invalid session");

    window.location.href = role === "admin" ? "/admin.html" : "/student.html";
  } catch (error) {
    clearSession();
  }
}

function setRole(role) {
  roleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.role === role);
  });

  studentLoginForm.classList.toggle("hidden", role !== "student");
  adminLoginForm.classList.toggle("hidden", role !== "admin");
  loginMessage.textContent = "";
}

async function handleLogin(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  loginMessage.textContent = "Signing in...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.message || "Login failed.");

    saveSession(result);
    window.location.href = result.redirectTo;
  } catch (error) {
    loginMessage.textContent = error.message;
  }
}

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setRole(button.dataset.role);
  });
});

if (studentLoginForm) {
  studentLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (studentEmailInput) {
      const isValid = studentEmailRegex.test(studentEmailInput.value.trim());
      studentEmailInput.setCustomValidity(
        studentEmailInput.value && !isValid
          ? "Use your @vitstudent.ac.in email"
          : ""
      );
    }

    if (!studentLoginForm.checkValidity()) {
      loginMessage.textContent =
        studentEmailInput &&
        studentEmailInput.validationMessage === "Use your @vitstudent.ac.in email"
          ? "Use your @vitstudent.ac.in email"
          : "Please fill all fields.";
      studentLoginForm.reportValidity();
      return;
    }

    await handleLogin(studentLoginForm);
  });
}

if (studentEmailInput) {
  studentEmailInput.addEventListener("input", () => {
    const isValid = studentEmailRegex.test(studentEmailInput.value.trim());
    studentEmailInput.setCustomValidity(
      studentEmailInput.value && !isValid
        ? "Use your @vitstudent.ac.in email"
        : ""
    );
  });
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!adminLoginForm.checkValidity()) {
      loginMessage.textContent = "Please fill all fields.";
      adminLoginForm.reportValidity();
      return;
    }

    await handleLogin(adminLoginForm);
  });
}

redirectIfSessionExists();
