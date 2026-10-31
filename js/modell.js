// Rent datalag for ukeplanen og loggen.
// Ny uke: legg en JSON-fil i data/ og før opp filnavnet i data/uker.json.

const UKEDAG = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const UKEDAG_KORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const MND = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

export function parseDato(iso) {
  const [aar, maned, dag] = iso.split("-").map(Number);
  return new Date(aar, maned - 1, dag);
}

export function isoDato(dato) {
  const maned = String(dato.getMonth() + 1).padStart(2, "0");
  const dag = String(dato.getDate()).padStart(2, "0");
  return `${dato.getFullYear()}-${maned}-${dag}`;
}

export function dagerSortert(plan) {
  return [...(plan?.dager || [])].sort((a, b) => a.dato.localeCompare(b.dato));
}

function startDato(plan) {
  return dagerSortert(plan)[0]?.dato || "9999-99-99";
}

export function velgPlan(planer, iDag) {
  if (!planer?.length) return null;
  const treff = planer.filter((plan) => (plan.dager || []).some((dag) => dag.dato === iDag));
  if (treff.length) {
    return [...treff].sort((a, b) => (a.aar - b.aar) || (a.uke - b.uke)).at(-1);
  }
  const sortert = [...planer].sort((a, b) => startDato(a).localeCompare(startDato(b)));
  const neste = sortert.find((plan) => startDato(plan) > iDag);
  return neste || sortert.at(-1);
}

export function velgDato(plan, iDag) {
  const dager = dagerSortert(plan);
  if (!dager.length) return iDag;
  if (dager.some((dag) => dag.dato === iDag)) return iDag;
  const neste = dager.find((dag) => dag.dato > iDag);
  return (neste || dager.at(-1)).dato;
}

export function ukedagKort(iso) {
  return UKEDAG_KORT[parseDato(iso).getDay()];
}

export function datoLang(iso) {
  const dato = parseDato(iso);
  return `${UKEDAG[dato.getDay()]} ${dato.getDate()}. ${MND[dato.getMonth()]}`;
}

export function periodeTekst(plan) {
  const dager = dagerSortert(plan);
  if (!dager.length) return "";
  const fra = parseDato(dager[0].dato);
  const til = parseDato(dager.at(-1).dato);
  if (fra.getMonth() === til.getMonth() && fra.getFullYear() === til.getFullYear()) {
    return `${fra.getDate()}.–${til.getDate()}. ${MND[fra.getMonth()]}`;
  }
  return `${fra.getDate()}. ${MND[fra.getMonth()]} – ${til.getDate()}. ${MND[til.getMonth()]}`;
}

export function dagNavn(dag) {
  if (dag?.navn) return dag.navn;
  if (dag?.type === "hvile") return "Hvile";
  if (dag?.type === "kondisjon") return "Kondisjon";
  return "Økt";
}

export function dagKort(dag) {
  const navn = dagNavn(dag);
  const styrke = /^Styrke\s+(\S+)/.exec(navn);
  if (styrke) return styrke[1];
  if (/langtur/i.test(navn)) return "Tur";
  if (/løp/i.test(navn)) return "Løp";
  if (dag?.type === "hvile") return "Hvile";
  return navn.split(/\s+/)[0];
}

export function typeTekst(type) {
  if (type === "styrke") return "Styrke";
  if (type === "kondisjon") return "Kondisjon";
  if (type === "hvile") return "Hvile";
  return "Økt";
}

export function oktId(dag) {
  const navn = dagNavn(dag);
  const id = navn
    .toLocaleLowerCase("nb")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || "okt";
}

export function filnavnForOkt(dag) {
  return `${dag.dato}_${oktId(dag)}.json`;
}

export function repsTekst(ovelse) {
  const spenn = ovelse.repsMin === ovelse.repsMaks
    ? String(ovelse.repsMin)
    : `${ovelse.repsMin}–${ovelse.repsMaks}`;
  if (ovelse.enhet === "sek") return `${spenn} sekunder`;
  if (ovelse.enhet === "per side") return `${spenn} per side`;
  return `${spenn} repetisjoner`;
}

export function repsFeltnavn(enhet) {
  if (enhet === "sek") return "Sek";
  if (enhet === "per side") return "Per side";
  return "Reps";
}

export function hvileTekst(sekunder) {
  const sekunderTall = Number(sekunder);
  if (!sekunderTall) return "";
  const minutter = Math.floor(sekunderTall / 60);
  const rest = sekunderTall % 60;
  if (minutter && rest) return `${minutter} min ${rest} sek`;
  if (minutter === 1) return "1 min";
  if (minutter) return `${minutter} min`;
  return `${rest} sek`;
}

export function rirSetning(rir) {
  if (rir == null || String(rir).trim() === "") return "";
  const verdi = String(rir).trim().replace("-", "–");
  if (verdi === "1") return "RIR 1: stopp når du har omtrent 1 repetisjon igjen.";
  if (verdi === "2") return "RIR 2: stopp når du har omtrent 2 repetisjoner igjen.";
  if (verdi === "1–2") return "RIR 1–2: stopp når du har 1 eller 2 repetisjoner igjen.";
  return `RIR ${verdi}: stopp når du har så mange repetisjoner igjen.`;
}

