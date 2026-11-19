# Voix off Kokoro (voix française ff_siwis) avec la prononciation des noms corrigée en phonétique.
# Lancer depuis video/ :  PYTHONUTF8=1 .venv-kokoro/Scripts/python.exe presentation-mobile/voix.py
import json, os, sys
import kokoro_onnx, soundfile as sf
from kokoro_onnx.tokenizer import Tokenizer

CACHE = os.path.expanduser("~/.cache/hyperframes/tts")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "voice")
SPEED = 1.15

LINES = {
    "hook": "Votre crédit Woyofal tiendra-t-il jusqu'à la fin du mois ?",
    "phone": "Avec Woly Elec, voyez votre crédit restant, en jours.",
    "montant": "L'appli vous dit combien recharger.",
    "tranche": "Restez en tranche un, au meilleur prix.",
    "plan": "Rechargez au meilleur jour.",
    "sim": "Simulez avant de payer.",
    "alertes": "Prévenu avant la coupure, par WhatsApp, SMS ou mail.",
    "ia": "Et l'IA vous explique votre mois.",
    "fin": "Woly Elec. Trente jours gratuits, sur wolyelec point com.",
}

# espeak lit ces mots à l'anglaise : on impose la prononciation française.
FIXES = [
    ("(en)wˈəʊli ɪlˈɛk(fr)", "wɔlˈi elˈɛk"),       # Woly Elec
    ("(en)wˈɒlɪˌɛlɛk(fr)", "wɔliːelˈɛk"),           # wolyelec (adresse)
    ("wwajofˈal", "wɔjɔfˈal"),                      # Woyofal
    ("(en)wɒts(fr) ˈap", "wˈatsap"),                # WhatsApp
    ("(en)mˈeɪl(fr)", "mˈɛl"),                      # mail
    ("ljˈa", "lˌiˈa"),                              # l'IA
]

tok = Tokenizer()
model = kokoro_onnx.Kokoro(os.path.join(CACHE, "models", "kokoro-v1.0.onnx"),
                           os.path.join(CACHE, "voices", "voices-v1.0.bin"))
only = sys.argv[1:] or list(LINES)
result = {}
for key in only:
    ph = tok.phonemize(LINES[key], "fr-fr")
    for a, b in FIXES:
        ph = ph.replace(a, b)
    assert "(en)" not in ph, (key, ph)
    samples, rate = model.create(ph, voice="ff_siwis", speed=SPEED, lang="fr-fr", is_phonemes=True)
    path = os.path.join(OUT, f"{key}.wav")
    sf.write(path, samples, rate)
    result[key] = {"duration": round(len(samples) / rate, 3), "phonemes": ph}
print(json.dumps(result, ensure_ascii=False, indent=1))
