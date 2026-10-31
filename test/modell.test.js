import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  byggEksport,
  byggOkt,
  datoLang,
  erLogget,
  filnavnForOkt,
  finnSist,
  formatKlokke,
  hvileTekst,
  oktId,
  parseTall,
  periodeTekst,
  repsTekst,
  rirSetning,
  velgDato,
  velgPlan,
} from "../js/modell.js";

const plan = JSON.parse(fs.readFileSync(new URL("../data/ukeplan-uke45-2026.json", import.meta.url)));
const indeks = JSON.parse(fs.readFileSync(new URL("../data/uker.json", import.meta.url)));

function dag(dato) {
  return plan.dager.find((kandidat) => kandidat.dato === dato);
}

test("ukeplanen har forventet form", () => {
  assert.equal(plan.versjon, 1);
  assert.equal(plan.uke, 45);
  assert.equal(plan.aar, 2026);
  assert.equal(plan.program, "Muskelvekst");
  assert.equal(plan.ukeIProgram, 1);
  assert.equal(plan.antallUker, 12);
  assert.equal(plan.dager.length, 7);
  assert.equal(typeof plan.progresjon, "string");
  assert.ok(Array.isArray(plan.notater));
  assert.deepEqual(indeks.filer, ["ukeplan-uke45-2026.json"]);

  const typer = plan.dager.map((d) => d.type);
  assert.deepEqual(typer, ["kondisjon", "styrke", "kondisjon", "styrke", "hvile", "styrke", "kondisjon"]);
  for (const d of plan.dager) {
    assert.match(d.dato, /^\d{4}-\d{2}-\d{2}$/);
    if (d.type !== "styrke") continue;
    assert.ok(d.oppvarming.length >= 1);
    const ider = d.ovelser.map((ovelse) => ovelse.id);
    assert.equal(new Set(ider).size, ider.length);
    for (const ovelse of d.ovelser) {
      assert.equal(typeof ovelse.navn, "string");
      assert.equal(typeof ovelse.sett, "number");
      assert.ok(["reps", "sek", "per side"].includes(ovelse.enhet));
      assert.equal(ovelse.kg, null);
      for (const partner of [ovelse.supersettMed].filter(Boolean)) {
        assert.ok(ider.includes(partner));
      }
    }
  }
  const c = dag("2026-11-07");
  assert.equal(c.ovelser.find((o) => o.id === "hammercurl").supersettMed, "overhead-triceps");
  assert.equal(c.ovelser.find((o) => o.id === "overhead-triceps").supersettMed, "hammercurl");
});

test("økt-id og filnavn", () => {
  assert.equal(oktId(dag("2026-11-02")), "padel");
  assert.equal(oktId(dag("2026-11-03")), "styrke-a");
  assert.equal(oktId(dag("2026-11-04")), "rolig-lop");
  assert.equal(oktId(dag("2026-11-05")), "styrke-b");
  assert.equal(oktId(dag("2026-11-06")), "hvile");
  assert.equal(oktId(dag("2026-11-07")), "styrke-c");
  assert.equal(oktId(dag("2026-11-08")), "rolig-langtur");
  assert.equal(filnavnForOkt(dag("2026-11-03")), "2026-11-03_styrke-a.json");
});

test("dagens økt velges etter dato", () => {
  assert.equal(velgDato(plan, "2026-11-05"), "2026-11-05");
  assert.equal(velgDato(plan, "2026-10-31"), "2026-11-02");
  assert.equal(velgDato(plan, "2026-11-09"), "2026-11-08");
  assert.equal(velgPlan([plan], "2026-11-03"), plan);
  assert.equal(velgPlan([plan], "2026-10-31"), plan);
  assert.equal(periodeTekst(plan), "2.–8. november");
  assert.equal(datoLang("2026-11-03"), "tirsdag 3. november");
});

test("reps, hvile og RIR er forståelig tekst", () => {
  assert.equal(repsTekst(dag("2026-11-03").ovelser[0]), "6–10 repetisjoner");
  assert.equal(repsTekst(dag("2026-11-05").ovelser[2]), "8–12 per side");
  assert.equal(repsTekst(dag("2026-11-05").ovelser[5]), "30–45 sekunder");
  assert.equal(hvileTekst(150), "2 min 30 sek");
  assert.equal(hvileTekst(120), "2 min");
  assert.match(rirSetning("2"), /2 repetisjoner igjen/);
  assert.match(rirSetning("1-2"), /1 eller 2/);
  assert.equal(rirSetning(null), "");
  assert.equal(formatKlokke(150), "2:30");
  assert.equal(parseTall("62,5"), 62.5);
  assert.equal(parseTall(""), null);
});

