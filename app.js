const medicines = [
  {
    key: "GONAL-F",
    query: "GONAL",
    display: "Gonal-f",
    note: "Folitropina alfa. Sujeto a receta y diagnóstico hospitalario.",
    nameStartsWith: "GONAL-F",
  },
  {
    key: "MENOPUR",
    query: "MENOPUR",
    display: "Menopur",
    note: "Menotropina. No se encontró Merapur en AEMPS; se usa Menopur.",
  },
  {
    key: "OVITRELLE",
    query: "OVITRELLE",
    display: "Ovitrelle",
    note: "Coriogonadotropina alfa. Sujeto a receta y diagnóstico hospitalario.",
  },
  {
    key: "IBUPROFENO",
    query: "IBUPROFENO",
    display: "Ibuprofeno",
    note: "Incluye presentaciones con y sin receta; filtra por presentación.",
  },
];

const els = {
  medicineSelect: document.querySelector("#medicineSelect"),
  searchInput: document.querySelector("#searchInput"),
  commercialOnly: document.querySelector("#commercialOnly"),
  refreshBtn: document.querySelector("#refreshBtn"),
  countStat: document.querySelector("#countStat"),
  rxStat: document.querySelector("#rxStat"),
  updatedStat: document.querySelector("#updatedStat"),
  mapsLink: document.querySelector("#mapsLink"),
  status: document.querySelector("#status"),
  cards: document.querySelector("#cards"),
};

const onlinePriceHints = {
  "95001021": { amount: 346.48, source: "Nomenclator.org", url: "https://nomenclator.org/686857", checkedAt: "2026-07-03", nationalCode: "686857" },
  "95001036": { amount: 62.94, source: "Nomenclator.org", url: "https://nomenclator.org/727949", checkedAt: "2026-07-03", nationalCode: "727949" },
  "95001033": { amount: 125.89, source: "Nomenclator.org", url: "https://nomenclator.org/802314", checkedAt: "2026-07-03", nationalCode: "802314" },
  "95001034": { amount: 173.54, source: "Nomenclator.org", url: "https://nomenclator.org/802777", checkedAt: "2026-07-03", nationalCode: "802777" },
  "95001035": { amount: 304.54, source: "Nomenclator.org", url: "https://nomenclator.org/802785", checkedAt: "2026-07-03", nationalCode: "802785" },
  "95001025": { label: "31,47-262,61 €", source: "Nomenclator.org", url: "https://nomenclator.org/926683", checkedAt: "2026-07-03", nationalCode: "926683 / 837013" },
  "95001027": { label: "31,47-262,61 €", source: "Nomenclator.org", url: "https://nomenclator.org/837013", checkedAt: "2026-07-03", nationalCode: "926683 / 837013" },
  "73586": { amount: 332.83, source: "Nomenclator.org", url: "https://nomenclator.org/677430", checkedAt: "2026-07-03", nationalCode: "677430" },
  "73585": { amount: 187.69, source: "Nomenclator.org", url: "https://nomenclator.org/677431", checkedAt: "2026-07-03", nationalCode: "677431" },
  "00165008": { amount: 50.63, source: "Nomenclator.org", url: "https://nomenclator.org/677744", checkedAt: "2026-07-03", nationalCode: "677744" },
  "100165007": { amount: 50.63, source: "Nomenclator.org", url: "https://nomenclator.org/769401", checkedAt: "2026-07-03", nationalCode: "769401" },
};

const state = {
  data: new Map(),
  active: medicines[0],
  loading: false,
};

function init() {
  els.medicineSelect.innerHTML = medicines
    .map((medicine) => `<option value="${medicine.key}">${medicine.display}</option>`)
    .join("");

  els.medicineSelect.addEventListener("change", () => {
    state.active = medicines.find((medicine) => medicine.key === els.medicineSelect.value);
    render();
    loadActive();
  });

  els.searchInput.addEventListener("input", render);
  els.commercialOnly.addEventListener("change", render);
  els.refreshBtn.addEventListener("click", () => loadActive(true));
  loadActive();
}

