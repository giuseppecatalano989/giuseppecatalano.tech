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
northern Italy. A closed rectangular courtyard farmstead: two long two-storey wings of exposed
river-stone and warm ochre lime plaster, low-pitched roofs of old terracotta coppi tiles, a
ground-floor portico of seven round brick arches facing the courtyard, grey-blue wooden shutters.
At the head of the courtyard, a three-storey manor house in pale ochre plaster with a small
central dormer. On the east wing, a brick silkworm barn ("bigattiera") whose upper floor is closed
by diamond-pattern terracotta brick lattice. A stone well in the middle of a cobbled courtyard.
A dirt avenue lined with old pollarded mulberry trees leads to the gate. A small rectangular
pool sits alone in the meadow south of the farmstead. Around it: rolling meadows, chestnut woods,
and on the northern horizon the jagged limestone ridge of Monte Resegone.
```

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

## 4. Le copertine delle pagine interne (foto + loop)

Ogni copertina è una foto 16:9, che fa anche da poster, poi animata con **Image to video**. Le regole per l'animazione sono sempre le stesse:

- **camera ferma** (`locked-off tripod shot, the camera does not move`);
- **8 s**, senza audio;
- **un solo movimento piccolo e naturale.** Nebbia, fiamme, acqua, foglie e luce sono cose che l'AI rende bene. Persone, mani, tessuti in volo, porte che si aprono e animali le sbaglia.

| Pagina | Foto (dopo bibbia e stile) | Movimento (prompt video) |
|---|---|---|
| I · Tenuta | `Aerial three-quarter view at 80 m, late golden hour, long soft shadows across the meadows, the whole courtyard and the mulberry avenue visible.` | `Locked-off shot. Only a very slow drift of light: soft clouds' shadows glide across the meadows, leaves of the chestnut woods stir slightly.` |
| II · Residenze | `The Fienile bedroom at dusk: chestnut beams, lime-washed walls, linen bed, wooden chair, bedside lamp lit, one candle lit, open window with a sheer linen curtain hanging still, blue evening light outside.` | `Locked-off shot. The candle flame flickers gently, the sheer curtain sways very slightly at its hem only, the light outside the window dims imperceptibly. Nothing else moves.` |
| III · Osteria | `The osteria dining room in the evening: terracotta floor, walnut tables set for dinner, rush-seat chairs, a large stone fireplace with a lit fire, blue window light.` | `Locked-off shot. The fire in the fireplace burns and crackles softly, candle flames flicker on the tables. Nothing else moves.` |
| IV · Piscina | `The small rectangular pool in the meadow, late afternoon, two teak loungers and a canvas umbrella, the farmstead behind, the Resegone on the horizon.` | `Locked-off shot. Gentle ripples and sun glints move on the water surface, the grass sways slightly in a light breeze, the umbrella fabric is still.` |
| V · Matrimoni | `The courtyard set for a wedding dinner at blue hour: long tables with linen cloths, olive branches and many lit candles, string lights under the seven brick arches. Empty chairs, no people.` | `Locked-off shot. Candle flames flicker softly, the string lights glow steadily. Nothing else moves.` |
| VI · Prenota | `Two old leather suitcases and a straw hat under the brick portico, the sunlit courtyard and the stone well beyond the arches, morning light.` | Nessun video: solo foto, come oggi. |
| VII · Contatti | `The mulberry avenue at dawn in light mist, a dirt track between rows of old pollarded mulberry trees, the farmstead far at the end, the Resegone faint on the horizon.` | `Locked-off shot. Low morning mist drifts slowly across the avenue from left to right, the light warms very slightly. Trees and track are still.` |

Per ogni copertina tieni sia la foto che il video.

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
