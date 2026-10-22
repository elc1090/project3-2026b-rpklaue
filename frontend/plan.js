// Menú lateral + Ruta sostenible, Mi plan, Seguimiento, Explorar
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TITLES = { inicio: "Inicio", empresa: "Mi empresa", diag: "Diagnóstico", res: "Resultado", ruta: "Ruta sostenible", plan: "Mi plan", seg: "Seguimiento", explorar: "Explorar", otros: "Otros módulos" };
const PCT = { "Pendiente": 0, "En curso": 50, "Completada": 100 };
const short = p => p.replace("Perspectiva ", "");
const venc = x => x.due && x.due < new Date().toISOString().slice(0, 10) && x.status !== "Completada";
const kpi = (a, b, c) => `<div class="kpi"><small>${a}</small><b>${b}</b><span>${c}</span></div>`;
let cur = "inicio", flt = "";

const _tab = tab, _show = show, _enter = enter;
tab = n => { cur = n; _tab(n); $("co").textContent = $("who").textContent; $("ptitle").textContent = TITLES[n];
  const v = VIEWS[n]; if (v) v().catch(e => msg(e.message)); };
show = on => { _show(on); document.body.classList.toggle("in", on); };
enter = async () => { await _enter(); tab("inicio"); };

const recCard = r => `<div class="rec"><span class="ic">${r.icon}</span><div><h4>${esc(r.title)}</h4><p>${esc(r.reason || r.why)}</p>
  <span class="tag">${short(r.perspective)}</span><span class="tag">${r.ods}</span>${r.priority ? `<span class="tag p${r.priority}">Prioridad ${r.priority}</span>` : ""}</div>
  ${r.in_plan ? '<button class="ghost" data-go="plan">En el plan ✓</button>' : `<button class="main" data-act="add" data-id="${r.id}">Agregar al plan</button>`}</div>`;
const spark = logs => { const v = logs.filter(g => g.value != null).map(g => g.value).reverse(); if (v.length < 2) return "";
  const mn = Math.min(...v), r = (Math.max(...v) - mn) || 1;
  return `<svg viewBox="0 0 120 30" class="spark"><polyline fill="none" stroke="#4f46e5" stroke-width="2" points="${v.map((y, i) => `${i * 120 / (v.length - 1)},${28 - (y - mn) / r * 26}`).join(" ")}"/></svg>`; };

