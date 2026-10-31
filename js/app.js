import {
  byggEksport,
  byggEksportFraLagret,
  byggOkt,
  dagKort,
  dagNavn,
  dagerSortert,
  datoLang,
  erLogget,
  filnavnForOkt,
  formatKlokke,
  formatTall,
  hvileTekst,
  isoDato,
  oktId,
  parseDato,
  parseTall,
  periodeTekst,
  repsFeltnavn,
  repsTekst,
  rirSetning,
  supersettTekst,
  tellSett,
  typeTekst,
  ukedagKort,
  velgDato,
  velgPlan,
} from "./modell.js";
import {
  installErSkjult,
  lesHvile,
  lesLogg,
  lesTemaValg,
  skrivHvile,
  skrivLogg,
  skrivTemaValg,
  skjulInstall,
} from "./lagring.js";

const tilstand = {
  planer: [],
  plan: null,
  dato: null,
  iDag: isoDato(new Date()),
  visning: "uke",
  logg: { okter: {} },
  beholdScroll: false,
};

let installEvent = null;
let hvile = null;
let hvileKlokke = null;
let lydCtx = null;
let wakeLock = null;
let toastKlokke = null;

function pentNavn(id) {
  if (!id) return "Økt";
  return id.split("-").map((del) => del.charAt(0).toLocaleUpperCase("nb") + del.slice(1)).join(" ");
}

