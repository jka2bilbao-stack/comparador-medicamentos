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
    key: "MERIOFERT",
    query: "MERIOFERT",
    display: "Meriofert",
    note: "Menotropina. Sujeto a receta y diagnóstico hospitalario.",
  },
  {
    key: "OVITRELLE",
    query: "OVITRELLE",
    display: "Ovitrelle",
    note: "Coriogonadotropina alfa. Sujeto a receta y diagnóstico hospitalario.",
  },
];

const els = {
  medicineSelect: document.querySelector("#medicineSelect"),
  searchInput: document.querySelector("#searchInput"),
  commercialOnly: document.querySelector("#commercialOnly"),
  refreshBtn: document.querySelector("#refreshBtn"),
  countStat: document.querySelector("#countStat"),
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
  "88705": { amount: 262.86, source: "Nomenclator.org", url: "https://nomenclator.org/762359", checkedAt: "2026-07-03", nationalCode: "762359" },
  "79761": { amount: 52.51, source: "Nomenclator.org", url: "https://nomenclator.org/706230", checkedAt: "2026-07-03", nationalCode: "706230" },
  "79762": { amount: 26.26, source: "Nomenclator.org", url: "https://nomenclator.org/706233", checkedAt: "2026-07-03", nationalCode: "706233" },
  "00165008": { amount: 50.63, source: "Nomenclator.org", url: "https://nomenclator.org/677744", checkedAt: "2026-07-03", nationalCode: "677744" },
  "100165007": { amount: 50.63, source: "Nomenclator.org", url: "https://nomenclator.org/769401", checkedAt: "2026-07-03", nationalCode: "769401" },
};

const nationalCodeLookup = {
  "95001021": "686857",
  "95001036": "727949",
  "95001033": "802314",
  "95001034": "802777",
  "95001035": "802785",
  "95001025": "926683",
  "95001027": "837013",
  "73586": "677430",
  "73585": "677431",
  "62583": "758009",
  "87964": "758010",
  "87965": "758013",
  "87966": "758014",
  "88705": "762359",
  "79761": "706230",
  "79762": "706233",
  "89198": "763909",
  "89199": "763913",
  "00165008": "677744",
  "100165007": "769401",
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

  els.commercialOnly.addEventListener("change", render);
  els.refreshBtn.addEventListener("click", () => loadActive(true));
  els.cards.addEventListener("click", handleCardClick);
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
  if (!record) return [];

  return record.rows.filter((row) => {
    const matchesCommercial = !els.commercialOnly.checked || row.comerc === true;
    const matchesMedicine = !state.active.nameStartsWith || normalize(row.nombre).startsWith(normalize(state.active.nameStartsWith));
    return matchesCommercial && matchesMedicine;
  });
}

function render() {
  renderLinks();
  const record = state.data.get(state.active.key);
  const rows = getFilteredRows();

  els.countStat.textContent = rows.length;
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
  const nationalCode = nationalCodeLookup[row.nregistro];
  const lookupButton = nationalCode
    ? `<button class="secondary lookup-price" type="button" data-registry="${escapeHtml(row.nregistro || "")}" data-cn="${escapeHtml(nationalCode)}">Buscar precio online</button>`
    : `<span class="pill warn">Sin código nacional</span>`;

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
        ${price ? `<a target="_blank" rel="noreferrer" href="${price.url}">Ver fuente del precio</a>` : lookupButton}
        ${ficha ? `<a target="_blank" rel="noreferrer" href="${ficha}">Ficha AEMPS</a>` : ""}
        ${prospecto ? `<a target="_blank" rel="noreferrer" href="${prospecto}">Prospecto</a>` : ""}
      </div>
    </article>
  `;
}

function renderLinks() {
  els.mapsLink.href = mapsSearchUrl(`${state.active.display} farmacia Madrid`);
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
  if (!price.amount && !price.label) return "Consultar";
  return price.label || formatEuros(price.amount);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

async function handleCardClick(event) {
  const button = event.target.closest(".lookup-price");
  if (!button) return;

  const registry = button.dataset.registry;
  const nationalCode = button.dataset.cn;
  const card = button.closest(".card");
  const priceBox = card?.querySelector(".price-box");
  if (!registry || !nationalCode || !priceBox) return;

  button.disabled = true;
  button.textContent = "Buscando...";
  priceBox.classList.add("is-loading");

  try {
    const price = await fetchNomenclatorPrice(nationalCode);
    onlinePriceHints[registry] = price;
    render();
  } catch (error) {
    priceBox.classList.remove("is-loading");
    priceBox.querySelector("strong").textContent = "No encontrado";
    const note = document.createElement("span");
    note.className = "registry";
    note.textContent = "No se pudo obtener automáticamente";
    priceBox.appendChild(note);
    button.textContent = "Reintentar";
    button.disabled = false;
  }
}

async function fetchNomenclatorPrice(nationalCode) {
  const url = `https://nomenclator.org/${encodeURIComponent(nationalCode)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("No response from Nomenclator");
  const html = await response.text();
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
  const priceMatch = html.match(/PVP\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:Euros|€)/i) || title.match(/Precio:\s*([0-9]+(?:[.,][0-9]{1,2})?)€/i);
  if (!priceMatch) throw new Error("Price not found");
  const dateMatch = html.match(/datetime="(\d{4}-\d{2}-\d{2})"/i);

  return {
    amount: Number(priceMatch[1].replace(",", ".")),
    source: "Nomenclator.org",
    url,
    checkedAt: dateMatch?.[1] || new Date().toISOString().slice(0, 10),
    nationalCode,
  };
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
