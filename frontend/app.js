const $ = id => document.getElementById(id);
let token = localStorage.getItem("token"), Q, ans = {}, step = 0, hist = [];
const LV = [[75, "Consolidado", "#059669"], [50, "Avanzado", "#0284c7"], [25, "En desarrollo", "#f59e0b"], [0, "Inicial", "#ef4444"]];
const lvl = v => LV.find(l => v >= l[0]);
const TIPS = {
  "Perspectiva económica": "Registra ingresos y gastos cada semana, crea un fondo para imprevistos y define metas de crecimiento a 3-5 años.",
  "Perspectiva social": "Formaliza condiciones de trabajo seguras, documenta los derechos de tus trabajadores y fomenta la igualdad de oportunidades.",
  "Perspectiva medioambiental": "Empieza por separar residuos, medir tu consumo de agua y energía y sustituir envases contaminantes.",
  "Perspectiva de gobernanza": "Define reglas claras de decisión, lleva registros transparentes y verifica el cumplimiento de leyes laborales, tributarias y ambientales."
};
const msg = (t, ok) => { const m = $("msg"); m.textContent = t; m.className = t ? (ok ? "ok" : "err") : ""; if (t) setTimeout(() => { m.textContent = ""; }, 6000); };

async function api(path, method = "GET", body) {
  let r;
  try {
    r = await fetch(API_URL + path, { method, body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) } });
  } catch { throw new Error("No se pudo conectar con el servidor. ¿El backend está encendido?"); }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) clearSession();
  if (!r.ok) throw new Error(data.error || "Error " + r.status);
  return data;
}
const guard = fn => async () => { try { msg(""); await fn(); } catch (e) { msg(e.message); } };
function clearSession() { token = null; ans = {}; step = 0; hist = []; localStorage.removeItem("token"); show(false); }
function show(on) { $("auth").hidden = on; $("app").hidden = !on; $("nav").hidden = !on; $("user").hidden = !on; }
function tab(n) {
  document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "tab-" + n);
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === n));
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => tab(b.dataset.tab));
$("go-diag").onclick = () => tab("diag");
$("t-login").onclick = () => { $("f-login").hidden = false; $("f-reg").hidden = true; $("t-login").className = "on"; $("t-reg").className = ""; };
$("t-reg").onclick = () => { $("f-login").hidden = true; $("f-reg").hidden = false; $("t-reg").className = "on"; $("t-login").className = ""; };

function renderQuiz() {
  const names = Object.keys(Q.perspectives), name = names[step];
  let off = 0; names.slice(0, step).forEach(n => off += Q.perspectives[n].length);
  $("progress").style.width = ((step + 1) / names.length * 100) + "%";
  $("step-title").textContent = `${step + 1} de ${names.length} · ${name}`;
  $("quiz").innerHTML = Q.perspectives[name].map((q, j) => { const i = off + j;
    return `<div class="q"><p>${q}</p><div class="opts">` + Q.options.map((o, v) =>
      `<label><input type="radio" name="q${i}" data-i="${i}" value="${v}" ${ans[i] === v ? "checked" : ""}><span>${"ABCD"[v]}) ${o}</span></label>`).join("") + "</div></div>"; }).join("");
  $("prev").hidden = step === 0; $("next").hidden = step === names.length - 1; $("b-send").hidden = step !== names.length - 1;
}
$("quiz").onchange = e => { ans[+e.target.dataset.i] = +e.target.value; };
function stepComplete() {
  const names = Object.keys(Q.perspectives); let off = 0; names.slice(0, step).forEach(n => off += Q.perspectives[n].length);
  return Q.perspectives[names[step]].every((_, j) => ans[off + j] !== undefined);
}
$("next").onclick = () => { if (!stepComplete()) return msg("Responde todas las preguntas de esta sección."); step++; renderQuiz(); scrollTo(0, 0); };
$("prev").onclick = () => { step--; renderQuiz(); };

