---
name: Tenuta Briantea
description: Cascina, osteria e residenze nel verde della Brianza. Impostazione editoriale a capitoli, archi del portico, carta e miele.
colors:
  paper: "#F2ECE0"
  paper-deep: "#E7DDCA"
  paper-light: "#F8F4EC"
  wedding: "#EEE3CC"
  honey: "#B07D2A"
  honey-bright: "#D3A24D"
  honey-pale: "#EAD7AC"
  walnut: "#2F2219"
  walnut-2: "#46342A"
  oak: "#8A6B4C"
  moss: "#3E4530"
  moss-2: "#525B3F"
  sage: "#8E9677"
  ink: "#2B241D"
  ink-soft: "#6B5F50"
  on-dark: "#EFE6D4"
  on-dark-soft: "#BFB299"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2.5rem, 5.2vw, 4.8rem)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.012em"
    fontVariation: "\"SOFT\" 60, opsz auto"
  title:
    fontFamily: "Fraunces, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(1.7rem, 2.4vw, 2.2rem)"
    fontWeight: 400
    lineHeight: 1.1
  body:
    fontFamily: "EB Garamond, Garamond, Georgia, serif"
    fontSize: "clamp(18px, 1.15vw, 20px)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "EB Garamond, Garamond, Georgia, serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.24em"
rounded:
  none: "0"
  arch: "999px 999px 0 0"
  pill: "999px"
spacing:
  gutter: "clamp(20px, 4.2vw, 64px)"
  section: "clamp(90px, 12vw, 170px)"
  max: "1440px"
components:
  button-honey:
    backgroundColor: "{colors.honey}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.none}"
  button-honey-on-dark-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.walnut}"
  button-line:
    textColor: "{colors.on-dark}"
    rounded: "{rounded.none}"
  image-arch:
    rounded: "{rounded.arch}"
---

# Design System: Tenuta Briantea

> Documento ricavato dal codice esistente (`css/style.css`, pagine HTML) con `/impeccable extract`, in modalità scan.
> I nomi descrittivi e la "stella polare" sono dedotti dai commenti e dalle scelte del sito: vanno confermati.

## Overview

**Creative North Star: "Il registro della cascina"**

Un libro di casa più che un sito d'albergo: capitoli numerati in romano, filetti sottili, testi brevi e caldi, parole in dialetto brianzolo ("Benvegnù", "Pian pianin"). Le immagini sono incorniciate dagli archi del portico lombardo; i colori vengono dalla carta, dal miele, dal legno di noce e dal muschio. Il ritmo è lento e ampio, con molto spazio bianco e poche azioni per schermata.

**Caratteristiche chiave:**
- Capitoli I–VII ripresi nel menu, nelle intestazioni di sezione e nelle copertine.
- Arco (`border-radius: 999px 999px 0 0`) come cornice ricorrente delle foto.
- Copertine a tutto schermo: sequenza scroll-driven in home, cinemagraph in loop nelle pagine interne.
- Dettagli vivi: il "Lunario" (data, meteo, alba e tramonto, luna, piatto di stagione) e il mese corrente evidenziato.
- Nessuna ombra strutturale: la profondità viene da fasce di colore pieno.

## Colors

Una palette calda e terrosa: carta chiara come base, miele come unico accento, noce e muschio per le fasce scure.

