# Tenuta Briantea · brief per rifare le copertine

Strumento: abbonamento Gemini Pro.
- **Foto**: app Gemini, generazione di immagini (Nano Banana), oppure lo strumento immagini di Flow.
- **Video**: Flow (https://labs.google/flow) con Veo 3.1.

I prompt sono in inglese perché i modelli li seguono meglio. Le spiegazioni sono in italiano.

## Perché rifarle così

Le copertine attuali hanno tre difetti:
1. **La cascina cambia da una copertina all'altra.** Nella home è una villa a U, in Tenuta ha un'altra pianta, in Piscina un'altra ancora. È il segnale più evidente di immagini generate.
2. **Movimenti che l'AI sbaglia.** In Residenze il drappo vola staccato per la stanza.
3. **Loop di 4 secondi con uno stacco visibile**, e una home da 27 MB che scatta.

La procedura qui sotto risolve i primi due. Il terzo lo risolve lo script di preparazione: dissolvenza sullo stacco, compressione e caricamento a richiesta.

**La regola d'oro:** prima si fanno le **foto fisse**, tutte a partire dalla stessa foto di riferimento della cascina. Solo dopo si animano. Non si chiede mai a Veo di inventare l'edificio.

## 1. La "bibbia" della tenuta (da incollare in ogni prompt)

```
THE ESTATE (always identical): a historic Lombard "cascina a corte" in the green hills of Brianza,
northern Italy, seen as a courtyard farmstead. At the head of the courtyard, a three-storey manor
house in faded ochre plaster with grey-blue shutters, a small central dormer and a small iron
balcony. A continuous ground-floor portico of round brick arches, warmly lit, runs along the manor
and the whole west wing, facing the cobbled courtyard with a stone well in the middle. The west
wing is two storeys of exposed river stone and peeling ochre plaster. The east wing is a long
two-storey stone building with grey-blue shutters. In the north-east corner, next to the manor,
a red-brick silkworm barn ("bigattiera") closed by large diamond-pattern terracotta brick lattice
panels. Old terracotta coppi roofs with moss and uneven lines. The courtyard is closed at the
front by a low stone wall with brick gate pillars and an iron gate. A dirt avenue lined with old
pollarded mulberry trees runs diagonally to the gate. A small rectangular pool with a pale stone
edge sits in the meadow in front of the farmstead. Around it: rolling meadows with tractor tracks,
chestnut woods, and on the horizon the jagged saw-toothed limestone ridge of Monte Resegone.
```

La descrizione corrisponde alla foto di riferimento scelta (vista obliqua da sud, 24 novembre).

```
STYLE (always identical): photorealistic editorial travel photography, full-frame camera, natural
light only, soft gentle contrast, subtle fine film grain, muted earthy palette of cream paper,
chestnut honey, walnut brown and moss green, warm tungsten window light. No HDR look, no
oversaturation, no lens flare, no people, no text, no logos, no watermarks.
```

## 2. Prima la foto di riferimento

In Gemini (immagini), formato **16:9**, la qualità più alta disponibile:

```
[THE ESTATE] [STYLE]
Aerial photograph from a drone at about 120 m, three-quarter view from the south-west, at blue
hour just after sunset: the sky fades from deep blue to a thin band of apricot behind the
Resegone, the windows and the portico glow warm, the mulberry avenue leads the eye into the
courtyard, the small pool glows turquoise in the meadow. 16:9.
```

Rigenerala finché **pianta, tetti, archi e bigattiera** sono convincenti, poi salvala come `riferimento.png`.

**Da qui in poi allega sempre `riferimento.png`** e inizia ogni prompt con: `Same estate as the reference image, identical architecture.`

## 3. Home: il volo che avanza scorrendo (5 foto + 4 clip)

Il volo resta legato allo scorrimento, ma diventa **una sola ripresa continua**. Si generano 5 foto chiave (K1–K5) che fanno da tappe. Poi in Flow si anima ogni passaggio con **"Frames to video"**: la foto K1 come primo fotogramma, la K2 come ultimo, e così via. Così le clip combaciano esattamente.

Le foto sono tutte 16:9, alla stessa ora (ora blu), con la stessa luce.

| Foto | Inquadratura | Prompt (dopo bibbia e stile) |
|---|---|---|
| K1 | Lontana, alta | `High wide aerial, 200 m, the whole estate small in the landscape, the Resegone ridge dominant on the horizon, blue hour.` (puoi usare `riferimento.png` stessa) |
| K2 | Avvicinamento | `Aerial at 60 m approaching from the mulberry avenue, the gate and the courtyard ahead, portico glowing, blue hour.` |
| K3 | Dentro la corte | `Low drone shot at 8 m inside the cobbled courtyard, the stone well in the foreground, the seven lit brick arches of the portico ahead, blue hour.` |
| K4 | Alla finestra | `Eye-level shot facing one first-floor window of the east wing, grey-blue shutters open, warm light and a linen curtain inside, blue hour.` |
| K5 | In camera | `Inside the bedroom seen through that window: chestnut ceiling beams, lime-washed walls, a linen-covered bed, one lit bedside lamp, a lit candle, blue window light on the left.` |

Poi in Flow, 4 clip (K1→K2, K2→K3, K3→K4, K4→K5), ognuna di **8 s**, **16:9**, **senza audio**, con questo prompt di movimento:

```
One continuous, slow, perfectly steady forward drone glide, constant speed, no cuts, no camera
shake, no zoom, no rotation. Static scene: nothing moves except the camera.
Architecture stays exactly the same.
```

Fai le prove in **Veo 3.1 Fast** (20 crediti) e la versione finale in **Quality** (100 crediti). Poi **upscale a 1080p**, che per gli abbonati è gratuito.

Se il passaggio K3→K4 (dalla corte alla finestra) non riesce, si può rinunciare al volo verso la finestra: K4 diventa una ripresa che si avvicina alla finestra dalla corte e l'ingresso in camera si risolve con una dissolvenza. La preparo io in fase di montaggio.

## 4. Le copertine delle pagine interne (una foto + una sola clip in loop)

Regola: **una sola clip per copertina**, mai clip unite.

Ogni copertina si fa in due passi:
1. **La foto** in Flow, nella modalità immagini (Nano Banana), formato 16:9. Allegare il riferimento
   indicato (stessa cascina e stessa luce di casa).
2. **La clip** in Flow: Video → **Fotogrammi**, **Veo 3.1 - Fast**, 16:9, 8 s, x2,
   con **Inizio = Fine = la stessa foto**. La clip parte e finisce sullo stesso fotogramma, quindi il
   loop gira senza stacco, e la foto fa anche da poster (il passaggio foto → video non si vede).

Il prompt di ogni clip comincia sempre con:

```
Locked-off tripod shot, the camera does not move at all. The first and the last frame are identical to the reference image. The architecture, furniture and objects never change; nothing appears or disappears; no people, no animals.
```

seguito dal movimento della tabella. Muovere solo luce, fiamme, acqua, nebbia, foglie: sono le cose
che l'AI rende bene. Tessuti in volo, porte, persone e animali vanno evitati.

| Pagina | Allegato | Foto (dopo la frase "Same estate as the reference image, identical architecture.") | Movimento della clip |
|---|---|---|---|
| I · Tenuta | `riferimento.png` | `Real aerial photograph from a drone at 90 metres, three-quarter view from the south-east, the whole farmstead, the mulberry avenue and the pool in the meadows, chestnut woods around, the Resegone ridge on the horizon. Late golden hour, long soft shadows across the fields, warm low sun on the facades.` | `Only the light moves: soft cloud shadows drift very slowly across the meadows from left to right, the leaves of the chestnut woods stir slightly in a light breeze.` |
| II · Residenze | `home-K5.png` | `The same bedroom as the reference, seen from the opposite corner: the open French door with the sheer linen curtain on the right, the wooden bed, the rush-seat chair, chestnut ceiling beams, lime-washed walls, terracotta floor. Blue dusk light through the door, warm lamp and one candle lit.` | `Only the candle flame flickers gently and the warm lamp light breathes very slightly. The curtain hangs still.` |
| III · Osteria | `home-K5.png` (solo per luce e materiali) | `Real interior photograph of the osteria in the manor house: a vaulted room with brick arches and lime-washed walls, terracotta floor, walnut tables set for dinner with linen napkins and wine glasses, rush-seat chairs, a large stone fireplace with a lit fire. Evening, warm firelight and candles, blue dusk light from a small window.` | `Only the fire in the fireplace burns softly and the candle flames flicker. Everything else is still.` |
| IV · Piscina | `riferimento.png` | `Real photograph at eye level from the meadow: the small rectangular pool with its pale stone edge in the foreground, two teak loungers and a closed canvas umbrella, the stone wall of the farmstead behind, the mulberry avenue on the left, the Resegone on the horizon. Late afternoon, warm low sun.` | `Only gentle ripples and soft sun glints move on the water; the grass sways very slightly in a light breeze. The umbrella and loungers are still.` |
| V · Matrimoni | `home-K3-sera.png` | `The same courtyard as the reference at blue hour, set for a wedding dinner: one long table under the lit brick portico with white linen, olive branches and many lit candles, empty wooden chairs, a few strings of warm lights between the arches. No people.` | `Only the candle flames flicker softly and the string lights glow steadily. Nothing else moves.` |
| VI · Prenota | `home-K3-sera.png` | `Under the brick portico of the same courtyard, morning light: two old leather suitcases and a straw hat on the stone floor by a wooden bench, the sunny cobbled courtyard and the stone well seen through the arches.` | Nessuna clip: solo la foto. |
| VII · Contatti | `riferimento.png` | `Real photograph at eye level on the dirt avenue between two rows of old pollarded mulberry trees, the farmstead far at the end of the avenue, the Resegone faint on the horizon. Dawn, low mist lying over the meadows, soft pale light.` | `Only the low mist drifts very slowly across the avenue from left to right. Trees and track are still.` |

Ogni foto finisce con la riga di stile:

```
Shot on a full-frame camera, 35 mm, natural light only, fine sensor noise, muted natural colours, weathered and lived-in, not a 3D render, no HDR, no glow, no people, no text, no watermark.
```

## 5. Come scartare una clip (controllo prima di consegnarla)

Una clip va rifatta se c'è anche uno solo di questi difetti:
- **l'edificio cambia** durante il movimento: archi che si moltiplicano, finestre che spariscono, tetti che si piegano;
- qualcosa **si deforma o si fonde**: gambe dei tavoli, sedie, fiamme che si staccano;
- un oggetto **compare o scompare**;
- la **luce cambia di colpo**, oppure c'è un tremolio;
- ci sono **persone, scritte o loghi**.

Guardala a schermo intero, anche al rallentatore.

## 6. Cosa mandarmi

Per ogni copertina servono la foto (PNG o JPG, la risoluzione massima) e il video (MP4 a 1080p). Questi i nomi da usare:

```
home-K1.png … home-K5.png      home-K1-K2.mp4  home-K2-K3.mp4  home-K3-K4.mp4  home-K4-K5.mp4
tenuta.png      tenuta.mp4
residenze.png   residenze.mp4
osteria.png     osteria.mp4
piscina.png     piscina.mp4
matrimoni.png   matrimoni.mp4
prenota.png
contatti.png    contatti.mp4
```

Puoi caricarli qui in chat o mandarmi un link pubblico di Google Drive. Penso io al resto:
- loop senza stacco;
- compressione in AV1 e H.264;
- poster AVIF e WebP;
- sequenza della home leggera e caricata solo mentre si scorre;
- versione verticale per i telefoni.

I file originali non vanno nel repository: sono pesanti e non servono al sito.

## Budget di crediti (indicativo)

| Voce | Prove | Crediti |
|---|---|---|
| 4 clip della home, prove in Fast | 3 tentativi ciascuna | ~240 |
| 4 clip della home, finale in Quality | 1 ciascuna | ~400 |
| 6 loop delle pagine in Fast | 2–3 tentativi ciascuno | ~300 |
| **Totale** | | **~950**, nei 1.000 mensili più i 50 giornalieri |

Se i crediti non bastano, i loop delle pagine possono restare in Fast: con la camera ferma la differenza si vede poco.
