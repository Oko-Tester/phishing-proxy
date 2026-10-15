"use strict";

const $ = (selector) => document.querySelector(selector);
const loginView = $("#login-view");
const workspaceView = $("#workspace-view");
const form = $("#login-form");
const email = $("#email");
const password = $("#password");
const submit = $("#login-submit");
const errorMessage = $("#form-error");
const helpDialog = $("#help-dialog");
let toastTimer;

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(
      body.error || "Die Anfrage konnte nicht verarbeitet werden.",
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

function toast(message) {
  clearTimeout(toastTimer);
  $("#toast span").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3500);
}

function showLogin() {
  workspaceView.hidden = true;
  loginView.hidden = false;
  password.value = "";
  password.type = "password";
  $("#toggle-password").setAttribute("aria-pressed", "false");
  $("#toggle-password").setAttribute("aria-label", "Passwort anzeigen");
  document.title = "Norda — Anmelden";
}

function fillDemo() {
  email.value = "alex@norda.test";
  password.value = "Norda-Demo!2026";
  clearError();
  submit.focus();
  toast("Demo-Zugang eingetragen. Du kannst dich jetzt anmelden.");
}

function clearError() {
  errorMessage.hidden = true;
  email.removeAttribute("aria-invalid");
  password.removeAttribute("aria-invalid");
}

function showError(message, field) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderProjects(projects) {
  const rows = $("#project-rows");
  rows.replaceChildren();
  projects.forEach((project) => {
    const row = element("tr");
    const nameCell = element("td");
    const name = element("div", "project-name");
    name.append(
      element("span", `project-initials ${project.color}`, project.initials),
    );
    const description = element("div");
    description.append(
      element("strong", "", project.name),
      element("small", "", project.category),
    );
    name.append(description);
    nameCell.append(name);
    const statusCell = element("td");
    statusCell.append(
      element(
        "span",
        `status-badge${project.progress === 100 ? " complete" : ""}`,
        project.status,
      ),
    );
    const progressCell = element("td");
    const progress = element("div", "progress-wrap");
    const track = element("progress", "native-progress");
    track.max = 100;
    track.value = project.progress;
    track.setAttribute("aria-label", `Fortschritt ${project.name}`);
    progress.append(track, element("span", "", `${project.progress}%`));
    progressCell.append(progress);
    const teamCell = element("td");
    const team = element("div", "team");
    project.members.forEach((member) =>
      team.append(element("span", "", member)),
    );
    teamCell.append(team);
    row.append(
      nameCell,
      statusCell,
      progressCell,
      teamCell,
      element("td", "", project.date),
    );
    rows.append(row);
  });
  const count = (value) => String(value).padStart(2, "0");
  function stat(id, value, caption) {
    $(id).replaceChildren(
      document.createTextNode(count(value)),
      element("span", "", caption),
    );
  }
  stat("#total-projects", projects.length, "im Workspace");
  stat(
    "#active-projects",
    projects.filter((project) => project.progress < 100).length,
    "in Bewegung",
  );
  stat(
    "#done-projects",
    projects.filter((project) => project.progress === 100).length,
    "gut gemacht",
  );
  $("#project-count").textContent = projects.length;
}

async function loadProjects() {
  const result = await api("/api/projects");
  renderProjects(result.projects);
  $("#sync-status").textContent =
    `Aktualisiert um ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
}

async function showWorkspace(user) {
  document.querySelectorAll("[data-user-name]").forEach((node) => {
    node.textContent = user.name;
  });
  document.querySelectorAll("[data-user-email]").forEach((node) => {
    node.textContent = user.email;
  });
  document.querySelectorAll("[data-initials]").forEach((node) => {
    node.textContent = user.initials;
  });
  $("#first-name").textContent = user.name.split(" ")[0];
  await loadProjects();
  loginView.hidden = true;
  workspaceView.hidden = false;
  document.title = "Norda — Dein Workspace";
  window.scrollTo(0, 0);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  email.value = email.value.trim();
  if (!email.value || !email.validity.valid)
    return showError("Bitte gib eine gültige E-Mail-Adresse ein.", email);
  if (!password.value)
    return showError("Bitte gib dein Passwort ein.", password);
  submit.disabled = true;
  submit.querySelector("span").textContent = "Wird angemeldet …";
  form.setAttribute("aria-busy", "true");
  try {
    const { user } = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
        remember: $("#remember").checked,
      }),
    });
    password.value = "";
    await showWorkspace(user);
    $(".workspace-content h1").setAttribute("tabindex", "-1");
    $(".workspace-content h1").focus({ preventScroll: true });
    toast(`Willkommen zurück, ${user.name.split(" ")[0]}.`);
  } catch (error) {
    showError(
      error.status
        ? error.message
        : "Der Workspace ist gerade nicht erreichbar. Bitte versuche es erneut.",
    );
  } finally {
    submit.disabled = false;
    submit.querySelector("span").textContent = "Anmelden";
    form.removeAttribute("aria-busy");
  }
});

$("#toggle-password").addEventListener("click", () => {
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  $("#toggle-password").setAttribute("aria-pressed", String(visible));
  $("#toggle-password").setAttribute(
    "aria-label",
    visible ? "Passwort verbergen" : "Passwort anzeigen",
  );
});
email.addEventListener("input", clearError);
password.addEventListener("input", clearError);
$("#fill-demo").addEventListener("click", fillDemo);
document
  .querySelectorAll("[data-open-help]")
  .forEach((button) =>
    button.addEventListener("click", () => helpDialog.showModal()),
  );
$("#close-help").addEventListener("click", () => helpDialog.close());
$("#help-fill-demo").addEventListener("click", () => {
  helpDialog.close();
  fillDemo();
});
helpDialog.addEventListener("click", (event) => {
  const bounds = helpDialog.getBoundingClientRect();
  if (
    event.target === helpDialog &&
    (event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom)
  )
    helpDialog.close();
});

$("#refresh").addEventListener("click", async () => {
  $("#refresh").disabled = true;
  $("#sync-status").textContent = "Wird aktualisiert …";
  try {
    await loadProjects();
    toast("Dein Workspace ist auf dem neuesten Stand.");
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      email.focus();
    }
    $("#sync-status").textContent = "Aktualisierung fehlgeschlagen";
    toast(
      error.status === 401
        ? "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an."
        : "Aktualisierung fehlgeschlagen. Bitte erneut versuchen.",
    );
  } finally {
    $("#refresh").disabled = false;
  }
});

$("#logout").addEventListener("click", async () => {
  $("#logout").disabled = true;
  try {
    await api("/api/logout", { method: "POST" });
    showLogin();
    email.focus();
    toast("Du wurdest abgemeldet. Bis bald!");
  } catch {
    toast("Abmelden fehlgeschlagen. Bitte erneut versuchen.");
  } finally {
    $("#logout").disabled = false;
  }
});

api("/api/session")
  .then(({ user }) => showWorkspace(user))
  .catch((error) => {
    showLogin();
    if (error.status !== 401)
      showError(
        "Der Workspace ist gerade nicht erreichbar. Bitte versuche es erneut.",
      );
  });