function radar(s) {
  const v = Object.values(s), n = v.length, R = 80;
  const pt = (k, r) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
  const poly = f => v.map((x, k) => pt(k, R * f(x)).join(",")).join(" ");
  const rings = [.25, .5, .75, 1].map(f => `<polygon points="${poly(() => f)}" fill="none" stroke="#d3d8ee"/>`).join("");
  const labels = Object.keys(s).map((nm, k) => { const [x, y] = pt(k, R + 14);
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#555">${nm.replace("Perspectiva ", "")}</text>`; }).join("");
  return `<svg viewBox="-20 -5 240 215">${rings}<polygon points="${poly(x => x / 100)}" fill="#6366f166" stroke="#4f46e5" stroke-width="2"/>${labels}</svg>`;
}
const fmt = d => new Date(d + "Z").toLocaleString();
function renderResults(i = 0) {
  if (!hist.length) { $("results").innerHTML = '<div class="card empty">Aún no hay diagnósticos. Completa el cuestionario en la pestaña <b>Diagnóstico</b>.</div>'; return; }
  const a = hist[i], p = hist[i + 1], L = lvl(a.total);
  const d = p ? `<br><span class="delta">${a.total >= p.total ? "▲" : "▼"} ${Math.abs(a.total - p.total).toFixed(1)} pts frente al diagnóstico anterior</span>` : "";
  $("results").innerHTML = `<div class="card top"><div class="ring" style="--p:${a.total};--c:${L[2]}"><b>${a.total}%</b></div>
    <div><h2>Nivel ${L[1]}</h2><span>${fmt(a.created_at)}</span>${d}</div><div class="radar">${radar(a.scores)}</div></div><div class="grid">` +
    Object.entries(a.scores).map(([k, v]) => { const l = lvl(v);
      return `<div class="card"><h3>${k}</h3><div class="bar"><i style="width:${v}%;background:${l[2]}"></i></div>
      <p><b>${v}%</b> · <span style="color:${l[2]};font-weight:700">${l[1]}</span></p>
      <p class="tip">${v >= 75 ? "¡Buen trabajo! Mantén y documenta estas prácticas." : TIPS[k]}</p></div>`; }).join("") +
    `</div><div class="card"><h3>Historial de diagnósticos</h3>` +
    hist.map((h, j) => `<button class="ghost ${j === i ? "cur" : ""}" data-j="${j}">${new Date(h.created_at + "Z").toLocaleDateString()} — ${h.total}%</button>`).join("") + "</div>";
}
$("results").onclick = e => { if (e.target.dataset.j !== undefined) renderResults(+e.target.dataset.j); };

async function enter() {
  show(true);
  const p = await api("/profile");
  $("who").textContent = p.company_name; $("p-desc").value = p.description || ""; $("p-vision").value = p.vision || ""; $("p-obj").value = p.objectives || "";
  Q = await api("/questions"); hist = await api("/assessments");
  renderQuiz(); renderResults(0); tab("empresa");
}
async function doLogin(email, password) {
  const d = await api("/login", "POST", { email, password });
  token = d.token; localStorage.setItem("token", token); await enter();
}
$("b-login").onclick = guard(() => doLogin($("l-email").value.trim(), $("l-pass").value));
$("b-reg").onclick = guard(async () => {
  const name = $("r-name").value.trim(), email = $("r-email").value.trim(), pass = $("r-pass").value;
  if (!name) throw new Error("Escribe el nombre de la empresa.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Ingresa un email válido, por ejemplo nombre@empresa.com");
  if (pass.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  await api("/register", "POST", { company_name: name, email, password: pass });
  await doLogin(email, pass); msg("¡Cuenta creada! Completa el perfil de tu empresa.", true);
});
$("logout").onclick = guard(async () => { await api("/logout", "POST"); clearSession(); });
$("b-prof").onclick = guard(async () => {
  await api("/profile", "PUT", { description: $("p-desc").value, vision: $("p-vision").value, objectives: $("p-obj").value });
  msg("Perfil guardado.", true);
});
$("b-send").onclick = guard(async () => {
  const total = Object.values(Q.perspectives).flat().length, answers = [];
  for (let i = 0; i < total; i++) {
    if (ans[i] === undefined) { step = Math.floor(i / 4); renderQuiz(); throw new Error("Faltan respuestas en esta sección."); }
    answers.push(ans[i]);
  }
  await api("/assessments", "POST", { answers });
  hist = await api("/assessments"); ans = {}; step = 0; renderQuiz(); renderResults(0); tab("res"); msg("Diagnóstico guardado.", true);
});

