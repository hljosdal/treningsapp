# Trening

Harry sin personlige treningsapp. Den brukes på telefonen på SATS for å følge PT-ens ukeplan og logge det han løfter.

All tekst i appen er på enkel norsk bokmål.

## Mål

Gjøre styrkeøkten enkel å følge mens han står ved apparatet: se dagens økt, skrive kg og reps, hvile, og ta med seg loggen hjem.

## Funksjoner (v1)

- Åpner på dagens økt. Ligger dagen utenfor planen, vises neste dag i planen, med en kort forklaring.
- Bytt dag med knappene øverst. Styrke A (tirsdag), B (torsdag) og C (lørdag) er hovedøktene.
- Kondisjon og hvile vises enkelt, med pulssone, varighet og beskrivelse der planen har det.
- Hver styrkeøvelse viser sett, repetisjoner (eller sekunder / per side), RIR med vanlig forklaring, hviletid, teknikk-tips og supersett.
- Oppvarming står øverst i styrkeøkta. Progresjon og sikkerhet ligger bak knappen «Progresjon og sikkerhet».
- Per sett: store felt for kg og reps, avhuking, og en hvileklokke som starter når settet hukes av. Klokken bruker øvelsens hviletid og har **+30 s** og **Stopp**.
- Kg og reps fylles ut fra forrige loggførte økt med samme øvelse, om den finnes. Tallene telles ikke med i eksporten før settet endres eller hukes av.
- Logg og notat lagres i nettleseren (localStorage). De blir værende om siden lastes på nytt.
- Fungerer uten nett etter første besøk, og kan legges på hjemskjermen.
- Lys og mørk visning.

## Logging og eksport

1. Velg dagen og skriv kg og reps for hvert sett.
2. Huk av settet når det er gjort. Hvilen starter.
3. Skriv gjerne et notat. Alt lagres med en gang på telefonen.
4. Trykk **Ferdig / eksporter**.

Appen lager én JSON-fil per økt, med navn som `2026-11-03_styrke-a.json`:

```json
{
  "versjon": 1,
  "dato": "2026-11-03",
  "okt": "styrke-a",
  "notat": "",
  "ovelser": [
    {
      "id": "benkpress",
      "navn": "Benkpress (stang)",
      "sett": [{ "kg": 60, "reps": 8 }]
    }
  ]
}
```

`okt` er navnet på økta som filnavn: `styrke-a`, `padel`, `rolig-lop`, `hvile` og så videre. `rir` tas bare med hvis det er fylt ut på settet.

På telefonen åpnes delingsarket (Web Share API), så filen kan lagres i OneDrive-mappen `Grok Bot/20-PT/Logg`. Finnes ikke deling, lastes filen ned i stedet.

Logg-fanen viser tidligere økter og kan eksportere dem på nytt.

Ingenting sendes til en server. Loggen ligger bare på telefonen til den eksporteres.

## Ny ukeplan

Appen leser `data/uker.json` og henter hver fil som står der. Uken som inneholder dagens dato, vises. Finnes ingen slik uke, vises neste uke, ellers den siste.

1. Legg den nye filen i `data/`, for eksempel `data/ukeplan-uke46-2026.json`.
2. Bruk samme felt som uke 45: `versjon`, `uke`, `aar`, `program`, `ukeIProgram`, `antallUker`, `dager`, `progresjon`, `notater`.
3. En dag har `dato` og `type` (`styrke`, `kondisjon` eller `hvile`). Styrke har `navn`, `fokus`, `oppvarming` og `ovelser`. Kondisjon har `navn`, `pulssone`, `varighetMin` og `beskrivelse`.
4. En øvelse har `id`, `navn`, `sett`, `repsMin`, `repsMaks`, `enhet` (`reps`, `sek` eller `per side`), `rir`, `hvileSek`, `kg`, `tips` og `supersettMed`.
5. Behold samme `id` på en øvelse som går igjen, så forrige kg og reps fylles inn.
6. Legg filnavnet inn i lista i `data/uker.json`.
7. Commit og push til `main`. GitHub Pages publiserer på nytt.

## Kjøre lokalt

Tjenestearbeideren krever en webserver, ikke `file://`.

```bash
python3 -m http.server 8080
```

Åpne `http://localhost:8080/`. Testene kjøres med `node --test`.

## Publisering

Nettstedet publiseres til GitHub Pages fra `main` med [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

Adressen er [https://hljosdal.github.io/treningsapp/](https://hljosdal.github.io/treningsapp/).

Første gang må Pages slås på av noen med admin på repoet: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Kjør deretter workflowen «Publiser til GitHub Pages» på nytt. Selve publiseringen kan ikke slå på Pages med tokenet som Actions har.

## Status

**v1.** Ukeplanen følger med i appen. Loggen lagres på telefonen og eksporteres som én JSON-fil per økt.

**Planlagt i v2:** automatisk synk til OneDrive via Microsoft-innlogging, til mappen `Grok Bot/20-PT/Logg`.
