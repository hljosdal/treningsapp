const LOG_NOKKEL = "harry-trening-logg-v1";
const TEMA_NOKKEL = "harry-trening-tema";
const HVILE_NOKKEL = "harry-trening-hvile";
const INSTALL_NOKKEL = "harry-trening-install-skjult";

export function lesLogg() {
  try {
    const raw = localStorage.getItem(LOG_NOKKEL);
    if (!raw) return { okter: {} };
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.okter || typeof data.okter !== "object") {
      return { okter: {} };
    }
    return data;
  } catch {
    return { okter: {} };
  }
}

export function skrivLogg(data) {
  try {
    localStorage.setItem(LOG_NOKKEL, JSON.stringify(data));
  } catch {
    /* Lageret kan være fullt. Økta blir værende i minnet til neste forsøk. */
  }
}

export function lesTemaValg() {
  const verdi = localStorage.getItem(TEMA_NOKKEL);
  return verdi === "lys" || verdi === "mork" ? verdi : "auto";
}

export function skrivTemaValg(verdi) {
  try {
    localStorage.setItem(TEMA_NOKKEL, verdi);
  } catch {
    /* ignorer */
  }
}

export function lesHvile() {
  try {
    const raw = localStorage.getItem(HVILE_NOKKEL);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.slutt !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function skrivHvile(data) {
  try {
    if (!data) localStorage.removeItem(HVILE_NOKKEL);
    else localStorage.setItem(HVILE_NOKKEL, JSON.stringify(data));
  } catch {
    /* ignorer */
  }
}

export function installErSkjult() {
  return localStorage.getItem(INSTALL_NOKKEL) === "1";
}

export function skjulInstall() {
  try {
    localStorage.setItem(INSTALL_NOKKEL, "1");
  } catch {
    /* ignorer */
  }
}