test("eksport har avtalt form og tar ikke med ufylte forslag", () => {
  const styrke = dag("2026-11-03");
  const okt = byggOkt(styrke, null, {});
  okt.ovelser.benkpress.sett[0] = { kg: 60, reps: 8, ferdig: true, forslag: false };
  okt.ovelser.benkpress.sett[1] = { kg: 60, reps: 8, ferdig: false, forslag: false };
  okt.ovelser.benkpress.sett[2] = { kg: 50, reps: 10, ferdig: false, forslag: true };
  okt.notat = "  God økt  ";
  const eksport = byggEksport(styrke, okt);

  assert.deepEqual(Object.keys(eksport), ["versjon", "dato", "okt", "notat", "ovelser"]);
  assert.equal(eksport.versjon, 1);
  assert.equal(eksport.dato, "2026-11-03");
  assert.equal(eksport.okt, "styrke-a");
  assert.equal(eksport.notat, "God økt");
  assert.equal(eksport.ovelser.length, styrke.ovelser.length);
  assert.equal(eksport.ovelser[0].id, "benkpress");
  assert.equal(eksport.ovelser[0].navn, "Benkpress (stang)");
  assert.deepEqual(eksport.ovelser[0].sett, [
    { kg: 60, reps: 8 },
    { kg: 60, reps: 8 },
  ]);
  assert.deepEqual(Object.keys(eksport.ovelser[0].sett[0]), ["kg", "reps"]);
  assert.deepEqual(eksport.ovelser[1].sett, []);

  okt.ovelser.benkpress.sett[0].rir = 2;
  const medRir = byggEksport(styrke, okt).ovelser[0].sett[0];
  assert.deepEqual(Object.keys(medRir), ["kg", "reps", "rir"]);
  assert.equal(medRir.rir, 2);

  const padel = byggEksport(dag("2026-11-02"), { notat: "", ovelser: {} });
  assert.deepEqual(padel.ovelser, []);
  assert.equal(padel.okt, "padel");
});

test("kg og reps fylles fra forrige økt med samme øvelse", () => {
  const tidligere = {
    "2026-10-27": {
      ovelser: {
        benkpress: {
          sett: [
            { kg: 55, reps: 8, ferdig: true, forslag: false },
            { kg: 55, reps: 7, ferdig: true, forslag: false },
          ],
        },
      },
    },
    "2026-11-03": {
      ovelser: {
        benkpress: {
          sett: [{ kg: 999, reps: 1, ferdig: true, forslag: false }],
        },
      },
    },
  };
  assert.equal(finnSist(tidligere, "benkpress", "2026-11-03").sett[0].kg, 55);
  const okt = byggOkt(dag("2026-11-03"), null, tidligere);
  assert.equal(okt.ovelser.benkpress.sett[0].kg, 55);
  assert.equal(okt.ovelser.benkpress.sett[0].reps, 8);
  assert.equal(okt.ovelser.benkpress.sett[0].forslag, true);
  assert.equal(okt.ovelser.benkpress.sett[0].ferdig, false);
  assert.equal(okt.ovelser.benkpress.sett[2].kg, null);
  assert.equal(erLogget(okt), false);

  okt.ovelser.benkpress.sett[0].ferdig = true;
  okt.ovelser.benkpress.sett[0].forslag = false;
  assert.equal(erLogget(okt), true);
  assert.equal(byggEksport(dag("2026-11-03"), okt).ovelser[0].sett.length, 1);
});

test("nettstedet bruker relative stier", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const manifest = fs.readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8");
  const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.equal(html.includes('src="/') || html.includes('href="/'), false);
  assert.match(html, /lang="nb"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(manifest, /"start_url": "\.\/"/);
  for (const fil of sw.match(/"\.\/[^"]+"/g)) {
    const relativ = fil.slice(1, -1);
    if (relativ === "./") continue;
    const sti = new URL(`../${relativ.slice(2)}`, import.meta.url);
    assert.equal(fs.existsSync(sti), true, relativ);
  }
});