async function loadActive(force = false) {
  const medicine = state.active;
  if (!force && state.data.has(medicine.key)) {
    render();
    return;
  }

  state.loading = true;
  els.status.textContent = `Consultando AEMPS para ${medicine.display}...`;
  renderLinks();

  try {
    const url = `https://cima.aemps.es/cima/rest/medicamentos?nombre=${encodeURIComponent(medicine.query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`AEMPS respondió ${response.status}`);
    const payload = await response.json();
    state.data.set(medicine.key, {
      rows: payload.resultados || [],
      updatedAt: new Date(),
      sourceUrl: url,
    });
    state.loading = false;
    render();
  } catch (error) {
    state.loading = false;
    els.status.textContent =
      "No se pudo consultar AEMPS desde el navegador. Revisa la conexión o prueba de nuevo.";
    els.cards.innerHTML = "";
  }
}

function getFilteredRows() {
  const record = state.data.get(state.active.key);
  const term = normalize(els.searchInput.value);
  if (!record) return [];

  return record.rows.filter((row) => {
    const text = normalize([row.nombre, row.dosis, row.labcomercializador, row.cpresc].join(" "));
    const matchesTerm = !term || text.includes(term);
    const matchesCommercial = !els.commercialOnly.checked || row.comerc === true;
    const matchesMedicine = !state.active.nameStartsWith || normalize(row.nombre).startsWith(normalize(state.active.nameStartsWith));
    return matchesTerm && matchesCommercial && matchesMedicine;
  });
}

function render() {
  renderLinks();
  const record = state.data.get(state.active.key);
  const rows = getFilteredRows();

  els.countStat.textContent = rows.length;
  els.rxStat.textContent = rows.length ? summarizePrescription(rows) : "-";
  els.updatedStat.textContent = record ? formatTime(record.updatedAt) : "Sin actualizar";

  if (state.loading) return;

  if (!record) {
    els.status.textContent = "Pendiente de consulta.";
    els.cards.innerHTML = "";
    return;
  }

  if (!rows.length) {
    els.status.textContent = "No hay resultados con estos filtros.";
    els.cards.innerHTML = "";
    return;
  }

  els.status.textContent = `${state.active.note} Datos de presentaciones desde AEMPS.`;
  els.cards.innerHTML = rows.map(renderCard).join("");
}

function renderCard(row) {
  const title = escapeHtml(row.nombre || "Sin nombre");
  const dose = row.dosis ? `<span class="pill">${escapeHtml(row.dosis)}</span>` : "";
  const commercial = row.comerc
    ? `<span class="pill ok">Comercializado</span>`
    : `<span class="pill warn">No comercializado</span>`;
  const rx = row.receta ? `<span class="pill warn">Con receta</span>` : `<span class="pill ok">Sin receta</span>`;
  const condition = row.cpresc ? `<span class="pill">${escapeHtml(row.cpresc)}</span>` : "";
  const lab = row.labcomercializador ? `<span class="pill">${escapeHtml(row.labcomercializador)}</span>` : "";
  const ficha = row.docs?.find((doc) => doc.tipo === 1)?.urlHtml || row.docs?.[0]?.url || "";
  const prospecto = row.docs?.find((doc) => doc.tipo === 2)?.urlHtml || "";
  const price = onlinePriceHints[row.nregistro];
  const priceSearchQuery = `"${row.nombre}" precio farmacia España`;

  return `
    <article class="card">
      <div class="card-top">
        <div>
          <h3>${title}</h3>
          <div class="meta">${commercial}${rx}${condition}${dose}${lab}</div>
        </div>
        <div class="price-box">
          <span class="price-label">Precio orientativo encontrado online</span>
          <strong>${price ? formatPriceHint(price) : "Consultar"}</strong>
          ${price ? `<a target="_blank" rel="noreferrer" href="${price.url}">${escapeHtml(price.source)} · CN ${escapeHtml(price.nationalCode || "-")}</a>` : ""}
          ${price?.checkedAt ? `<span class="registry">Datos ${escapeHtml(formatDate(price.checkedAt))}</span>` : ""}
          <span class="registry">Nº registro ${escapeHtml(row.nregistro || "-")}</span>
        </div>
      </div>
      <div class="actions">
        <a target="_blank" rel="noreferrer" href="${googleSearchUrl(priceSearchQuery)}">Ver precio online</a>
        <a target="_blank" rel="noreferrer" href="${mapsSearchUrl(row.nombre)}">Farmacias en Madrid</a>
        ${ficha ? `<a target="_blank" rel="noreferrer" href="${ficha}">Ficha AEMPS</a>` : ""}
        ${prospecto ? `<a target="_blank" rel="noreferrer" href="${prospecto}">Prospecto</a>` : ""}
      </div>
    </article>
  `;
}

function renderLinks() {
  const text = `${state.active.display} precio privado farmacia Madrid`;
  els.mapsLink.href = mapsSearchUrl(`${state.active.display} farmacia Madrid`);
}

function summarizePrescription(rows) {
  const values = [...new Set(rows.map((row) => row.cpresc || (row.receta ? "Con receta" : "Sin receta")))];
  return values.length === 1 ? values[0] : "Mixto";
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatTime(date) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatEuros(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatPriceHint(price) {
  return price.label || formatEuros(price.amount);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function googleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