const VIEWS = {
  async inicio() {
    const [pl, p] = await Promise.all([api("/plan"), api("/profile")]), h = hist[0], L = h && lvl(h.total);
    const done = pl.filter(x => x.status === "Completada").length, avance = pl.length ? Math.round(pl.reduce((a, x) => a + PCT[x.status], 0) / pl.length) : 0, late = pl.filter(venc).length;
    const nx = !p.description ? ["empresa", "Completa el perfil de tu empresa"] : !h ? ["diag", "Haz tu primer diagnóstico"] : !pl.length ? ["ruta", "Elige acciones de tu ruta sostenible"] : ["plan", "Actualiza tu plan de acción"];
    $("tab-inicio").innerHTML = `<div class="card"><h2>Hola, ${esc(p.company_name)} 👋</h2><p class="sub">${esc(p.vision || "Define tu visión en «Mi empresa».")}</p><button class="main" data-go="${nx[0]}">${nx[1]} →</button></div>
      <div class="kpis">${kpi("Puntaje global", h ? h.total + "%" : "—", L ? "Nivel " + L[1] : "Sin diagnóstico")}${kpi("Acciones en el plan", pl.length, done + " completadas")}${kpi("Avance del plan", avance + "%", "promedio de las acciones")}${kpi("Plazos vencidos", late, late ? "requieren atención" : "todo al día")}</div>`;
  },
  async ruta() {
    const r = await api("/route");
    if (!r.has_diagnostic) { $("tab-ruta").innerHTML = '<div class="card empty">Tu ruta se genera a partir del diagnóstico.<br><br><button class="main" data-go="diag">Hacer el diagnóstico</button></div>'; return; }
    const pl = await api("/plan"), top = r.items.slice(0, 6), st = Object.fromEntries(pl.map(x => [x.rec_id, x.status]));
    const inp = top.filter(x => x.in_plan).length, ok = top.filter(x => st[x.id] === "Completada").length;
    $("tab-ruta").innerHTML = `<div class="card"><h2>Mi Ruta Sostenible</h2><p class="sub">Recomendaciones del catálogo SOSTENPYME, ordenadas según las brechas de tu último diagnóstico (primero las de menor puntaje).</p>
      <div class="bar"><i style="width:${ok / top.length * 100}%;background:#6366f1"></i></div><p><b>${inp}</b> de ${top.length} acciones prioritarias están en tu plan · <b>${ok}</b> completadas. Al repetir el diagnóstico la ruta se recalcula.</p>${top.map(recCard).join("")}
      <p><button class="ghost" data-go="explorar">Ver todo el catálogo →</button></p></div>`;
  },
  async plan() {
    const pl = await api("/plan");
    $("tab-plan").innerHTML = pl.length ? pl.map(x => `<div class="card item" data-id="${x.id}"><div class="ihead"><h3>${x.icon} ${esc(x.title)}</h3><span class="st ${x.status.replace(" ", "")}">${x.status}</span></div>
      <span class="tag">${short(x.perspective)}</span><span class="tag">${x.ods}</span>
      <div class="frm"><label>Estado<select data-f="status">${["Pendiente", "En curso", "Completada"].map(s => `<option ${s === x.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label>Responsable<input data-f="owner" value="${esc(x.owner)}" placeholder="Ej.: Camila"></label><label>Plazo<input type="date" data-f="due" value="${esc(x.due)}"></label>
      <label>Indicador<input data-f="indicator" value="${esc(x.indicator)}"></label></div>${venc(x) ? '<p class="late">⚠ Plazo vencido</p>' : ""}
      <button class="main" data-act="save" data-id="${x.id}">Guardar</button> <button class="ghost" data-act="del" data-id="${x.id}">Quitar del plan</button></div>`).join("")
      : '<div class="card empty">Tu plan está vacío. Convierte recomendaciones en acciones concretas desde la ruta.<br><br><button class="main" data-go="ruta">Ir a Ruta sostenible</button></div>';
  },
  async seg() {
    const pl = await api("/plan"); let ev;
    if (hist.length < 2) ev = "<p class='sub'>Cuando repitas el diagnóstico verás aquí cuánto mejoró cada perspectiva frente al primero.</p>";
    else { const a = hist[hist.length - 1], b = hist[0];
      ev = "<table>" + Object.keys(b.scores).map(k => { const d = +(b.scores[k] - a.scores[k]).toFixed(1);
        return `<tr><td>${short(k)}</td><td>${a.scores[k]}% → ${b.scores[k]}%</td><td class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} pts</td></tr>`; }).join("") + "</table>"; }
    $("tab-seg").innerHTML = `<div class="card"><h2>Evolución del diagnóstico</h2>${ev}</div>` + (pl.length ? pl.map(x => `<div class="card item" data-id="${x.id}"><div class="ihead"><h3>${x.icon} ${esc(x.title)}</h3><span class="st ${x.status.replace(" ", "")}">${x.status}</span></div>
      <p>Indicador: <b>${esc(x.indicator)}</b> ${spark(x.logs)}</p>
      <div class="lg"><label>Nota<input data-f="note" placeholder="¿Qué avanzó?"></label><label>Valor<input data-f="value" type="number" step="any" placeholder="Valor"></label><button class="main" data-act="log" data-id="${x.id}">Registrar avance</button></div>
      <ul class="logs">${x.logs.slice(0, 4).map(g => `<li>${new Date(g.created_at + "Z").toLocaleDateString()} — ${esc(g.note)} ${g.value != null ? "· <b>" + g.value + "</b>" : ""}</li>`).join("") || "<li>Aún sin avances.</li>"}</ul></div>`).join("")
      : '<div class="card empty">Agrega acciones a tu plan para hacerles seguimiento.</div>');
  },
  async explorar() {
    const [cat, pl] = await Promise.all([api("/catalog"), api("/plan")]), ids = new Set(pl.map(x => x.rec_id)), ps = [...new Set(cat.map(c => c.perspective))];
    $("tab-explorar").innerHTML = `<div class="card"><h2>Catálogo de recomendaciones</h2><div class="chips"><button data-act="flt" data-p="" class="${flt ? "" : "on"}">Todas</button>${ps.map(p => `<button data-act="flt" data-p="${p}" class="${flt === p ? "on" : ""}">${short(p)}</button>`).join("")}</div>
      ${cat.filter(c => !flt || c.perspective === flt).map(c => recCard({ ...c, in_plan: ids.has(c.id) })).join("")}</div>`;
  },
};

$("app").addEventListener("click", async e => {
  const b = e.target.closest("[data-go],[data-act]"); if (!b) return;
  try {
    if (b.dataset.go) return tab(b.dataset.go);
    const { act, id } = b.dataset, c = b.closest(".item"), f = k => c.querySelector(`[data-f=${k}]`).value;
    if (act === "add") { await api("/plan", "POST", { rec_id: id }); msg("Agregada a Mi plan.", true); tab(cur); }
    else if (act === "flt") { flt = b.dataset.p; tab("explorar"); }
    else if (act === "save") { await api("/plan/" + id, "PUT", { status: f("status"), owner: f("owner"), due: f("due"), indicator: f("indicator") }); msg("Acción guardada.", true); tab("plan"); }
    else if (act === "del") { if (confirm("¿Quitar esta acción del plan?")) { await api("/plan/" + id, "DELETE"); tab("plan"); } }
    else if (act === "log") { await api(`/plan/${id}/progress`, "POST", { note: f("note"), value: f("value") }); msg("Avance registrado.", true); tab("seg"); }
  } catch (err) { msg(err.message); }
});
if (token) enter().catch(clearSession); else show(false);