function esc(verdi) {
  return String(verdi ?? "").replace(/[&<>"']/g, (tegn) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[tegn]));
}

function erMork() {
  const valg = lesTemaValg();
  if (valg === "mork") return true;
  if (valg === "lys") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function brukTema() {
  const mork = erMork();
  document.documentElement.setAttribute("data-tema", mork ? "mork" : "lys");
  const farge = mork ? "#100e0c" : "#ebe6dc";
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", farge);
  });
}

function erStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function erIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function aktivDag() {
  return dagerSortert(tilstand.plan).find((dag) => dag.dato === tilstand.dato) || null;
}

function finnDag(dato) {
  for (const plan of tilstand.planer) {
    const dag = (plan.dager || []).find((kandidat) => kandidat.dato === dato);
    if (dag) return { plan, dag };
  }
  return null;
}

function sikrOkt(dag) {
  const okt = byggOkt(dag, tilstand.logg.okter[dag.dato], tilstand.logg.okter);
  tilstand.logg.okter[dag.dato] = okt;
  skrivLogg(tilstand.logg);
  return okt;
}

async function lastPlaner() {
  const svar = await fetch("./data/uker.json");
  if (!svar.ok) throw new Error("uker.json");
  const indeks = await svar.json();
  const filer = Array.isArray(indeks.filer) ? indeks.filer : [];
  const planer = [];
  for (const fil of filer) {
    if (!/^[\w.-]+\.json$/.test(fil)) throw new Error(fil);
    const filSvar = await fetch(`./data/${encodeURIComponent(fil)}`);
    if (!filSvar.ok) throw new Error(fil);
    planer.push(await filSvar.json());
  }
  return planer;
}

function htmlDager() {
  if (tilstand.visning !== "uke") return "";
  const knapper = dagerSortert(tilstand.plan).map((dag) => {
    const valgt = dag.dato === tilstand.dato;
    const iDag = dag.dato === tilstand.iDag;
    const klasser = ["dag", `type-${dag.type}`, valgt ? "valgt" : "", iDag ? "er-i-dag" : ""].filter(Boolean);
    const merkelapp = `${datoLang(dag.dato)}, ${dagNavn(dag)}${iDag ? ", i dag" : ""}`;
    return `<button type="button" class="${klasser.join(" ")}" data-handling="dag" data-dato="${dag.dato}" aria-pressed="${valgt ? "true" : "false"}" aria-label="${esc(merkelapp)}">
      <span class="ukedag">${ukedagKort(dag.dato)}</span>
      <span class="nr">${parseDato(dag.dato).getDate()}</span>
      <span class="kort">${esc(dagKort(dag))}</span>
    </button>`;
  }).join("");
  return `<nav class="dager" aria-label="Dager denne uken">${knapper}</nav>`;
}

function htmlUkevalg() {
  if (tilstand.planer.length < 2) return "";
  const valg = [...tilstand.planer]
    .sort((a, b) => (a.aar - b.aar) || (a.uke - b.uke))
    .map((plan) => {
      const valgt = plan === tilstand.plan ? " selected" : "";
      return `<option value="${plan.aar}-${plan.uke}"${valgt}>Uke ${plan.uke} · ${plan.aar}</option>`;
    })
    .join("");
  return `<label class="ukevalg">Ukeplan <select id="ukevalg">${valg}</select></label>`;
}

function htmlBanner() {
  if (tilstand.visning !== "uke") return "";
  const harIDag = dagerSortert(tilstand.plan).some((dag) => dag.dato === tilstand.iDag);
  if (harIDag) return "";
  return `<p class="banner">I dag er ${esc(datoLang(tilstand.iDag))}. Denne planen gjelder ${esc(periodeTekst(tilstand.plan))}. Velg en dag under.</p>`;
}

function htmlOppvarming(dag) {
  if (!dag.oppvarming?.length) return "";
  const punkter = dag.oppvarming.map((punkt) => `<li>${esc(punkt)}</li>`).join("");
  return `<section class="oppvarming"><h3>Oppvarming</h3><ol>${punkter}</ol></section>`;
}

function htmlSett(ovelse, indeks, sett) {
  const felt = repsFeltnavn(ovelse.enhet);
  return `<div class="sett${sett.ferdig ? " er-ferdig" : ""}" data-sett="${indeks}">
    <span class="sett-nr">${indeks + 1}</span>
    <input inputmode="decimal" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="6" data-felt="kg" aria-label="Sett ${indeks + 1}, kilo" value="${esc(formatTall(sett.kg))}">
    <input inputmode="numeric" enterkeyhint="next" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="6" data-felt="reps" aria-label="Sett ${indeks + 1}, ${esc(felt)}" value="${esc(formatTall(sett.reps))}">
    <button type="button" class="huk" data-handling="huk" aria-pressed="${sett.ferdig ? "true" : "false"}" aria-label="Sett ${indeks + 1} ferdig">${sett.ferdig ? "✓" : ""}</button>
  </div>`;
}

function htmlOvelse(ovelse, indeks, alle, okt) {
  const lagret = okt.ovelser[ovelse.id];
  const meta = [
    `${ovelse.sett} sett`,
    repsTekst(ovelse),
    ovelse.hvileSek ? `hvile ${hvileTekst(ovelse.hvileSek)}` : "",
  ].filter(Boolean).join(" · ");
  const rir = rirSetning(ovelse.rir);
  const tips = ovelse.tips ? `<p class="tips"><span>Tips.</span> ${esc(ovelse.tips)}</p>` : "";
  const supersett = supersettTekst(ovelse, alle);
  const forslag = lagret.sett.some((sett) => sett.forslag);
  const rader = lagret.sett.map((sett, settIndeks) => htmlSett(ovelse, settIndeks, sett)).join("");
  return `<article class="ovelse${ovelse.supersettMed ? " er-supersett" : ""}" data-ovelse="${esc(ovelse.id)}">
    <header class="ovelse-hode">
      <p class="ovelse-nr">${String(indeks + 1).padStart(2, "0")}</p>
      <h3>${esc(ovelse.navn)}</h3>
    </header>
    <p class="meta">${esc(meta)}</p>
    ${rir ? `<p class="rir">${esc(rir)}</p>` : ""}
    ${tips}
    ${supersett ? `<p class="supersett">${esc(supersett)}</p>` : ""}
    ${forslag ? `<p class="forslag">Tallene er fra forrige økt. Endre dem hvis du løftet noe annet.</p>` : ""}
    <div class="sett-hode" aria-hidden="true"><span></span><span>Kg</span><span>${esc(repsFeltnavn(ovelse.enhet))}</span><span></span></div>
    <div class="sett-liste">${rader}</div>
  </article>`;
}

function htmlNotatOgEksport(okt) {
  return `<label class="notat">
      <span>Notat til økta</span>
      <textarea id="notat" rows="3" maxlength="2000" placeholder="Hvordan føltes økta? Valgfritt.">${esc(okt.notat)}</textarea>
    </label>
    <p class="lagret">Lagres automatisk på telefonen.</p>
    <button type="button" class="primaer" data-handling="eksporter">Ferdig / eksporter</button>
    <p class="eksport-hjelp">Du får én fil for denne økta. Lagre den i OneDrive, mappen Grok Bot / 20-PT / Logg.</p>
    <button type="button" class="sekundaer" data-handling="info">Progresjon og sikkerhet</button>`;
}

function htmlStyrke(dag, okt) {
  const { ferdig, antall } = tellSett(okt);
  const andel = antall ? Math.round((ferdig / antall) * 100) : 0;
  const ovelser = (dag.ovelser || []).map((ovelse, indeks) => htmlOvelse(ovelse, indeks, dag.ovelser, okt)).join("");
  const iDag = dag.dato === tilstand.iDag ? `<p class="i-dag">I dag</p>` : "";
  const altFerdig = antall && ferdig === antall ? `<p class="alt-ferdig">Alle sett er huket av.</p>` : "";
  return `<section class="okt">
    ${iDag}
    <p class="type">${esc(typeTekst(dag.type))}</p>
    <h2>${esc(dagNavn(dag))}</h2>
    <p class="fokus">${esc([dag.fokus, datoLang(dag.dato)].filter(Boolean).join(" · "))}</p>
    <p class="fremdrift">${ferdig} av ${antall} sett ferdig</p>
    <div class="meter" aria-hidden="true"><span style="width:${andel}%"></span></div>
    ${altFerdig}
    ${htmlOppvarming(dag)}
    <p class="forklaring">RIR betyr repetisjoner i reserve: hvor mange repetisjoner du har igjen før du ikke klarer mer. Skriv kg og reps. Huk av settet når du er ferdig, så starter hvilen.</p>
    ${ovelser}
    ${htmlNotatOgEksport(okt)}
  </section>`;
}

function htmlEnkel(dag, okt) {
  const linje = [
    dag.pulssone || "",
    dag.varighetMin ? `${dag.varighetMin} minutter` : "",
  ].filter(Boolean).join(" · ");
  const iDag = dag.dato === tilstand.iDag ? `<p class="i-dag">I dag</p>` : "";
  const tekst = dag.beskrivelse
    || (dag.type === "hvile" ? "I dag er det hvile. Kroppen bygger muskler når du hviler." : "");
  return `<section class="okt enkel">
    ${iDag}
    <p class="type">${esc(typeTekst(dag.type))}</p>
    <h2>${esc(dagNavn(dag))}</h2>
    <p class="fokus">${esc(datoLang(dag.dato))}</p>
    ${linje ? `<p class="kond-tall">${esc(linje)}</p>` : ""}
    ${tekst ? `<p class="beskrivelse">${esc(tekst)}</p>` : ""}
    ${htmlNotatOgEksport(okt)}
  </section>`;
}

function htmlLogg() {
  const okter = Object.values(tilstand.logg.okter)
    .filter(erLogget)
    .sort((a, b) => b.dato.localeCompare(a.dato));
  if (!okter.length) {
    return `<section class="tom"><h2>Logg</h2><p>Ingen økter ennå. Når du logger et sett, vises økta her.</p></section>`;
  }
  const kort = okter.map((okt) => {
    const funnet = finnDag(okt.dato);
    const navn = funnet ? dagNavn(funnet.dag) : pentNavn(okt.okt);
    const { ferdig } = tellSett(okt);
    const notat = (okt.notat || "").trim();
    return `<article class="logg-kort">
      <h3>${esc(navn)}</h3>
      <p>${esc(datoLang(okt.dato))}</p>
      <p class="meta">${ferdig} sett huket av</p>
      ${notat ? `<p class="logg-notat">${esc(notat)}</p>` : ""}
      <div class="logg-knapper">
        <button type="button" data-handling="apne" data-dato="${esc(okt.dato)}">Åpne</button>
        <button type="button" data-handling="eksporter-logg" data-dato="${esc(okt.dato)}">Eksporter</button>
      </div>
    </article>`;
  }).join("");
  return `<section class="logg"><h2>Logg</h2>${kort}</section>`;
}

function htmlInfo() {
  const plan = tilstand.plan;
  const notater = (plan.notater || []).map((notat) => {
    const klasse = /smerte/i.test(notat) ? "sikkerhet" : (/forskning/i.test(notat) ? "forskning" : "");
    return `<li class="${klasse}">${esc(notat)}</li>`;
  }).join("");
  return `<dialog id="info">
    <h2>Progresjon</h2>
    <p>${esc(plan.progresjon || "")}</p>
    <h2>Husk</h2>
    <ul>${notater}</ul>
    <button type="button" class="sekundaer" data-handling="lukk-info">Lukk</button>
  </dialog>`;
}

function htmlInstall() {
  if (erStandalone() || installErSkjult()) return "";
  const tekst = erIOS()
    ? "I Safari: trykk Del, deretter «Legg til på Hjem-skjerm»."
    : "Legg appen på hjemskjermen, så virker den som en vanlig app.";
  const installer = installEvent ? `<button type="button" data-handling="installer">Installer</button>` : "";
  return `<aside class="install"><p>${tekst}</p><div class="install-knapper">${installer}<button type="button" data-handling="skjul-install">Skjul</button></div></aside>`;
}

function htmlInnhold() {
  if (tilstand.visning === "logg") return htmlLogg();
  const dag = aktivDag();
  if (!dag) return `<p class="feil">Fant ikke dagen i planen.</p>`;
  const okt = sikrOkt(dag);
  if (dag.type === "styrke") return htmlStyrke(dag, okt);
  return htmlEnkel(dag, okt);
}

function htmlApp() {
  const plan = tilstand.plan;
  const mork = erMork();
  return `<div class="skall">
    <header class="topp">
      <div class="topp-rad">
        <p class="merke">Trening</p>
        <button type="button" class="tema" data-handling="tema" aria-label="${mork ? "Bytt til lyst tema" : "Bytt til mørkt tema"}">${mork ? "Lys" : "Mørk"}</button>
      </div>
      <h1>Uke ${esc(plan.uke)}</h1>
      <p class="program">${esc(plan.program)} · uke ${esc(plan.ukeIProgram)} av ${esc(plan.antallUker)}</p>
      <p class="periode">${esc(periodeTekst(plan))}</p>
      ${htmlUkevalg()}
    </header>
    <div class="faner" role="tablist" aria-label="Visning">
      <button type="button" role="tab" data-handling="visning" data-visning="uke" aria-selected="${tilstand.visning === "uke" ? "true" : "false"}">Denne uken</button>
      <button type="button" role="tab" data-handling="visning" data-visning="logg" aria-selected="${tilstand.visning === "logg" ? "true" : "false"}">Logg</button>
    </div>
    ${htmlBanner()}
    ${htmlDager()}
    <main id="innhold">${htmlInnhold()}</main>
    ${htmlInstall()}
    ${htmlInfo()}
  </div>`;
}

function tegn() {
  const app = document.getElementById("app");
  const y = tilstand.beholdScroll ? window.scrollY : 0;
  document.title = `Trening · uke ${tilstand.plan.uke}`;
  app.innerHTML = htmlApp();
  if (tilstand.beholdScroll) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  tilstand.beholdScroll = false;
}

function visToast(tekst) {
  const el = document.getElementById("toast");
  el.textContent = tekst;
  el.hidden = false;
  clearTimeout(toastKlokke);
  toastKlokke = setTimeout(() => {
    el.hidden = true;
  }, 5200);
}

function forberedLyd() {
  const Lyd = window.AudioContext || window.webkitAudioContext;
  if (!Lyd) return;
  if (!lydCtx) lydCtx = new Lyd();
  if (lydCtx.state === "suspended") lydCtx.resume();
}

function pip() {
  if (!lydCtx) return;
  const start = lydCtx.currentTime;
  [0, 0.2].forEach((forsinkelse, indeks) => {
    const oscillator = lydCtx.createOscillator();
    const forsterker = lydCtx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = indeks === 0 ? 784 : 1046;
    oscillator.connect(forsterker);
    forsterker.connect(lydCtx.destination);
    const tid = start + forsinkelse;
    forsterker.gain.setValueAtTime(0.0001, tid);
    forsterker.gain.exponentialRampToValueAtTime(0.12, tid + 0.02);
    forsterker.gain.exponentialRampToValueAtTime(0.0001, tid + 0.28);
    oscillator.start(tid);
    oscillator.stop(tid + 0.3);
  });
}

async function holdVaaken() {
  try {
    if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

async function slippVaaken() {
  try {
    await wakeLock?.release();
  } catch {
    /* skjermen får sove */
  }
  wakeLock = null;
}

function oppdaterHvile() {
  const boks = document.getElementById("hvile");
  if (!hvile || !boks) return;
  const igjen = (hvile.slutt - Date.now()) / 1000;
  boks.hidden = false;
  document.body.classList.add("hviler");
  const etikett = document.getElementById("hvile-etikett");
  const tid = document.getElementById("hvile-tid");
  const stopp = document.getElementById("hvile-stopp");
  if (igjen <= 0) {
    if (!hvile.pipet) {
      hvile.pipet = true;
      pip();
      navigator.vibrate?.([180, 90, 180]);
    }
    boks.classList.add("er-ferdig");
    etikett.textContent = "Hvilen er ferdig";
    tid.textContent = "Kjør på";
    stopp.textContent = "Lukk";
    return;
  }
  boks.classList.remove("er-ferdig");
  etikett.textContent = `Hvile · ${hvile.etikett || "Neste sett"}`;
  tid.textContent = formatKlokke(igjen);
  stopp.textContent = "Stopp";
}

function startKlokke() {
  clearInterval(hvileKlokke);
  oppdaterHvile();
  hvileKlokke = setInterval(oppdaterHvile, 200);
}

function startHvile(sekunder, etikett) {
  hvile = { slutt: Date.now() + sekunder * 1000, etikett, pipet: false };
  skrivHvile({ slutt: hvile.slutt, etikett: hvile.etikett });
  forberedLyd();
  holdVaaken();
  startKlokke();
}

function plussTretti() {
  const grunn = Math.max(hvile?.slutt || 0, Date.now());
  hvile = {
    slutt: grunn + 30000,
    etikett: hvile?.etikett || "Hvile",
    pipet: false,
  };
  skrivHvile({ slutt: hvile.slutt, etikett: hvile.etikett });
  startKlokke();
}

function stoppHvile() {
  hvile = null;
  skrivHvile(null);
  clearInterval(hvileKlokke);
  hvileKlokke = null;
  const boks = document.getElementById("hvile");
  if (boks) {
    boks.hidden = true;
    boks.classList.remove("er-ferdig");
  }
  document.body.classList.remove("hviler");
  slippVaaken();
}

function gjenopptaHvile() {
  const lagret = lesHvile();
  if (!lagret || lagret.slutt <= Date.now()) {
    skrivHvile(null);
    return;
  }
  hvile = { ...lagret, pipet: false };
  holdVaaken();
  startKlokke();
}

async function delFil(navn, objekt) {
  const json = `${JSON.stringify(objekt, null, 2)}\n`;
  const fil = new File([json], navn, { type: "application/json" });
  const kanDele = typeof navigator.canShare === "function" && navigator.canShare({ files: [fil] });
  if (kanDele && typeof navigator.share === "function") {
    await navigator.share({ files: [fil], title: navn });
    return "delt";
  }
  const url = URL.createObjectURL(fil);
  const lenke = document.createElement("a");
  lenke.href = url;
  lenke.download = navn;
  document.body.append(lenke);
  lenke.click();
  lenke.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "lastet";
}

async function eksporterDato(dato, knapp) {
  const funnet = finnDag(dato);
  const okt = tilstand.logg.okter[dato];
  if (!funnet && !okt) return;
  const payload = funnet ? byggEksport(funnet.dag, okt) : byggEksportFraLagret(okt);
  const navn = funnet ? filnavnForOkt(funnet.dag) : `${okt.dato}_${okt.okt || oktId(funnet?.dag)}.json`;
  if (knapp) knapp.disabled = true;
  try {
    const resultat = await delFil(navn, payload);
    if (resultat === "delt") {
      visToast("Filen er klar. Velg OneDrive og mappen Grok Bot / 20-PT / Logg.");
    } else {
      visToast(`Lastet ned ${navn}. Legg den i OneDrive: Grok Bot / 20-PT / Logg.`);
    }
  } catch (feil) {
    if (feil?.name !== "AbortError") visToast("Kunne ikke dele filen. Prøv igjen.");
  } finally {
    if (knapp) knapp.disabled = false;
  }
}

function hukAv(knapp) {
  const ovelseEl = knapp.closest("[data-ovelse]");
  const settEl = knapp.closest("[data-sett]");
  if (!ovelseEl || !settEl) return;
  const dag = aktivDag();
  const okt = tilstand.logg.okter[dag.dato];
  const sett = okt?.ovelser?.[ovelseEl.dataset.ovelse]?.sett?.[Number(settEl.dataset.sett)];
  if (!sett) return;
  sett.ferdig = !sett.ferdig;
  if (sett.ferdig) sett.forslag = false;
  skrivLogg(tilstand.logg);
  if (sett.ferdig) {
    const ovelse = (dag.ovelser || []).find((kandidat) => kandidat.id === ovelseEl.dataset.ovelse);
    if (ovelse?.hvileSek) startHvile(ovelse.hvileSek, ovelse.navn);
  }
  tilstand.beholdScroll = true;
  tegn();
}

function oppdaterFelt(input) {
  const ovelseEl = input.closest("[data-ovelse]");
  const settEl = input.closest("[data-sett]");
  const okt = tilstand.logg.okter[tilstand.dato];
  const sett = okt?.ovelser?.[ovelseEl?.dataset.ovelse]?.sett?.[Number(settEl?.dataset.sett)];
  if (!sett) return;
  sett[input.dataset.felt] = parseTall(input.value);
  sett.forslag = false;
  skrivLogg(tilstand.logg);
  const hint = ovelseEl.querySelector(".forslag");
  if (hint && !okt.ovelser[ovelseEl.dataset.ovelse].sett.some((rad) => rad.forslag)) hint.remove();
}

function apneDato(dato) {
  const funnet = finnDag(dato);
  if (!funnet) {
    visToast("Økta finnes ikke i ukeplanen som er lastet inn.");
    return;
  }
  tilstand.plan = funnet.plan;
  tilstand.dato = dato;
  tilstand.visning = "uke";
  tegn();
}

async function installerApp() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  tegn();
}

function bind() {
  document.addEventListener("click", (event) => {
    const dialog = document.getElementById("info");
    if (event.target === dialog) dialog.close();

    const knapp = event.target.closest("[data-handling]");
    if (!knapp) return;
    const handling = knapp.dataset.handling;
    if (handling === "dag") {
      tilstand.dato = knapp.dataset.dato;
      tilstand.visning = "uke";
      tegn();
    } else if (handling === "visning") {
      tilstand.visning = knapp.dataset.visning;
      tegn();
    } else if (handling === "tema") {
      skrivTemaValg(erMork() ? "lys" : "mork");
      brukTema();
      tegn();
    } else if (handling === "huk") {
      hukAv(knapp);
    } else if (handling === "eksporter") {
      eksporterDato(tilstand.dato, knapp);
    } else if (handling === "eksporter-logg") {
      eksporterDato(knapp.dataset.dato, knapp);
    } else if (handling === "apne") {
      apneDato(knapp.dataset.dato);
    } else if (handling === "info") {
      document.getElementById("info")?.showModal();
    } else if (handling === "lukk-info") {
      document.getElementById("info")?.close();
    } else if (handling === "skjul-install") {
      skjulInstall();
      tegn();
    } else if (handling === "installer") {
      installerApp();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.dataset?.felt === "kg" || event.target.dataset?.felt === "reps") {
      oppdaterFelt(event.target);
    } else if (event.target.id === "notat") {
      const okt = tilstand.logg.okter[tilstand.dato];
      if (!okt) return;
      okt.notat = event.target.value;
      skrivLogg(tilstand.logg);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id !== "ukevalg") return;
    const [aar, uke] = event.target.value.split("-").map(Number);
    const plan = tilstand.planer.find((kandidat) => kandidat.aar === aar && kandidat.uke === uke);
    if (!plan) return;
    tilstand.plan = plan;
    tilstand.dato = velgDato(plan, tilstand.iDag);
    tilstand.visning = "uke";
    tegn();
  });

  document.addEventListener("focusout", (event) => {
    const felt = event.target.dataset?.felt;
    if (felt !== "kg" && felt !== "reps") return;
    const ovelseEl = event.target.closest("[data-ovelse]");
    const settEl = event.target.closest("[data-sett]");
    const sett = tilstand.logg.okter[tilstand.dato]?.ovelser?.[ovelseEl?.dataset.ovelse]?.sett?.[Number(settEl?.dataset.sett)];
    if (sett) event.target.value = formatTall(sett[felt]);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
    const felter = [...document.querySelectorAll("#innhold input")];
    const indeks = felter.indexOf(event.target);
    if (indeks >= 0 && felter[indeks + 1]) {
      event.preventDefault();
      felter[indeks + 1].focus();
    }
  });

  document.getElementById("hvile-pluss").addEventListener("click", plussTretti);
  document.getElementById("hvile-stopp").addEventListener("click", stoppHvile);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && hvile && hvile.slutt > Date.now()) holdVaaken();
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (lesTemaValg() === "auto") {
      brukTema();
      if (tilstand.plan) tegn();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event;
    if (tilstand.plan) tegn();
  });
}

async function init() {
  brukTema();
  bind();
  document.getElementById("app").innerHTML = `<p class="laster">Henter ukeplanen…</p>`;
  tilstand.logg = lesLogg();
  try {
    tilstand.planer = await lastPlaner();
    tilstand.plan = velgPlan(tilstand.planer, tilstand.iDag);
    if (!tilstand.plan) throw new Error("tom");
    tilstand.dato = velgDato(tilstand.plan, tilstand.iDag);
    tegn();
    gjenopptaHvile();
  } catch {
    document.getElementById("app").innerHTML = `<p class="feil">Kunne ikke lese ukeplanen. Åpne appen på nett én gang, så virker den også uten nett.</p>`;
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