### Primary
- **Miele di castagno** (#B07D2A): accento unico. Parole in corsivo dei titoli, numeri dei capitoli, pulsanti principali, focus.
- **Miele chiaro** (#D3A24D): lo stesso accento sulle fasce scure.

### Neutral
- **Carta** (#F2ECE0): fondo di pagina.
- **Carta profonda** (#E7DDCA) e **Carta chiara** (#F8F4EC): riquadri, form, sfondi delle immagini.
- **Avorio nuziale** (#EEE3CC): fascia dei matrimoni.
- **Noce** (#2F2219, #46342A): fascia dell'osteria, con una venatura in SVG.
- **Muschio** (#3E4530, #525B3F): fascia dell'invito finale, `theme-color`.
- **Inchiostro** (#2B241D) e **Inchiostro tenue** (#6B5F50): testo e testo secondario.
- **Avorio su scuro** (#EFE6D4, #BFB299): testo sulle fasce scure e sulle copertine.
- **Filetti**: `rgba(47,34,25,.16)` e `.38`; su scuro `rgba(239,230,212,.16)`.

### Named Rules
**La regola del miele.** Il miele è l'unico colore d'accento. Non si introducono altri colori saturi.

## Typography

**Display Font:** Fraunces (variabile: opsz, SOFT), con Iowan Old Style e Georgia come ripiego
**Body Font:** EB Garamond, con Garamond e Georgia come ripiego

**Character:** un serif morbido e ottico per i titoli, un Garamond da libro per il testo. Il corsivo con SOFT 100 e il colore miele fanno da "voce" di ogni titolo.

### Hierarchy
- **Display** (300, `clamp(2.5rem, 5.2vw, 4.8rem)`, 1.02): titoli h1/h2 delle sezioni e delle copertine.
- **Title** (400, `clamp(1.7rem, 2.4vw, 2.2rem)`, 1.1): nomi delle residenze, h3.
- **Body** (400, `clamp(18px, 1.15vw, 20px)`, 1.6): testo corrente.
- **Label** (600, 0.72rem, tracking 0.24em, maiuscolo): etichette, nomi dei capitoli, link testuali (`.link`, ~0.68rem), pulsanti (~0.8rem).

### Named Rules
**La regola del corsivo.** Ogni titolo chiude con una sola parola in corsivo miele.

## Layout

- Contenitore `.wrap`: massimo 1440px più i margini laterali (`--gutter`, da 20 a 64px).
- Ritmo verticale `--space`, da 90 a 170px, tra le sezioni.
- Griglie: `.grid12` (foto e testo affiancati, alternati con `.teaser--rev`), `.two` (titolo e testo), `.portico` (4 archi in fila), `.wide` (foto 21:9 con titolo sovrapposto).
- Breakpoint: 1180px (la navigazione diventa menu), 900px (le colonne si impilano), 600px e 480px (rifiniture mobile).
- Header alto 112px, trasparente sulle copertine e pieno dopo lo scorrimento. Su mobile c'è una barra di prenotazione fissa in basso.

## Elevation & Depth

Sistema piatto, con profondità data da fasce tonali (carta → avorio → noce → muschio) e da cornici a filetto con `outline-offset`. Le ombre compaiono solo su oggetti "fisici": la foto del lightbox, il cartiglio e le schede sollevate.

## Shapes

- **Arco del portico** (`999px 999px 0 0`): cornice delle foto principali, con un filetto distanziato.
- **Angolo vivo** (0): pulsanti, campi, riquadri.
- **Pillola**: solo per il pulsante "Ferma l'animazione".
- **Cerchio**: pulsanti del lightbox.

## Components

- **Pulsante miele** (`.btn-honey`): fondo miele, testo carta chiara, maiuscolo spaziato. Su fondo scuro, all'hover, diventa carta su noce.
- **Pulsante a filetto** (`.btn-line`): solo bordo, per l'azione secondaria sulle fasce scure.
- **Link testuale** (`.link`): maiuscolo spaziato con una sottolineatura che si riempie all'hover (`background-size`).
- **Intestazione di capitolo** (`.chapter-head`): filetto superiore, numero romano in miele e nome in maiuscoletto.
- **Campo del form**: solo filetto inferiore, che diventa miele al focus.
- **Copertina di pagina** (`.page-hero`): foto o cinemagraph, velatura, numero del capitolo e h1.

### Movimento
- Curva di casa: `--ease: cubic-bezier(.2, .7, .2, 1)`.
- `.reveal`: dissolvenza e salita di 22px in 1,1s.
- `.curtain`: foto che entrano con opacità, sfocatura e scala (fino a 2,6s), sfalsate di 0,18s.
- Transizione di pagina con View Transitions (0,35s in uscita, 0,55s in entrata).
- `prefers-reduced-motion` è rispettato ovunque.

## Do's and Don'ts

- **Do** usare i numeri romani e il nome del capitolo per ogni nuova sezione.
- **Do** incorniciare le foto verticali con l'arco.
- **Do** scrivere testi brevi, in seconda persona plurale ("Scriveteci", "Indicateci").
- **Don't** aggiungere colori d'accento oltre al miele.
- **Don't** usare angoli arrotondati su pulsanti e campi.
- **Don't** mettere testo sui toni chiari delle copertine (finestra, bagliore).

### Incoerenze trovate durante l'estrazione
- Dimensioni del maiuscoletto non allineate: `.label` 0.72rem, `.link` ~0.68rem, `.chapter-name` ~0.74rem, `.btn` 0.8rem. Conviene ridurle a un solo valore leggibile.
- Durate del movimento molto disperse (0,3s, 0,35s, 0,4s, 0,45s, 0,5s, 0,6s, 0,8s, 1,1s, 1,2s, 2,4s, 2,6s) e quattro curve oltre `--ease`.
- Il testo carta chiara sul miele ha contrasto 3,29:1, sotto la soglia AA per il testo piccolo dei pulsanti.
