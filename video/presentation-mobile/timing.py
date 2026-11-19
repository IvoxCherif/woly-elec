# Calage du film : scènes, voix, musique et effets dans index.html. Relancer : python timing.py
# Les durées de voix viennent de voix.py ; chaque effet est placé pour que son pic tombe un frame après l'image.
import re

SCENES = [  # (id, durée)
    ("hook", 3.4), ("phone", 4.0), ("montant", 2.4), ("tranche", 2.1), ("plan", 1.9),
    ("sim", 1.8), ("alertes", 3.2), ("ia", 1.9), ("fin", 3.8),
]
VOICE = {  # id: (décalage dans la scène, durée)
    "hook": (0.05, 3.029), "phone": (0.1, 2.88), "montant": (0.1, 1.664), "tranche": (0.08, 1.707),
    "plan": (0.05, 1.408), "sim": (0.05, 1.259), "alertes": (0.1, 2.859), "ia": (0.05, 1.536), "fin": (0.15, 3.008),
}
PEAK = {"whoosh": 0.649, "swoosh": 0.897, "pop": 0.105, "notification": 0.111, "impact": 0.755}
SFX = [  # (id, scène, instant de l'image dans la scène, son, durée, volume, fondu)
    ("phone", "phone", 0.05, "whoosh", 1.9, 0.3, 0.3),
    ("montant", "montant", 0.0, "swoosh", 1.5, 0.28, 0.3),
    ("tranche", "tranche", 0.0, "whoosh", 1.9, 0.28, 0.3),
    ("plan", "plan", 0.55, "pop", 0.45, 0.5, None),
    ("sim", "sim", 0.0, "swoosh", 1.5, 0.28, 0.3),
    ("alerte1", "alertes", 0.55, "notification", 0.6, 0.4, None),
    ("alerte2", "alertes", 0.9, "notification", 0.6, 0.4, None),
    ("ia", "ia", 0.0, "pop", 0.45, 0.5, None),
    ("fin", "fin", 0.35, "impact", 2.6, 0.4, 0.5),
]
FRAME = 1 / 30

start, t = {}, 0.0
for k, d in SCENES:
    start[k] = round(t, 3)
    t += d
TOTAL = round(t, 3)

s = open("index.html", encoding="utf8").read()
for k, d in SCENES:
    s, n = re.subn(rf'(id="{k}" data-composition-id="{k}" data-composition-src="compositions/{k}.html"\s+data-start=")[0-9.]+(" data-duration=")[0-9.]+',
                   rf"\g<1>{start[k]:g}\g<2>{d:g}", s)
    assert n == 1, k
s, n = re.subn(r'(id="root"[^>]*data-duration=")[0-9.]+', rf"\g<1>{TOTAL:g}", s, flags=re.S); assert n == 1
s, n = re.subn(r'duration: [0-9.]+, ease: "none" \}, 0\);', f'duration: {TOTAL:g}, ease: "none" }}, 0);', s); assert n == 1
s, n = re.subn(r'(duration: 0.4, ease: "power2.inOut" \}, )[0-9.]+', rf'\g<1>{start["phone"]:g}', s); assert n == 2
s, n = re.subn(r'(duration: 0.45, ease: "power2.inOut" \}, )[0-9.]+', rf'\g<1>{start["fin"]:g}', s); assert n == 2

a = "      <!-- Voix off (Kokoro ff_siwis, prononciation corrigée en phonétique : voix.py) : elle donne le tempo des scènes. -->\n"
for k, (off, d) in VOICE.items():
    a += f'      <audio id="vo-{k}" src="assets/voice/{k}.wav" data-start="{start[k] + off:.2f}" data-duration="{d:.2f}" data-volume="1" data-track-index="20"></audio>\n'
a += f'''
      <!-- Musique sous la voix, entrée sur sa partie la plus énergique. -->
      <audio id="bgm" src="assets/bgm/track.mp3" data-start="0" data-duration="{TOTAL:g}" data-media-start="8.5" data-volume="0.16" data-fade-in="0.3" data-fade-out="1.5" data-track-index="30"></audio>

      <!-- Effets sonores (timing.py) : chaque pic tombe un frame après son image. -->
'''
for i, (k, sc, at, f, d, v, fo) in enumerate(SFX):
    st = max(0, start[sc] + at + FRAME - PEAK[f])
    fade = f' data-fade-out="{fo}"' if fo else ""
    a += f'      <audio id="sfx-{k}" src="assets/sfx/{f}.mp3" data-start="{st:.2f}" data-duration="{d:g}" data-volume="{v}"{fade} data-track-index="{10 + i % 2}"></audio>\n'
b, e = s.index("      <!-- Voix off"), s.index("    </div>\n    <script>")
s = s[:b] + a + s[e:]
open("index.html", "w", encoding="utf8").write(s)
print("durée totale", TOTAL, "s ; débuts :", start)
