# Génère les scènes « carte » (titre + vraies cartes de l'appli). Relancer : python gen_scenes.py (depuis compositions/).
HEAD = '''<template>
  <style>
    #root {{ position: absolute; inset: 0; }}
    #{p}-stage {{ position: absolute; inset: 0; }}
    #{p}-title {{
      position: absolute; left: 130px; top: 300px; width: 750px;
      font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 80px;
      line-height: 1.08; letter-spacing: -0.02em; color: #0b3d2e;
    }}
    #{p}-cam {{ position: absolute; inset: 0; }}
    #{p}-title .w {{ display: inline-block; }}
    #{p}-title .acc {{ color: #1d4ed8; }}
    .{p}-card {{
      position: absolute; left: 50%; overflow: hidden; border-radius: 36px; background: #fff;
      box-shadow: 0 24px 48px rgba(11, 61, 46, 0.14);
    }}
    .{p}-card img {{ display: block; }}
{extra_css}
  </style>
  <div id="root" data-composition-id="{p}" data-width="1080" data-height="1920">
    <div id="{p}-stage">
      <h2 id="{p}-title" class="clip" data-start="0" data-duration="{dur}">{title}</h2>
      <div id="{p}-cam">
{cards}
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{script}
    window.__timelines["{p}"] = tl;
  </script>
</template>
'''
def words(t):
    return ' '.join(f'<span class="w acc">{w[1:]}</span>' if w.startswith('*') else f'<span class="w">{w}</span>' for w in t.split(' '))

def card(p, cid, src, alt, top, width, srcw, srch, crop_top=0, crop_h=None, dur=3, radius=None):
    sc = width/srcw
    h = round((crop_h if crop_h else srch-crop_top)*sc)
    mt = -round(crop_top*sc)
    r = f'border-radius:{radius}px;' if radius is not None else ''
    return (f'      <div id="{p}-{cid}" class="{p}-card clip" data-start="0" data-duration="{dur}" '
            f'style="top:{top}px;width:{width}px;height:{h}px;margin-left:-{width//2}px;{r}">\n'
            f'        <img src="assets/app/{src}" alt="{alt}" style="width:{width}px;margin-top:{mt}px" />\n      </div>')

WORD_IN = 'tl.fromTo("#{p}-title .w", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.12, stagger: 0.05, ease: "power4.out" }}, {t});'
LINE_IN = 'tl.fromTo("#{p}-title", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.18, ease: "power4.out" }}, {t});'
ENTER = {
 'zoom':  'tl.fromTo("#{p}-stage", {{ scale: 1.35, opacity: 0, filter: "blur(14px)" }}, {{ scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.38, ease: "expo.out" }}, 0);',
 'whipup':'tl.fromTo("#{p}-stage", {{ y: 760, filter: "blur(18px)" }}, {{ y: 0, filter: "blur(0px)", duration: 0.34, ease: "expo.out" }}, 0);',
 'whipleft':'tl.fromTo("#{p}-stage", {{ x: 900, filter: "blur(18px)" }}, {{ x: 0, filter: "blur(0px)", duration: 0.34, ease: "expo.out" }}, 0);',
 'blur':  'tl.fromTo("#{p}-stage", {{ opacity: 0, filter: "blur(10px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }}, 0);',
}
EXIT = {
 'whipup':  'tl.to("#{p}-stage", {{ y: -760, filter: "blur(18px)", duration: 0.2, ease: "power3.in" }}, {t});',
 'whipleft':'tl.to("#{p}-stage", {{ x: -900, filter: "blur(18px)", duration: 0.2, ease: "power3.in" }}, {t});',
 'blur':    'tl.to("#{p}-stage", {{ opacity: 0, filter: "blur(10px)", duration: 0.18, ease: "power3.in" }}, {t});',
}
def scene(p, dur, title, titlemode, enter, exitm, cards_spec, extra_script='', extra_css='', extra_html='', punch=None):
    cards = [card(p, dur=dur, **c) for c in cards_spec]
    pl = ''
    if punch:
        at, origin, sc_ = punch
        pl = (f'tl.fromTo("#{p}-cam", {{ scale: 1 }}, {{ scale: {sc_}, transformOrigin: "{origin}", duration: 0.35, ease: "power2.inOut" }}, {at});')
    sc = [ENTER[enter].format(p=p), (WORD_IN if titlemode == 'word' else LINE_IN).format(p=p, t=0.12), extra_script, pl,
          EXIT[exitm].format(p=p, t=round(dur-0.2 if exitm != 'blur' else dur-0.18, 2))]
    s = HEAD.format(p=p, dur=dur, title=words(title), cards='\n'.join(cards)+extra_html,
                    script='\n'.join('    '+x for x in sc if x), extra_css=extra_css)
    open(f'{p}.html', 'w', encoding='utf8').write(s)