export function supersettTekst(ovelse, ovelser) {
  if (!ovelse?.supersettMed) return "";
  const annen = (ovelser || []).find((kandidat) => kandidat.id === ovelse.supersettMed);
  const navn = annen?.navn || ovelse.supersettMed;
  return `Supersett med ${navn}. Gjør øvelsene rett etter hverandre.`;
}

export function parseTall(verdi) {
  if (typeof verdi === "number") return Number.isFinite(verdi) && verdi >= 0 ? verdi : null;
  if (verdi == null) return null;
  const tekst = String(verdi).trim().replace(",", ".");
  if (!tekst) return null;
  const tall = Number(tekst);
  if (!Number.isFinite(tall) || tall < 0) return null;
  return tall;
}

export function formatTall(tall) {
  if (tall == null || !Number.isFinite(Number(tall))) return "";
  return String(tall).replace(".", ",");
}

export function formatKlokke(sekunder) {
  const helt = Math.max(0, Math.ceil(sekunder));
  const minutter = Math.floor(helt / 60);
  const rest = helt % 60;
  return `${minutter}:${String(rest).padStart(2, "0")}`;
}

function settTeller(sett) {
  return Boolean(sett) && (sett.ferdig || (!sett.forslag && (sett.kg != null || sett.reps != null)));
}

export function finnSist(okter, ovelseId, foerDato) {
  const datoer = Object.keys(okter || {}).filter((dato) => dato < foerDato).sort().reverse();
  for (const dato of datoer) {
    const ovelse = okter[dato]?.ovelser?.[ovelseId];
    if (ovelse?.sett?.some(settTeller)) return ovelse;
  }
  return null;
}

export function byggOkt(dag, eksisterende, alleOkter) {
  const okt = {
    dato: dag.dato,
    okt: oktId(dag),
    notat: eksisterende?.notat || "",
    ovelser: {},
  };
  const gamle = eksisterende?.ovelser || {};
  for (const ovelse of dag.ovelser || []) {
    const har = gamle[ovelse.id];
    if (har?.sett?.length) {
      const sett = har.sett.slice(0, ovelse.sett).map((rad) => ({
        kg: rad?.kg ?? null,
        reps: rad?.reps ?? null,
        ferdig: Boolean(rad?.ferdig),
        forslag: Boolean(rad?.forslag) && !rad?.ferdig,
        ...(rad?.rir != null && rad.rir !== "" ? { rir: rad.rir } : {}),
      }));
      while (sett.length < ovelse.sett) {
        sett.push({ kg: null, reps: null, ferdig: false, forslag: false });
      }
      okt.ovelser[ovelse.id] = { navn: ovelse.navn, sett };
    } else {
      const sist = finnSist(alleOkter, ovelse.id, dag.dato);
      okt.ovelser[ovelse.id] = {
        navn: ovelse.navn,
        sett: Array.from({ length: ovelse.sett }, (_, indeks) => {
          const kilde = sist?.sett?.[indeks];
          const kg = kilde?.kg ?? null;
          const reps = kilde?.reps ?? null;
          return {
            kg,
            reps,
            ferdig: false,
            forslag: kg != null || reps != null,
          };
        }),
      };
    }
  }
  return okt;
}

function settTilEksport(sett) {
  return (sett || []).filter(settTeller).map((rad) => {
    const ut = { kg: rad.kg ?? null, reps: rad.reps ?? null };
    if (rad.rir != null && rad.rir !== "") ut.rir = rad.rir;
    return ut;
  });
}

export function byggEksport(dag, okt) {
  return {
    versjon: 1,
    dato: dag.dato,
    okt: oktId(dag),
    notat: (okt?.notat || "").trim(),
    ovelser: (dag.ovelser || []).map((ovelse) => ({
      id: ovelse.id,
      navn: ovelse.navn,
      sett: settTilEksport(okt?.ovelser?.[ovelse.id]?.sett),
    })),
  };
}

export function byggEksportFraLagret(okt) {
  return {
    versjon: 1,
    dato: okt.dato,
    okt: okt.okt,
    notat: (okt?.notat || "").trim(),
    ovelser: Object.entries(okt?.ovelser || {}).map(([id, ovelse]) => ({
      id,
      navn: ovelse.navn || id,
      sett: settTilEksport(ovelse.sett),
    })),
  };
}

export function erLogget(okt) {
  if (!okt) return false;
  if ((okt.notat || "").trim()) return true;
  return Object.values(okt.ovelser || {}).some((ovelse) => (ovelse.sett || []).some(settTeller));
}

export function tellSett(okt) {
  let ferdig = 0;
  let antall = 0;
  for (const ovelse of Object.values(okt?.ovelser || {})) {
    for (const sett of ovelse.sett || []) {
      antall += 1;
      if (sett.ferdig) ferdig += 1;
    }
  }
  return { ferdig, antall };
}
