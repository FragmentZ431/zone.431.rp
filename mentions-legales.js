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
    #z431-legal-dialog{width:min(900px,calc(100% - 28px));max-height:85vh;overflow:auto;padding:0;border:1px solid #394654;border-top:3px solid #a52c32;background:#0d141d;color:#dce3eb;box-shadow:0 24px 90px #000b}
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
        <button type="button" data-legal-open="privacy">Confidentialité</button>
        <button type="button" data-legal-open="terms">Conditions d'utilisation</button>
        <button type="button" data-legal-open="license">Licence & crédits</button>
      </div>
      <div class="z431-legal-copy">© Zone-431 — Projet communautaire indépendant</div>
    </div>`;
  document.body.appendChild(footer);

  const dialog = document.createElement("dialog");
  dialog.id = "z431-legal-dialog";
  dialog.innerHTML = `
    <div class="z431-legal-head"><h2>INFORMATIONS JURIDIQUES // ZONE-431</h2><button class="z431-legal-close" type="button" aria-label="Fermer">FERMER ✕</button></div>
    <div class="z431-legal-content">
      <p class="z431-legal-warning"><strong>Projet non officiel :</strong> Zone-431 est un projet communautaire de jeu de rôle et de création fictionnelle. Il n'est ni affilié, ni approuvé, ni administré par la SCP Foundation ou par les détenteurs de ses marques.</p>
      <details id="z431-legal-mentions" open><summary>1. Mentions légales</summary><div>
        <h3>Édition du site</h3>
        <p>Nom du projet : <strong>Zone-431</strong>.<br>Responsable de publication : <strong>à compléter par le responsable du projet</strong>.<br>Statut de l'éditeur : <strong>à préciser (personne physique ou structure)</strong>.<br>Contact : <strong>adresse de contact à renseigner</strong>.</p>
        <h3>Hébergement</h3>
        <p>Le site public est publié au moyen de GitHub Pages. Prestataire : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Les modalités exactes d'hébergement et de traitement sont soumises aux conditions du prestataire.</p>
        <h3>Objet</h3><p>Le site présente un univers fictif, des contenus de roleplay, des informations communautaires et des outils numériques associés.</p>
        <p><strong>À compléter avant publication définitive :</strong> identité légale de l'éditeur, adresse de contact et éventuelles coordonnées obligatoires selon son statut.</p>
      </div></details>
      <details id="z431-legal-privacy"><summary>2. Politique de confidentialité</summary><div>
        <h3>Données susceptibles d'être traitées</h3>
        <p>Selon les fonctionnalités effectivement utilisées, le site peut traiter les identifiants de compte et informations de profil nécessaires à l'espace membre, ainsi que les informations transmises volontairement via les formulaires. Les services techniques (notamment l'hébergement et l'authentification) peuvent également traiter des données techniques nécessaires à leur fonctionnement.</p>
        <h3>Finalités et prestataires</h3><p>Les données sont utilisées pour gérer les accès, les comptes, la sécurité et les demandes adressées au projet. Certaines fonctions reposent sur Supabase et GitHub Pages. Les paramètres, durées de conservation, lieux d'hébergement et éventuels transferts doivent être vérifiés dans la configuration réelle des services.</p>
        <h3>Vos droits</h3><p>Selon la réglementation applicable, vous pouvez demander l'accès, la rectification, l'effacement, la limitation ou vous opposer à certains traitements. Pour exercer vos droits : <strong>contact du responsable à renseigner</strong>. Vous pouvez également saisir la CNIL.</p>
        <p class="z431-legal-warning">Cette rubrique est une base de rédaction : le responsable du traitement, les durées de conservation, les destinataires et les mécanismes de consentement doivent être renseignés après audit des formulaires, de Supabase, des journaux et des éventuels cookies/traceurs réellement utilisés.</p>
      </div></details>
      <details id="z431-legal-terms"><summary>3. Conditions générales d'utilisation</summary><div>
        <h3>Nature du service</h3><p>Zone-431 est un environnement communautaire de roleplay. Les éléments narratifs, installations, personnages, procédures et organisations fictives sont destinés au jeu et ne constituent pas des instructions ou services réels.</p>
        <h3>Comportement des utilisateurs</h3><p>L'utilisateur s'engage à respecter les règles communautaires, à ne pas tenter d'accéder sans autorisation aux espaces réservés, à ne pas perturber le fonctionnement du site et à ne pas publier de contenus illicites ou portant atteinte aux droits de tiers.</p>
        <h3>Disponibilité et évolution</h3><p>Le site peut être modifié, suspendu ou interrompu pour maintenance ou raisons de sécurité. Les espaces membres et outils peuvent être soumis à autorisation.</p>
        <h3>Responsabilité</h3><p>Le projet est fourni dans le cadre d'une activité communautaire. Les informations fictives ne doivent pas être interprétées comme des consignes opérationnelles réelles. Les limitations de responsabilité s'appliquent dans les limites autorisées par la loi.</p>
        <p>Les présentes conditions devront être complétées et validées par le responsable du site avant d'être considérées comme définitives.</p>
      </div></details>
      <details id="z431-legal-license"><summary>4. Propriété intellectuelle, licence et crédits</summary><div>
        <h3>Contenus originaux Zone-431</h3><p>Sauf mention contraire, les textes, documents, visuels et créations originaux spécifiquement produits pour le projet Zone-431 sont proposés sous licence <strong>Creative Commons Attribution – Pas d’Utilisation Commerciale – Partage dans les Mêmes Conditions 4.0 International (CC BY-NC-SA 4.0)</strong>, dans la mesure où le projet détient effectivement les droits nécessaires.</p>
        <ul><li><strong>Attribution (BY) :</strong> créditer les créateurs et indiquer les modifications.</li><li><strong>Pas d'utilisation commerciale (NC) :</strong> ne pas exploiter les contenus à des fins commerciales.</li><li><strong>Partage dans les mêmes conditions (SA) :</strong> diffuser les adaptations sous la même licence.</li></ul>
        <p>Texte complet : <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 — version française</a>.</p>
        <h3>Éléments de tiers et univers SCP</h3><p>Cette licence ne s'applique pas automatiquement aux marques, logos, œuvres, personnages, textes ou autres éléments appartenant à des tiers. Les contenus issus de la communauté SCP sont soumis à leurs propres conditions de licence, notamment la licence CC BY-SA applicable aux contenus du Wiki SCP, lorsqu'elle s'applique. Les éléments tiers restent soumis à leurs licences et crédits respectifs.</p>
        <h3>Code source, marques et outils</h3><p>La licence Creative Commons ci-dessus ne constitue pas une licence logicielle et ne couvre pas automatiquement le code source, les bibliothèques, les marques ou les ressources de tiers. Les licences propres à ces éléments prévalent.</p>
      </div></details>
      <details><summary>5. Contact et signalement</summary><div><p>Pour toute question juridique, demande relative aux données personnelles ou signalement concernant un contenu, contactez le responsable du projet à l'adresse qui sera publiée ici : <strong>contact à renseigner</strong>.</p></div></details>
      <p class="z431-legal-copy">Document de travail à finaliser : les champs d'identification et les informations relatives aux traitements doivent être vérifiés avant publication comme mentions légales définitives.</p>
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
    if (event.target === dialog) dialog.close();
  });
})();