# Montant : la partie basse de la carte jauge (consommation prévue, montant, bouton).
scene('montant', 2.4, '*Combien recharger pour finir le mois ?', 'word', 'zoom', 'whipup', punch=(1.0, '300px 640px', 1.22), cards_spec=
  [dict(cid='card', src='gauge.png', alt='Montant à recharger', top=612, width=900, srcw=1086, srch=1974, crop_top=960, crop_h=790)])

scene('tranche', 2.1, 'Restez en *tranche 1.', 'word', 'whipup', 'blur', punch=(0.85, '540px 840px', 1.15), cards_spec=
  [dict(cid='card', src='tranche.png', alt='Tranche actuelle', top=580, width=960, srcw=1086, srch=645)])

scene('plan', 1.9, 'Le *meilleur *jour pour recharger.', 'word', 'blur', 'whipup', punch=(1.0, '540px 730px', 1.12), cards_spec=
  [dict(cid='card', src='plan.png', alt='Plan du mois', top=540, width=960, srcw=1086, srch=477),
   dict(cid='rappel', src='rappel.png', alt='Rappel de recharge', top=990, width=960, srcw=1086, srch=255)],
  extra_script='tl.fromTo("#plan-rappel", { x: -140, opacity: 0, filter: "blur(10px)" }, { x: 0, opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "expo.out" }, 0.5);')

# Simulateur : le champ montant puis les résultats (deux morceaux réels de la même carte).
scene('sim', 1.8, 'Simulez *avant de payer.', 'word', 'whipup', 'whipleft', punch=(0.85, '800px 560px', 1.16), cards_spec=
  [dict(cid='input', src='sim.png', alt='Montant à recharger : 10 000 F', top=540, width=900, srcw=1086, srch=1677, crop_h=340),
   dict(cid='res', src='sim.png', alt='Résultat : 76,4 kWh, 14 jours', top=862, width=900, srcw=1086, srch=1677, crop_top=700, crop_h=470)],
  extra_script='tl.fromTo("#sim-res", { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "expo.out" }, 0.45);')

scene('alertes', 3.2, 'Prévenu *avant *la *coupure.', 'word', 'whipleft', 'blur', cards_spec=
  [dict(cid='reco', src='al_reco.png', alt='Alerte recharge recommandée', top=560, width=860, srcw=942, srch=375),
   dict(cid='anorm', src='al_anorm.png', alt='Alerte consommation anormale', top=920, width=860, srcw=942, srch=378)],
  extra_css='''    #alertes-canaux {
      position: absolute; left: 130px; top: 482px; width: 750px;
      font-family: "Inter", sans-serif; font-weight: 700; font-size: 40px; color: #1f7a5a;
    }''',
  extra_html='\n      <p id="alertes-canaux" class="clip" data-start="0" data-duration="3.2">WhatsApp · SMS · E-mail · Push</p>',
  extra_script='''tl.fromTo("#alertes-canaux", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, 0.35);
    tl.fromTo("#alertes-reco", { y: -90, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.3)" }, 0.45);
    tl.fromTo("#alertes-anorm", { y: -90, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.3)" }, 0.8);''')

scene('ia', 1.9, 'Une *IA explique votre mois.', 'word', 'blur', 'blur', punch=(0.8, '480px 900px', 1.12), cards_spec=
  [dict(cid='card', src='ia.png', alt='Woly Elec IA', top=540, width=860, srcw=1086, srch=900)])
