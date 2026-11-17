(() => {
  "use strict";
  if (document.getElementById("z431-legal-footer")) return;

  const style = document.createElement("style");
  style.textContent = `
    #z431-legal-footer{margin-top:48px;background:#080d13;border-top:1px solid rgba(180,45,53,.42);color:#aeb8c4;font:12px/1.6 Arial,sans-serif}
    #z431-legal-footer .z431-legal-inner{max-width:1440px;margin:auto;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
    #z431-legal-footer strong{color:#e8edf2;letter-spacing:2px}
    #z431-legal-footer .z431-legal-actions{display:flex;gap:8px 18px;flex-wrap:wrap}
    #z431-legal-footer button{border:0;background:none;color:#d6a0a3;padding:5px 0;font:inherit;cursor:pointer}
    #z431-legal-footer button:hover{color:#fff;text-decoration:underline}
    #z431-legal-footer .z431-legal-copy{color:#718092}
    #z431-legal-dialog{width:min(940px,calc(100% - 28px));max-height:85vh;overflow:auto;padding:0;border:1px solid #394654;border-top:3px solid #a52c32;background:#0d141d;color:#dce3eb;box-shadow:0 24px 90px #000b}
    #z431-legal-dialog::backdrop{background:rgba(0,0,0,.78);backdrop-filter:blur(4px)}
    #z431-legal-dialog .z431-legal-head{position:sticky;top:0;z-index:2;background:#101923;border-bottom:1px solid #293746;padding:18px 22px;display:flex;justify-content:space-between;align-items:center}
    #z431-legal-dialog h2{margin:0;color:#fff;font-size:17px;letter-spacing:1.5px}
    #z431-legal-dialog .z431-legal-close{background:none;border:1px solid #536171;color:#fff;padding:7px 12px;cursor:pointer}
    #z431-legal-dialog .z431-legal-content{padding:22px}
    #z431-legal-dialog details{border:1px solid #293746;background:#111b26;margin:0 0 10px}
    #z431-legal-dialog summary{cursor:pointer;padding:14px 16px;color:#f1f4f7;font-weight:700;letter-spacing:.5px}
    #z431-legal-dialog details>div{padding:0 16px 16px;color:#b9c4d0}
    #z431-legal-dialog h3{color:#e8edf2;font-size:13px;margin:16px 0 6px}
    #z431-legal-dialog p,#z431-legal-dialog li{font-size:13px}
    #z431-legal-dialog a{color:#e39a9e}
    #z431-legal-dialog .z431-legal-warning{border-left:3px solid #a52c32;padding:10px 13px;background:#1b171b;color:#e3c6c8}
    @media(max-width:600px){#z431-legal-footer .z431-legal-inner{padding:18px}#z431-legal-dialog .z431-legal-content{padding:14px}}
  `;
  document.head.appendChild(style);

  const footer = document.createElement("footer");
  footer.id = "z431-legal-footer";
  footer.innerHTML = `
    <div class="z431-legal-inner">
      <div><strong>ZONE-431</strong><br><span>ENVIRONNEMENT ROLEPLAY COMMUNAUTAIRE NON OFFICIEL</span></div>
      <div class="z431-legal-actions">
        <button type="button" data-legal-open="mentions">Mentions légales</button>
        <button type="button" data-legal-open="privacy">Confidentialité & RGPD</button>
        <button type="button" data-legal-open="cookies">Cookies & traceurs</button>
        <button type="button" data-legal-open="terms">Conditions d'utilisation</button>
        <button type="button" data-legal-open="license">Licence & crédits</button>
      </div>
      <div class="z431-legal-copy">© Zone-431 — Projet communautaire indépendant</div>
    </div>`;
  document.body.appendChild(footer);

  const dialog = document.createElement("dialog");
  dialog.id = "z431-legal-dialog";
  dialog.innerHTML = `
    <div class="z431-legal-head"><h2>INFORMATIONS JURIDIQUES // ZONE-431</h2><button class="z431-legal-close" type="button" aria-label="Fermer">FERMER</button></div>
    <div class="z431-legal-content">
      <p class="z431-legal-warning"><strong>Projet non officiel :</strong> Zone-431 est un projet communautaire indépendant de jeu de rôle et de création fictionnelle. Il n'est ni affilié, ni approuvé, ni administré par la SCP Foundation, Roblox, GitHub ou leurs sociétés respectives. Les noms et marques de tiers restent la propriété de leurs titulaires.</p>

      <details id="z431-legal-mentions" open><summary>1. Mentions légales et éditeur</summary><div>
        <h3>Identification de l'éditeur</h3>
        <p>Nom du site : <strong>Zone-431</strong>.<br>URL : <a href="https://fragmentz431.github.io/zone.431.rp/" target="_blank" rel="noopener noreferrer">https://fragmentz431.github.io/zone.431.rp/</a><br>Nature : site communautaire non commercial consacré à un univers de roleplay fictif.<br>Directeur de la publication : <strong>éditeur personne physique agissant à titre non professionnel</strong>.<br>Éditeur : <strong>personne physique, projet personnel bénévole non déclaré</strong>.<br>Contact de l'éditeur : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>.</p>
        <p>Zone-431 est édité à titre non professionnel et bénévole. L'éditeur n'est ni une association déclarée ni une entreprise. Afin de préserver la vie privée de l'éditeur, son identité civile et ses coordonnées personnelles ne sont pas publiées ici. La loi pour la confiance dans l'économie numérique permet à un éditeur non professionnel de ne mettre à disposition du public que les coordonnées de son hébergeur, sous réserve d'avoir communiqué à celui-ci les éléments d'identification requis. Cette démarche auprès de l'hébergeur doit être effectuée et confirmée avant de considérer les mentions comme complètes. Le nom de l'administrateur du projet n'est donc pas affiché publiquement dans ces mentions.</p>
        <h3>Hébergement et services techniques</h3>
        <p><strong>Hébergement du site statique :</strong> GitHub Pages, service fourni par GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Site : <a href="https://github.com/" target="_blank" rel="noopener noreferrer">github.com</a>.</p>
        <p><strong>Base de données et authentification :</strong> Supabase, service fourni par Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513. Site : <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer">supabase.com</a>. Le projet Zone-431 est configuré dans la région technique <strong>eu-west-1 (Irlande)</strong> pour sa base de données et ses services associés. Certaines données de compte fournisseur, données opérationnelles, demandes d'assistance ou données techniques peuvent néanmoins être traitées depuis d'autres régions conformément aux documents contractuels et à la politique de confidentialité des prestataires.</p>
        <h3>Objet du site</h3><p>Le site présente un univers fictif, des contenus de roleplay, des informations communautaires, des documents et des outils numériques associés. Les appellations internes, procédures, personnages, organisations et installations décrits dans le cadre du roleplay sont fictifs.</p>
        <h3>Publication et signalement</h3><p>Pour signaler un contenu illicite, une atteinte aux droits ou un problème de sécurité : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>. Décrivez précisément l'URL concernée, le motif du signalement et les éléments permettant de le vérifier. N'envoyez pas de données sensibles qui ne seraient pas nécessaires.</p>
        <p class="z431-legal-warning"><strong>À vérifier avant publication définitive :</strong> l'éditeur doit communiquer les éléments d'identification requis à l'hébergeur et vérifier les modalités de confidentialité offertes par celui-ci. Ces informations doivent être actualisées si l'éditeur, les prestataires, l'architecture technique ou le statut du projet change.</p>
      </div></details>

      <details id="z431-legal-privacy"><summary>2. Politique de confidentialité et RGPD</summary><div>
        <h3>Responsable du traitement</h3><p>Responsable du traitement : <strong>Thibaut GALLIS, agissant à titre non professionnel pour le projet Zone-431</strong>. Contact relatif aux données personnelles : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>.</p>
        <h3>Catégories de données susceptibles d'être traitées</h3>
        <ul>
          <li>Compte et authentification : adresse e-mail, identifiant technique et informations nécessaires à la connexion.</li>
          <li>Profil communautaire : pseudonyme Roblox, pseudonyme Discord, présentation et informations de profil renseignées volontairement.</li>
          <li>Gestion des accès : statut du compte, rôle, département, autorisations et historique administratif utile à la sécurité.</li>
          <li>Activités et contenus : documents, plans, demandes, rapports, formations, signalements ou messages soumis au moyen des fonctionnalités disponibles.</li>
          <li>Données techniques : journaux de connexion, informations relatives au navigateur ou à l'appareil et données de sécurité éventuellement fournies par les prestataires.</li>
          <li>Demandes de contact : coordonnées et contenu du message transmis volontairement.</li>
        </ul>
        <p>Cette liste décrit les catégories possibles et doit être ajustée après vérification du fonctionnement réel du site, des formulaires, de la base de données et des journaux. Ne collectez pas de données qui ne sont pas nécessaires au fonctionnement du service.</p>
        <h3>Finalités et bases légales</h3>
        <ul>
          <li>Créer et administrer les comptes, authentifier les membres et gérer les autorisations : exécution du service demandé et/ou intérêt légitime à sécuriser l'espace communautaire, selon le fonctionnement réel.</li>
          <li>Gérer les demandes, signalements et échanges : traitement de la demande et intérêt légitime à administrer la communauté.</li>
          <li>Prévenir les accès non autorisés, abus et incidents : intérêt légitime à assurer la sécurité du site.</li>
          <li>Respecter les obligations légales applicables : obligation légale, lorsqu'elle existe.</li>
        </ul>
        <p>Le responsable doit confirmer la base légale applicable à chaque traitement et la documenter. Aucune donnée ne doit être réutilisée pour une finalité incompatible sans information appropriée et base légale valable.</p>
        <h3>Destinataires et sous-traitants</h3><p>Les données peuvent être accessibles aux administrateurs habilités de Zone-431, dans la limite de leurs missions. Les services techniques utilisés peuvent notamment inclure GitHub Pages pour l'hébergement du site et Supabase pour certaines fonctions de base de données et d'authentification. Le responsable doit vérifier les services effectivement activés, leurs rôles contractuels, leurs paramètres de sécurité, leurs sous-traitants et leurs politiques de confidentialité. Les données ne sont pas destinées à être vendues.</p>
        <h3>Durées de conservation</h3><p><strong>Données de compte et profil :</strong> conservées pendant toute la durée d'existence du compte. À la demande de suppression adressée à <a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a>, le compte et les données personnelles qui lui sont associées sont supprimés dans les meilleurs délais, sous réserve des données qui doivent être conservées pour respecter une obligation légale ou traiter un litige. Les copies présentes dans les sauvegardes techniques peuvent subsister pendant le cycle normal d'écrasement des sauvegardes du prestataire.</p><p><strong>Demandes de contact :</strong> conservées le temps nécessaire pour répondre et assurer le suivi de la demande, puis supprimées ou archivées uniquement si une obligation ou un motif légitime le justifie. <strong>Journaux techniques et de sécurité :</strong> conservés pendant la durée nécessaire à la détection, à l'analyse et à la résolution des incidents, puis supprimés ou anonymisés. <strong>Signalements et mesures de modération :</strong> conservés pendant le traitement du signalement et aussi longtemps que nécessaire pour assurer le suivi d'une mesure ou prévenir la répétition d'un abus ; ils sont ensuite supprimés ou anonymisés, sauf obligation légale ou litige.</p>
        <h3>Transferts hors de l'Espace économique européen</h3><p>La base de données principale du projet Supabase est située dans la région eu-west-1 (Irlande). Cela ne signifie pas que toutes les opérations du prestataire restent exclusivement dans cette région : certaines opérations de compte fournisseur, d'assistance, de télémétrie, de sécurité ou de diffusion peuvent impliquer d'autres pays. GitHub et Supabase publient leurs propres informations sur les transferts et garanties applicables : <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">politique de confidentialité GitHub</a> et <a href="https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq" target="_blank" rel="noopener noreferrer">informations Supabase sur la résidence et les transferts de données</a>.</p>
        <h3>Sécurité</h3><p>Le responsable met en œuvre des mesures proportionnées pour limiter les accès aux seules personnes autorisées et protéger les comptes et données. Aucun service en ligne ne pouvant garantir une sécurité absolue, les incidents doivent être évalués et traités conformément aux obligations applicables. Les mots de passe ne doivent jamais être demandés par message ni communiqués à un membre de l'équipe.</p>
        <h3>Droits des personnes</h3><p>Dans les conditions prévues par la réglementation, chaque personne peut demander l'accès à ses données, leur rectification, leur effacement, la limitation du traitement, s'opposer à certains traitements et, lorsque cela s'applique, demander la portabilité. Elle peut également retirer un consentement lorsque le traitement repose sur celui-ci. Demandes à adresser à : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>. Une preuve d'identité ne sera demandée que si elle est nécessaire pour lever un doute raisonnable sur l'identité du demandeur. Une réclamation peut être adressée à la CNIL : <a href="https://www.cnil.fr/" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.</p>
        <h3>Mineurs</h3><p>Le service peut être utilisé par des personnes mineures. Le responsable doit adapter l'information à leur âge, limiter les données collectées et vérifier les règles applicables au consentement et aux services numériques proposés aux mineurs. Les utilisateurs ne doivent pas publier leur adresse personnelle, numéro de téléphone, établissement scolaire, mots de passe ou autres informations privées dans leur profil ou leurs contenus.</p>
        <p class="z431-legal-warning">Les catégories de données, bases légales, destinataires, durées de conservation, transferts et coordonnées ci-dessus doivent être rapprochés de la configuration réelle de Supabase, des formulaires et des autres services avant publication définitive. Les éléments entre crochets sont des champs obligatoires à compléter, pas des informations déjà confirmées.</p>
      </div></details>

      <details id="z431-legal-cookies"><summary>3. Cookies, stockage local et traceurs</summary><div>
        <p><strong>Authentification Supabase :</strong> le client Supabase utilisé par le site conserve normalement les informations de session dans le stockage local du navigateur (<em>localStorage</em>) afin de maintenir la connexion. Ce mécanisme de stockage local n'est pas un cookie. Il est utilisé pour une fonctionnalité explicitement demandée par l'utilisateur lorsqu'il se connecte.</p>
        <p><strong>Cookies :</strong> le code d'authentification consulté ne configure pas de cookie publicitaire ni de traceur de mesure d'audience. Aucun outil publicitaire ou analytique n'est déclaré dans ce module. Le site charge toutefois des ressources techniques externes, notamment la bibliothèque Supabase depuis un CDN ; ces fournisseurs peuvent recevoir les données techniques nécessaires à la livraison de ces ressources. L'ensemble des pages et scripts doit être réaudité à chaque ajout de service tiers afin de confirmer l'inventaire complet.</p>
        <p>Les mécanismes strictement nécessaires au fonctionnement d'une fonctionnalité demandée par l'utilisateur peuvent être exemptés de consentement selon leur finalité. Tout traceur non essentiel soumis au consentement devra être bloqué avant le choix de l'utilisateur et accompagné d'une possibilité simple de refus et de retrait. Les réglages du navigateur permettent de gérer le stockage local et les cookies, mais peuvent perturber la connexion ou certaines fonctionnalités.</p>
      </div></details>

      <details id="z431-legal-terms"><summary>4. Conditions générales d'utilisation</summary><div>
        <h3>Acceptation et accès</h3><p>L'utilisation du site implique le respect des présentes conditions et des règles communautaires communiquées par l'équipe. Certaines zones sont réservées aux comptes autorisés. La création d'un compte ne garantit pas automatiquement l'accès à l'ensemble des espaces.</p>
        <h3>Compte utilisateur</h3><p>L'utilisateur fournit des informations exactes dans la limite des informations demandées, protège ses moyens d'authentification et signale toute utilisation non autorisée de son compte. Il ne doit pas partager son mot de passe, usurper l'identité d'un tiers ni contourner les contrôles d'accès. L'équipe peut suspendre ou restreindre un compte en cas de violation des règles, sous réserve d'un traitement proportionné et des droits applicables.</p>
        <h3>Comportements interdits</h3><ul><li>Accéder ou tenter d'accéder à un espace, compte ou document sans autorisation.</li><li>Contourner les mesures de sécurité, perturber le site ou introduire un code malveillant.</li><li>Usurper une identité, harceler, menacer, discriminer ou publier des données personnelles sans autorisation.</li><li>Publier des contenus illicites, diffamatoires, frauduleux ou portant atteinte aux droits de tiers.</li><li>Utiliser les outils du site pour des activités réelles dangereuses ou contraires à la loi.</li></ul>
        <h3>Contenus publiés par les utilisateurs</h3><p>L'utilisateur reste responsable des contenus qu'il soumet et doit disposer des droits ou autorisations nécessaires. Il accorde au projet uniquement les autorisations techniques nécessaires à l'hébergement, l'affichage et l'administration de ces contenus dans le cadre du service. Il peut signaler un contenu problématique à l'adresse <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>. Les contenus peuvent être retirés lorsqu'une règle ou une obligation légale le justifie.</p>
        <h3>Roleplay et absence de service réel</h3><p>Les scénarios, grades, procédures, installations, organisations et documents de Zone-431 relèvent de la fiction et du jeu de rôle. Ils ne représentent pas des autorités, services publics, consignes professionnelles ou procédures opérationnelles réelles. Le site ne fournit aucune prestation d'urgence ou de sécurité réelle.</p>
        <h3>Disponibilité, maintenance et évolution</h3><p>Le site et ses fonctionnalités peuvent être modifiés, suspendus ou interrompus pour maintenance, sécurité, évolution technique ou indisponibilité d'un prestataire. Le responsable s'efforce de limiter les interruptions sans garantir une disponibilité permanente ni l'absence d'erreurs.</p>
        <h3>Liens externes et responsabilité</h3><p>Le site peut renvoyer vers des services tiers. Le responsable de Zone-431 ne contrôle pas leurs contenus ni leurs politiques. Les informations fictionnelles ne doivent pas être interprétées comme des informations officielles. Les règles impératives applicables aux consommateurs et utilisateurs demeurent réservées ; aucune clause ne vise à exclure une responsabilité qui ne pourrait légalement l'être.</p>
        <h3>Modification des conditions</h3><p>Les présentes conditions peuvent être mises à jour. La version publiée sur le site est celle applicable à compter de sa date de mise à jour : <strong>17 novembre 2026</strong>.</p>
      </div></details>

      <details id="z431-legal-license"><summary>5. Propriété intellectuelle, licences et crédits</summary><div>
        <h3>Créations originales</h3><p>Sauf mention contraire, les textes, documents, plans, visuels et créations originaux produits spécifiquement pour Zone-431 sont proposés sous licence <strong>Creative Commons Attribution – Pas d’Utilisation Commerciale – Partage dans les Mêmes Conditions 4.0 International (CC BY-NC-SA 4.0)</strong>, uniquement dans la mesure où le projet détient les droits nécessaires et peut valablement accorder cette licence.</p>
        <ul><li><strong>Attribution :</strong> créditer les auteurs, fournir un lien vers la licence et indiquer les modifications.</li><li><strong>Pas d'utilisation commerciale :</strong> ne pas exploiter les éléments concernés à des fins commerciales.</li><li><strong>Partage dans les mêmes conditions :</strong> distribuer les adaptations sous la même licence.</li></ul>
        <p>Texte de la licence : <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 — version française</a>.</p>
        <h3>Univers SCP et contenus de tiers</h3><p>Les éléments provenant du Wiki SCP ou d'autres créateurs ne sont pas automatiquement couverts par la licence appliquée aux créations originales Zone-431. Les contenus SCP sont soumis aux conditions de licence applicables à leur source, notamment la licence CC BY-SA 3.0 pour les contenus du Wiki SCP lorsque celle-ci s'applique. Les marques, logos, images, musiques, polices, bibliothèques et autres œuvres de tiers restent soumis à leurs licences et droits respectifs. Les crédits et attributions requis doivent être conservés.</p>
        <h3>Code source et logiciels</h3><p>La licence Creative Commons n'est pas une licence logicielle et ne couvre pas automatiquement le code source. Le code, les dépendances, bibliothèques et ressources techniques sont régis par leurs licences propres. Consulter les fichiers de licence du dépôt et des dépendances concernés.</p>
        <h3>Demandes relatives aux droits</h3><p>Pour signaler une utilisation non autorisée ou demander une correction de crédit : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>, avec l'URL du contenu et les éléments permettant d'établir les droits invoqués.</p>
      </div></details>

      <details id="z431-legal-contact"><summary>6. Contact, réclamations et signalements</summary><div>
        <p>Contact général : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>.<br>Données personnelles : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>.<br>Signalement de contenu ou sécurité : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>.<br>Propriété intellectuelle : <strong><a href="mailto:zone.431.rp@gmail.com">zone.431.rp@gmail.com</a></strong>.</p>
        <p>En cas de demande, indiquez le sujet, l'URL concernée et les informations strictement nécessaires à son traitement. Évitez de transmettre des mots de passe, pièces d'identité ou données sensibles sauf nécessité légale vérifiée et canal adapté.</p>
      </div></details>

      <p class="z431-legal-copy">Dernière révision : 17 novembre 2026. Ce document est établi à partir des informations communiquées par l'administrateur et de l'examen du code d'authentification disponible à cette date. Il doit être mis à jour si les traitements, prestataires, fonctionnalités ou modalités de conservation évoluent.</p>
    </div>`;
  document.body.appendChild(dialog);

  footer.addEventListener("click", event => {
    const button = event.target.closest("[data-legal-open]");
    if (!button) return;
    const id = button.dataset.legalOpen;
    dialog.querySelectorAll("details").forEach(item => item.open = false);
    const target = dialog.querySelector("#z431-legal-" + id);
    if (target) target.open = true;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
  dialog.querySelector(".z431-legal-close").addEventListener("click", () => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  });
  dialog.addEventListener("click", event => {
    if (event.target === dialog && typeof dialog.close === "function") dialog.close();
  });
})();