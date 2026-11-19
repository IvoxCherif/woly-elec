# Woly Elec mobile — présentation verticale

GOAL:    le spectateur comprend en 30 s que Woly Elec lui dit combien et quand recharger son Woyofal, et va sur wolyelec.com/app.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps
TIME:    31.5 s x 30 = 945 frames ; muet pour l'instant (musique à ajouter après connexion HeyGen)
LOOK:    deux sols de la marque : vert #0B3D2E (accroche, fin) et gris clair de l'appli #F3F6F4 (produit) ;
         encre #0B3D2E sur clair, #FFFFFF sur vert ; accent jaune #FACC15 sur vert, bleu #1D4ED8 sur clair, un seul mot par plan ;
         titres Montserrat 800, 92 px, interlettrage -2 %, 2 lignes max, 5 mots max par ligne ; sous-titres Inter 700, 44 px ;
         médium : vraies cartes de l'appli (captures du mode démo, 3x), coins 36 px, ombre 0 24 px 48 px rgba(11,61,46,.14) ;
         décor : grand arc de jauge (le motif du logo) en bas du cadre, sous 1330 px, trait 70 px, #E3EEE8 sur clair, #104836 sur vert, rotation 4°/s.
OBJECTS: le téléphone (cadre #0F1A16, 18 px, rayon 64 px) avec l'écran réel du tableau de bord ; les cartes : jauge, montant, tranche, plan du mois, rappel, simulateur, alertes, IA ; le logo (fichier de la marque) ; le bouton jaune de la marque.
MOTION:  arrivée expo.out 0.7 s ; caméra power2.inOut 0.6 s ; sortie power3.in 0.3 s ; titres mot par mot (flou 6 px → 0, 0.13 s, 0.07 s d'écart) ou ligne entière floutée ; ressort 0.8 pour le logo.
SHOTS:
  0.0–3.2   ACCROCHE : la question sur le vert, déjà à l'écran au frame 0 ; « fin du mois » passe au jaune à 0.5 s ; « Woly Elec vous répond. » à 1.6 s. Sortie : flou.
  3.2–8.0   TÉLÉPHONE : le sol passe au clair (flood 0.4 s), le téléphone monte (expo.out) ; titre « Tout votre crédit, en un coup d'œil. » ; à 5.6 s punch-in x2.3 sur la jauge (41,6 kWh ≈ 8 jours).
  8.0–10.8  MONTANT : zoom à travers ; la carte « Montant à recharger » arrive grande et se pose ; titre « Combien recharger pour finir le mois. »
  10.8–13.8 TRANCHE : whip vertical ; carte « Tranche actuelle » ; titre « Restez en tranche 1, le kWh à 82 F. »
  13.8–17.0 PLAN : blur swap ; carte « Plan du mois » puis le rappel jaune glisse dessous ; titre « Le meilleur jour pour recharger. »
  17.0–20.4 SIMULATEUR : whip ; carte du simulateur (montant 10 000 F → 76,4 kWh, 14 jours) ; titre « Testez un montant avant de payer. »
  20.4–24.0 ALERTES : deux alertes réelles se posent l'une après l'autre ; titre « Prévenu avant la coupure. » ; canaux « WhatsApp · SMS · E-mail · Push ».
  24.0–27.2 IA : carte Woly Elec IA ; titre « Une IA qui explique votre mois. »
  27.2–31.5 FIN : le sol repasse au vert ; le logo se pose (ressort), « WOLY ELEC » apparaît lettre par lettre, la devise, puis le bouton jaune « 30 jours gratuits » et wolyelec.com/app, tenus 2.5 s.
BANNED:  fond noir ; halo, néon, particules ; dégradés violets ; cartes en verre ; trois cartes en rang ; titre sur capture assombrie ; logo dans un coin ; texte qui bouge pendant la lecture ; tableau de bord inventé ; tout qui glisse vers le haut en fondu.
QA:      0.0 (accroche lisible), 4.6 (téléphone entier + titre), 6.6 (jauge lisible), 9.6, 12.6, 16.2, 19.6, 23.2, 26.4, 31.0 (logo + bouton + adresse) ; tout texte entre 168 et 1330 px.
