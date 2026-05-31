import 'reflect-metadata';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── Schémas inline ───────────────────────────────────────────────────────────

const QuestionSchema = new mongoose.Schema(
  {
    title: String,
    body: String,
    authorEmail: String,
    authorName: { type: String, default: 'Anonyme' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    aiAnalysis: Object,
    topics: [String],
    answersCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
QuestionSchema.index({ title: 'text', body: 'text' });

const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumQuestion' },
    body: String,
    authorEmail: String,
    authorName: { type: String, default: 'Anonyme' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    aiAnalysis: Object,
  },
  { timestamps: true },
);

const QuestionModel = mongoose.model('ForumQuestion', QuestionSchema);
const AnswerModel = mongoose.model('ForumAnswer', AnswerSchema);

// ─── Données de seed ──────────────────────────────────────────────────────────

interface SeedQuestion {
  title: string;
  body: string;
  authorName: string;
  authorEmail: string;
  topics: string[];
  answers: Array<{
    body: string;
    authorName: string;
    authorEmail: string;
  }>;
}

const SEED_DATA: SeedQuestion[] = [
  // ── PRIÈRE ──────────────────────────────────────────────────────────────────
  {
    title: 'Est-il permis de cumuler les prières en voyage ?',
    body: "Je voyage souvent pour le travail et je me pose la question sur la possibilité de cumuler les prières (Dhuhr avec Asr, Maghrib avec Isha). Est-ce que cela est autorisé en Islam et dans quelles conditions ? Y a-t-il une distance minimale à parcourir pour que cela soit valide ?",
    authorName: 'Ibrahim Diallo',
    authorEmail: 'ibrahim.diallo@example.com',
    topics: ['Prière'],
    answers: [
      {
        body: `Oui, le cumul des prières en voyage (jam' al-salawat) est licite selon le consensus des savants. Le Prophète ﷺ a dit : « Allah aime que ses indulgences soient pratiquées, de même qu'Il n'aime pas que ses interdictions soient transgressées. » (Rapporté par Ibn Hibban et Al-Bayhaqi, authentifié par Al-Albani).

Il existe deux types de cumul :
1. **Jam' taqdim** (avancement) : prier Dhuhr et Asr ensemble à l'heure de Dhuhr.
2. **Jam' ta'khir** (retard) : prier les deux à l'heure de Asr.

**Conditions selon les savants :**
- La majorité des hanbalites et chaféites fixent la distance minimale à environ 83 km (2 marhala).
- Les malikites et Cheikh Al-Albani estiment que toute distance rendant le voyage difficile suffit, sans fixer de minimum précis.
- Ibn Qudama dans *Al-Mughni* précise que le voyage doit être prévu et non immédiat.

Il est conseillé de ne pas en faire une habitude en dehors du voyage réel. Allah est le plus savant.`,
        authorName: 'Abdallah Ndiaye',
        authorEmail: 'abdallah.ndiaye@example.com',
      },
    ],
  },
  {
    title: 'Comment rattraper une prière oubliée plusieurs jours après ?',
    body: "J'ai oublié de faire la prière de Fajr plusieurs matins de suite à cause d'un sommeil profond. Maintenant que je m'en suis souvenu, est-ce que je dois la rattraper ? Comment dois-je la faire ? Est-ce que l'oubli est une excuse valable selon l'Islam ?",
    authorName: 'Fatou Sow',
    authorEmail: 'fatou.sow@example.com',
    topics: ['Prière'],
    answers: [
      {
        body: `Le Prophète ﷺ a dit : « Celui qui dort et oublie une prière ou la rate, qu'il la prie dès qu'il s'en souvient. Il n'y a pas d'expiation pour cela, si ce n'est cela même. » (Sahih Muslim, n°684).

Donc oui, il est **obligatoire** de rattraper les prières oubliées ou manquées par sommeil. Il n'y a ni péché ni kaffara (expiation), car Allah a excusé l'oubli et le sommeil.

**Comment rattraper :**
- Dès que vous vous souvenez, priez immédiatement, même si l'heure habituelle est passée.
- Si plusieurs prières sont à rattraper, il est recommandé de les faire dans l'ordre (Ibn Taymiyya, *Majmou' Al-Fatawa*).
- Pour le Fajr manqué, vous le priez en 2 rak'at même si c'est en pleine journée.

Ibn Hajar Al-Asqalani dans *Fath Al-Bari* explique que cet hadith établit le principe général du rattrapage (qada) pour les prières manquées sans raison de négligence volontaire.`,
        authorName: 'Moussa Camara',
        authorEmail: 'moussa.camara@example.com',
      },
    ],
  },
  {
    title: "Quelle est la règle concernant la prière derrière un imam qui commet des erreurs de tajwid ?",
    body: "Dans notre mosquée locale, l'imam fait souvent des erreurs de prononciation dans la récitation du Coran pendant la prière (surtout les makharij). Est-ce que notre prière est valide derrière lui ? Faut-il trouver une autre mosquée ?",
    authorName: 'Ousmane Balde',
    authorEmail: 'ousmane.balde@example.com',
    topics: ['Prière', 'Coran'],
    answers: [
      {
        body: `Les savants distinguent deux types d'erreurs dans la récitation :

**1. Al-lahn al-jali (erreur évidente)** : erreur qui change le sens du Coran (ex: changer une voyelle longue sur un mot modifiant son sens). Sur ce point, Ibn Qudama dans *Al-Mughni* précise que si cela change le sens de façon grave, la prière de l'imam est invalide.

**2. Al-lahn al-khafi (erreur subtile)** : erreur de tajwid qui ne change pas le sens fondamental. La majorité des savants (dont An-Nawawi dans *Al-Majmou'*) considèrent que la prière reste valide car la récitation du Coran est bien celle du Coran.

**Conclusion pratique :**
- Si les erreurs sont du type khafi (tajwid imparfait sans changement de sens), la prière est valide.
- S'il y a des erreurs grossières qui changent le sens, conseillez l'imam avec douceur et sagesse.
- Il n'est pas recommandé d'abandonner la mosquée de quartier pour cette raison si l'erreur ne change pas le sens.

Cheikh Ibn Uthaymin a précisé que la correction fraternelle de l'imam est un devoir de la communauté, mais dans le respect et la discrétion.`,
        authorName: 'Aissatou Barry',
        authorEmail: 'aissatou.barry@example.com',
      },
    ],
  },

  // ── JEÛNE ────────────────────────────────────────────────────────────────────
  {
    title: 'Les injections médicales annulent-elles le jeûne du Ramadan ?',
    body: "Je suis diabétique et je dois faire des injections d'insuline chaque jour. Est-ce que ces injections annulent mon jeûne pendant le Ramadan ? Mon médecin dit que je dois continuer le traitement. Comment gérer cela islamiquement ?",
    authorName: 'Mariama Baldé',
    authorEmail: 'mariama.balde@example.com',
    topics: ['Jeûne'],
    answers: [
      {
        body: `Cette question a fait l'objet d'un débat important parmi les savants contemporains.

**Opinion majoritaire :** Les injections sous-cutanées ou intramusculaires (comme l'insuline) n'annulent **pas** le jeûne. Cette position est celle de :
- **Cheikh Ibn Uthaymin** (*Majmou' Fatawa*, tome 19) : « Les injections qui ne sont pas nutritives et ne vont pas dans l'estomac n'annulent pas le jeûne. »
- **Cheikh Ibn Baz** : même position, à condition que l'injection ne soit pas nutritive.
- Le **Conseil de l'Académie du Fiqh Islamique** (OCI, résolution 93) : les injections thérapeutiques ne brisent pas le jeûne.

**Cas particulier des injections nutritives (perfusions) :** Elles sont unanimement considérées comme brisant le jeûne car elles remplacent la nourriture.

**Pour le diabétique :**
- L'insuline est thérapeutique, non nutritive → elle n'annule pas le jeûne.
- Si le médecin confirme un danger pour la santé, Allah a accordé une dispense (rukhs) pour le malade : il peut rompre le jeûne et le rattraper plus tard ou payer la fidya si le jeûne est définitivement impossible.`,
        authorName: 'Dr. Cheikh Tidiane Diop',
        authorEmail: 'cheikh.diop@example.com',
      },
    ],
  },
  {
    title: 'Peut-on se brosser les dents avec du dentifrice pendant le jeûne ?',
    body: "Je me demande si l'utilisation du dentifrice pendant le jeûne du Ramadan est permise. Certains disent que c'est interdit à cause du goût, d'autres disent que c'est permis. Qu'en disent les savants ?",
    authorName: 'Hamidou Kouyaté',
    authorEmail: 'hamidou.k@example.com',
    topics: ['Jeûne'],
    answers: [
      {
        body: `Il y a une distinction importante à faire entre le siwak (bâtonnet naturel) et le dentifrice.

**Le siwak :** Le Prophète ﷺ a dit : « Sans craindre d'être contraignant pour ma communauté, j'aurais ordonné le siwak avant chaque prière. » (Sahih Bukhari). Les savants permettent son usage même pendant le jeûne.

**Le dentifrice (macaras) :**
- **Ibn Uthaymin** (Fatawa Al-Siyam) : le dentifrice avec un goût prononcé est **makruh** (déconseillé) pendant le jeûne, car il y a un risque réel d'en avaler une partie. Il recommande de l'utiliser avant le Fajr ou après l'Iftar.
- **Ibn Baz** : même avis de prudence.
- **Position alternative** : certains savants contemporains le permettent avec précaution, à condition de ne rien avaler.

**Règle générale :** Si quelque chose atteint la gorge volontairement, le jeûne est rompu. Si c'est involontaire et sans négligence, il ne l'est pas.

**Conseil pratique :** Par précaution, utilisez le dentifrice avant le Fajr ou après l'Iftar, et limitez-vous au siwak ou à l'eau (sans avaler) pendant le jeûne.`,
        authorName: 'Seydou Traoré',
        authorEmail: 'seydou.t@example.com',
      },
    ],
  },

  // ── FAMILLE ──────────────────────────────────────────────────────────────────
  {
    title: 'Quelles sont les conditions d\'un mariage islamique valide ?',
    body: "Je vais me marier prochainement et je voudrais m'assurer que mon mariage islamique soit valide selon la Sunnah. Quelles sont les conditions indispensables ? Faut-il absolument passer devant un imam ? Et concernant le wali (tuteur), est-il obligatoire ?",
    authorName: 'Samba Koné',
    authorEmail: 'samba.kone@example.com',
    topics: ['Famille'],
    answers: [
      {
        body: `Les savants s'accordent sur les **conditions essentielles** du mariage islamique :

**1. Le wali (tuteur matrimonial) — OBLIGATOIRE**
Le Prophète ﷺ a dit : « Pas de mariage sans wali. » (Sahih, rapporté par Abu Dawud, authentifié par Al-Albani). Le wali est le père, puis les proches mâles par ordre de parenté. C'est une condition sine qua non selon la majorité (hanbalites, chaféites, malikites).

**2. Les deux témoins — OBLIGATOIRE**
« Pas de mariage sans wali et deux témoins dignes de foi. » (Ibn Hibban, authentifié). Les témoins doivent être deux hommes musulmans, sains d'esprit, adultes et upright (adl).

**3. L'ijab et qabul (offre et acceptation)**
Le consentement explicite des deux époux exprimé lors de l'akad.

**4. La mahr (dot) — OBLIGATOIRE**
Allah dit dans le Coran : « Donnez aux femmes leur dot de bon gré. » (Sourate An-Nisa, v.4). Elle peut être modeste.

**5. Absence d'empêchements** (mahram, période d'idda, etc.)

**Concernant l'imam :** Il n'est pas une condition islamique en soi. L'imam joue souvent le rôle du wali ou du représentant, mais ce qui compte est la présence du wali, des témoins et de l'ijab-qabul.

**Recommandation :** An-Nawawi dans *Al-Majmou'* précise que l'annonce publique (i'lan) est fortement recommandée pour distinguer le mariage du concubinage.`,
        authorName: 'Fatoumata Bah',
        authorEmail: 'fatoumata.bah@example.com',
      },
    ],
  },
  {
    title: 'Est-il obligatoire d\'obéir à ses parents s\'ils s\'opposent à un mariage licite ?',
    body: "Mes parents s'opposent à mon mariage avec une sœur musulmane pratiquante uniquement pour des raisons ethniques et tribales. Suis-je obligé de leur obéir ? Comment concilier la birr al-walidayn (bienfaisance envers les parents) et mon droit au mariage ?",
    authorName: 'Mamadou Bah',
    authorEmail: 'mamadou.bah@example.com',
    topics: ['Famille', 'Comportement'],
    answers: [
      {
        body: `C'est une question très fréquente et importante. Les savants ont apporté une réponse claire :

**La règle fondamentale :** « Pas d'obéissance à la créature dans la désobéissance au Créateur. » (Hadith sahih, Musnad Ahmad, authentifié par Al-Albani).

**Application au mariage :**
Ibn Taymiyya dans *Majmou' Al-Fatawa* (tome 32) précise que le père **ne peut pas** refuser le mariage de sa fille (ou de son fils) avec un partenaire de bonne moralité et de pratique islamique correcte pour des raisons tribales ou de caste. Ce refus est injuste (adulte) et le père devient alors un wali 'adil (tuteur injuste).

**Sur le racisme tribal :**
Le Prophète ﷺ a dit lors du discours de l'adieu : « Il n'y a pas de supériorité d'un Arabe sur un non-Arabe, ni d'un blanc sur un noir, si ce n'est par la piété. » (Ahmad, authentifié).

**Que faire pratiquement :**
1. Essayer d'abord de convaincre par le dialogue, en impliquant des personnes de sagesse.
2. Si le père refuse sans raison légale, le wali passe au tuteur suivant (frère, oncle paternel, etc.).
3. En dernier recours, le juge (qadi) peut procéder au mariage — dans les pays sans qadi, l'imam peut jouer ce rôle.

Continuez à traiter vos parents avec respect et amour malgré leur opposition. La birr al-walidayn reste un devoir, mais elle ne va pas jusqu'à l'obéissance dans l'injustice.`,
        authorName: 'Cheikh Omar Sy',
        authorEmail: 'cheikh.sy@example.com',
      },
    ],
  },

  // ── FOI / AQIDA ──────────────────────────────────────────────────────────────
  {
    title: 'Comment répondre aux doutes sur l\'existence d\'Allah à quelqu\'un qui questionne la foi ?',
    body: "Mon cousin est en proie à des doutes sur l'existence d'Allah après avoir été exposé à des arguments philosophiques athées. Comment puis-je l'aider avec des arguments islamiques solides et rationnels ? Quelles sont les preuves de l'existence d'Allah selon les savants islamiques ?",
    authorName: 'Rokhaya Fall',
    authorEmail: 'rokhaya.fall@example.com',
    topics: ['Foi'],
    answers: [
      {
        body: `C'est une question de grande importance. Voici les arguments principaux que les savants islamiques utilisent :

**1. L'argument de la création (dalil al-huduth)**
Tout ce qui existe a une cause. L'univers existe et est contingent (il aurait pu ne pas exister). Il faut donc une cause première, nécessaire par elle-même et éternelle. C'est ce que les musulmans nomment Allah. Ibn Rushd et Al-Ghazali ont développé cet argument en détail.

**2. L'argument de la conception (dalil al-'inaya)**
L'ordre extraordinaire de l'univers — les lois physiques, la vie, la conscience — pointe vers un Créateur intelligent. Allah dit : « Regarderons-ils donc le ciel au-dessus d'eux, comment Nous l'avons bâti et embelli ? » (Sourate Qaf, v.6). Le Big Bang lui-même confirme que l'univers a un commencement.

**3. La fitrah (nature innée)**
Le Prophète ﷺ a dit : « Tout enfant naît sur la fitrah. » (Sahih Muslim). La tendance naturelle de l'être humain à reconnaître un Créateur est une preuve intérieure.

**4. L'argument moral**
Sans un Dieu transcendant, il n'y a pas de fondement objectif à la morale. Or tous les humains reconnaissent l'existence du bien et du mal.

**Ressources recommandées :**
- Ibn Qayyim Al-Jawziyya, *Miftah Dar Al-Sa'ada* (arguments rationnels sur la foi)
- Ibn Taymiyya, *Dar' Ta'arud Al-'Aql wa An-Naql*

Conseillez à votre cousin de lire avec l'intention sincère de trouver la vérité, et de faire du dua.`,
        authorName: 'Professeur Ibrahima Sarr',
        authorEmail: 'ibrahima.sarr@example.com',
      },
    ],
  },

  // ── HALAL/HARAM ──────────────────────────────────────────────────────────────
  {
    title: 'Est-ce que la crypto-monnaie (Bitcoin, etc.) est halal ou haram ?',
    body: "Je veux investir dans les crypto-monnaies comme le Bitcoin et l'Ethereum pour économiser. Certains disent que c'est du jeu de hasard (maysir), d'autres que c'est un investissement normal. Qu'en disent les savants islamiques ? Y a-t-il des conditions pour que ce soit licite ?",
    authorName: 'Aliou Dieng',
    authorEmail: 'aliou.dieng@example.com',
    topics: ['Halal/Haram', 'Commerce'],
    answers: [
      {
        body: `C'est l'une des questions les plus débattues en fiqh contemporain. Les savants sont divisés :

**Position 1 : Permis sous conditions**
- **Cheikh Assim Al-Hakeem** et certains membres du Conseil Européen de la Fatwa estiment que l'achat de crypto dans le but d'investissement (pas de spéculation pure) est permis si :
  - On n'a pas recours à l'effet de levier (haram car c'est du riba)
  - On évite les tokens associés à des activités haram
  - La transaction est réelle (pas de vente de ce qu'on ne possède pas)

**Position 2 : Haram**
- **Cheikh Ibn Baz (posthume, fatwa émise par la fondation)** et le **Grand Mufti d'Arabie Saoudite Cheikh Abdulaziz Al-Sheikh** ont émis des fatwas considérant les crypto-monnaies comme haram en raison de :
  - L'extrême spéculation (gharar excessif)
  - L'absence de valeur intrinsèque reconnue
  - L'usage fréquent pour des activités illicites

**Ce qui est clairement haram :**
- Le trading avec effet de levier
- Les NFT spéculatifs sans utilité réelle
- Acheter dans l'intention de manipulation du marché

**Conseil pratique :** Vu le désaccord des savants, la précaution s'impose. Si vous investissez, faites-le sans effet de levier, avec une mise que vous pouvez perdre, et dans des cryptos à utilité réelle. Allah est le plus savant.`,
        authorName: 'Babacar Thiaw',
        authorEmail: 'babacar.t@example.com',
      },
    ],
  },
  {
    title: 'Que dit l\'Islam sur les assurances (mutuelle santé, assurance voiture) ?',
    body: "En France, l'assurance voiture est obligatoire par la loi. J'hésite aussi à prendre une mutuelle santé. Est-ce que les assurances sont halal en Islam ? J'ai entendu qu'elles contiennent du gharar (incertitude). Comment les savants voient-ils cela ?",
    authorName: 'Ndeye Diallo',
    authorEmail: 'ndeye.diallo@example.com',
    topics: ['Halal/Haram', 'Commerce'],
    answers: [
      {
        body: `C'est une question importante que les savants contemporains ont largement traitée.

**L'assurance conventionnelle : position des savants**
L'Académie du Fiqh Islamique (OCI) dans sa résolution de 1985 a conclu que l'assurance commerciale conventionnelle est **non permise** en raison de :
- Le **gharar** (incertitude excessive) : on paie sans savoir ce qu'on recevra
- Le **maysir** (jeu de hasard) : l'assureur gagne si le sinistre n'a pas lieu
- Le **riba** dans les placements des compagnies d'assurance

**Exception pour l'assurance obligatoire par loi**
Ibn Uthaymin et d'autres savants ont précisé : « Ce qui est imposé par la contrainte légale sort du champ de l'interdit. » Donc l'assurance auto obligatoire est permise par nécessité (darura), sans que vous en soyez pécheur.

**La Takaful (assurance islamique)**
L'alternative islamique est le **Takaful** : système de solidarité mutuelle où les participants contribuent à un fonds commun. Disponible en France via certaines institutions (ACMIL, mutuelles islamiques européennes).

**Concernant la mutuelle santé :**
Si vous pouvez accéder à un système Takaful, c'est préférable. Sinon, les savants contemporains comme Cheikh Yusuf Al-Qaradawi ont accordé une tolérance pour la mutuelle santé dans les pays non-musulmans par nécessité et pour éviter un préjudice grave.`,
        authorName: 'Thierno Diallo',
        authorEmail: 'thierno.d@example.com',
      },
    ],
  },

  // ── INVOCATION ───────────────────────────────────────────────────────────────
  {
    title: 'Quels sont les moments les plus propices pour que le dua soit exaucé ?',
    body: "Je veux améliorer ma pratique du dua (invocation). On dit que certains moments sont plus propices que d'autres pour que le dua soit accepté. Quels sont ces moments selon le Coran et la Sunnah ? Et y a-t-il des conditions pour que le dua soit accepté ?",
    authorName: 'Binta Kouyaté',
    authorEmail: 'binta.k@example.com',
    topics: ['Invocation'],
    answers: [
      {
        body: `Le Prophète ﷺ nous a guidés sur les moments privilégiés pour le dua. En voici les principaux :

**1. Le dernier tiers de la nuit**
« Notre Seigneur descend chaque nuit au ciel le plus bas lorsqu'il reste le dernier tiers de la nuit et dit : "Qui m'invoque pour que je lui réponde ?" » (Sahih Bukhari et Muslim).

**2. Entre l'adhan et l'iqama**
Le Prophète ﷺ a dit : « Le dua entre l'adhan et l'iqama n'est pas rejeté. » (Abu Dawud, authentifié par Al-Albani).

**3. Après la prière obligatoire**
Ibn Qayyim Al-Jawziyya dans *Zaad Al-Ma'ad* mentionne que c'est un moment béni, particulièrement après la prière du Fajr et de Asr.

**4. Le jour du vendredi**
« Dans le vendredi se trouve une heure où, si un musulman se trouve à prier et demande quelque chose à Allah, Il le lui accorde. » (Sahih Bukhari). Les savants s'accordent sur la dernière heure avant le coucher du soleil.

**5. En état de sujud (prosternation)**
« Le serviteur est le plus proche de son Seigneur lorsqu'il est en prosternation. » (Sahih Muslim).

**Conditions d'acceptation du dua :**
- Nourriture halal (condition fondamentale selon Ibn Qayyim)
- Présence du cœur et certitude de l'exaucement
- Commencer par la louange d'Allah et les salutations sur le Prophète ﷺ
- Ne pas demander ce qui est haram`,
        authorName: 'Abdoulaye Konaté',
        authorEmail: 'abdoulaye.k@example.com',
      },
    ],
  },

  // ── ZAKAT ────────────────────────────────────────────────────────────────────
  {
    title: 'Comment calculer la Zakat sur un salaire mensuel ?',
    body: "Je reçois un salaire mensuel et j'aimerais savoir comment calculer correctement ma Zakat. Est-ce que la Zakat s'applique sur le salaire directement ? Quel est le nissab pour les salaires ? Et comment fonctionne le hawl (année lunaire) pour les employés ?",
    authorName: 'Lamine Cissé',
    authorEmail: 'lamine.cisse@example.com',
    topics: ['Zakat'],
    answers: [
      {
        body: `C'est une question qui a deux positions principales chez les savants contemporains :

**Position 1 : Zakat annuelle sur l'épargne**
C'est la position classique (Ibn Baz, Ibn Uthaymin). La Zakat est due sur l'argent **épargné** qui a atteint le nissab et séjourné une année lunaire complète (hawl).

- **Nissab en 2024** : équivalent de 85g d'or (environ 5000-5500€ selon le cours) ou 595g d'argent (environ 300-400€ — certains utilisent l'argent car plus accessible aux pauvres).
- **Taux** : 2,5% de l'épargne totale au bout d'un an.
- **Pratique** : notez votre épargne le jour de Ramadan (ou un jour fixe), et si elle dépasse le nissab un an plus tard, payez 2,5%.

**Position 2 : Zakat sur le revenu (Zakat Al-Kasb)**
Cheikh Yusuf Al-Qaradawi (*Fiqh Al-Zakat*) et l'Académie du Fiqh Islamique estiment que les salaires sont soumis à Zakat au moment de la réception, sans condition de hawl, si le montant mensuel dépasse le nissab. Taux : 2,5%.

**Recommandation pratique :**
Par précaution et pour s'assurer de s'acquitter correctement, vous pouvez :
- Calculer votre épargne nette totale (après dépenses essentielles)
- Si elle dépasse le nissab après un an, payer 2,5%
- Donner en Ramadan pour plus de bénédiction`,
        authorName: 'Cheikh Modou Mbaye',
        authorEmail: 'cheikh.mbaye@example.com',
      },
    ],
  },

  // ── COMPORTEMENT ────────────────────────────────────────────────────────────
  {
    title: 'Est-ce que l\'Islam permet de se défendre contre une injustice même devant un tribunal civil ?',
    body: "Mon employeur m'a licencié injustement et je veux saisir le conseil de prud'hommes. Certains me disent que c'est haram de porter une plainte devant un tribunal non islamique. Est-ce vrai ? Qu'en dit l'Islam sur le recours à la justice civile dans les pays non musulmans ?",
    authorName: 'Pape Diop',
    authorEmail: 'pape.diop@example.com',
    topics: ['Comportement', 'Halal/Haram'],
    answers: [
      {
        body: `Le recours aux tribunaux civils dans les pays non-musulmans pour des droits légitimes est **permis** selon la majorité des savants contemporains.

**Arguments :**

1. **Allah ordonne de rétablir le droit :** « Et si vous jugez entre les gens, jugez avec équité. » (Sourate An-Nisa, v.58). Recouvrir un droit spolié est en lui-même conforme à la shariah.

2. **Position de Cheikh Al-Albani et Ibn Uthaymin :** Ils ont précisé que la prohibition du tahakum (jugement devant les non-musulmans) concerne les cas où on aurait accès à un juge islamique. Dans les pays non-musulmans sans qadi disponible, le recours à la justice civile pour un droit légitime est une nécessité.

3. **Cheikh Qaradawi dans *Fi Fiqh Al-Aqalliyyat*** : Il est permis aux musulmans vivant en pays non-musulmans d'utiliser les lois civiles pour protéger leurs droits fondamentaux (travail, propriété, famille), à condition de ne pas plaider pour quelque chose d'haram.

**Ce qui reste interdit :**
- Utiliser les tribunaux pour obtenir un droit illicite
- Prêter un faux serment devant la justice

**Conclusion :** Allez défendre votre droit aux prud'hommes. C'est votre droit légitime et l'Islam ne vous empêche pas de vous défendre contre l'injustice.`,
        authorName: 'Maître Ibou Diallo',
        authorEmail: 'ibou.diallo@example.com',
      },
    ],
  },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI manquant dans .env');
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  await mongoose.connect(uri, { dbName: 'hadith_db' });
  console.log('Connecté.');

  // Supprimer les données existantes
  const qCount = await QuestionModel.countDocuments();
  const aCount = await AnswerModel.countDocuments();
  if (qCount > 0 || aCount > 0) {
    console.log(`Suppression des données existantes (${qCount} questions, ${aCount} réponses)...`);
    await QuestionModel.deleteMany({});
    await AnswerModel.deleteMany({});
  }

  let totalQuestions = 0;
  let totalAnswers = 0;

  for (const seed of SEED_DATA) {
    const { answers: answerData, ...questionData } = seed;

    // Créer la question
    const question = await QuestionModel.create({
      ...questionData,
      status: 'approved',
      answersCount: answerData.length,
      aiAnalysis: { approved: true, reason: 'Seed data', flags: [] },
    });

    totalQuestions++;

    // Créer les réponses
    for (const ans of answerData) {
      await AnswerModel.create({
        ...ans,
        questionId: question._id,
        status: 'approved',
        aiAnalysis: { approved: true, reason: 'Seed data', flags: [] },
      });
      totalAnswers++;
    }

    console.log(`  ✓ "${question.title.substring(0, 60)}..." [${questionData.topics.join(', ')}]`);
  }

  const rejectedAnswers = await AnswerModel.countDocuments({ status: 'rejected' });
  if (rejectedAnswers > 0) {
    throw new Error(`Seed invalide : ${rejectedAnswers} réponse(s) rejetée(s) détectée(s).`);
  }

  console.log(`\nSeed terminé : ${totalQuestions} questions, ${totalAnswers} réponses approuvées insérées.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});

