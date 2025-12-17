// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const CLE_GEO_IP = Deno.env.get('IPGEOLOCATION_API_KEY');
const GRAINE_CONTENEUR_PUBLIC = "SIVARA_PUBLIC_CONTAINER_V1";

// --- PROTOCOLE BINAIRE SIVARA (SBP) ---
const OP_SBP = {
  MAGIE: 0x53, // 'S'
  ENTETE: 0xA1,
  BLOC_IV: 0xB2,
  MORCEAU_DONNEES: 0xC3,
  BALISE_META: 0xD4,
  BLOC_FANTOME: 0x1F,
  BYTECODE_VM: 0xE5,
  FIN_FICHIER: 0xFF
};

// --- JEU D'INSTRUCTIONS VM (ISA) ---
const OP_VM = {
  ARRET: 0x00,
  EMPI_NUM: 0x01, // Empiler Numérique
  EMPI_TXT: 0x02, // Empiler Texte (Hash)
  CHARGER: 0x10,  // Charger variable
  STOCKER: 0x11,  // Stocker variable
  
  // Mathématiques
  ADD: 0x20, SOUS: 0x21, MULT: 0x22, DIV: 0x23, ABS: 0x24,
  
  // Logique
  EGAL: 0x30, DIFF: 0x31, INF: 0x32, SUP: 0x33, ET: 0x34, OU: 0x35,
  
  // Contrôle de flux
  SAUT: 0x40, SAUT_SI_FAUX: 0x41,
  
  // Environnement & Sécurité
  ENV_LIRE: 0x50,   // Récupérer variable env
  GEO_DIST: 0x51,   // Calcul distance
  LISTE_A: 0x52,    // Vérifier présence liste
  EXIGER: 0x99      // KERNEL PANIC si faux
};

// --- MAPPAGE ENVIRONNEMENT ---
const CARTE_ENV: Record<string, number> = {
  'env.geo.lat': 1,
  'env.geo.lng': 2,
  'env.utilisateur.email': 3,
  'env.appareil.empreinte': 4,
  'env.temps.actuel': 5
};

// --- COMPILATEUR SIVARASCRIPT (FRANÇAIS) ---
class CompilateurSivara {
  private jetons: string[];
  private pos: number = 0;
  private bytecode: number[] = [];

  constructor(source: string) {
    // Analyseur lexical simple
    this.jetons = source
      .replace(/\(/g, ' ( ')
      .replace(/\)/g, ' ) ')
      .replace(/,/g, ' ')
      .replace(/==/g, ' EGAL ')
      .replace(/</g, ' INF ')
      .replace(/>/g, ' SUP ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  // Hachage DJB2 pour les chaînes
  private hacherChaine(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0; // Force non-signé 32-bit
  }

  public compiler(): Uint8Array {
    while (this.pos < this.jetons.length) {
      const jeton = this.jetons[this.pos++];
      
      if (jeton === 'soit') {
        const nomVar = this.jetons[this.pos++];
        if (this.jetons[this.pos++] !== '=') throw new Error(`Erreur Syntaxe: '=' attendu après ${nomVar}`);
        this.compilerExpression();
        this.emettre(OP_VM.STOCKER, this.hacherChaine(nomVar));
      }
      else if (jeton === 'exiger') {
        this.compilerExpression();
        this.emettre(OP_VM.EXIGER);
      }
      // Note: 'si' implémenté basiquement pour la structure linéaire des ACL
    }
    this.emettre(OP_VM.ARRET);
    return new Uint8Array(this.bytecode);
  }

  private compilerExpression() {
    const jeton = this.jetons[this.pos++];
    
    // Fonctions natives
    if (jeton === 'calcul_distance') {
        this.pos++; // Sauter (
        this.compilerExpression(); // lat1
        this.compilerExpression(); // lng1
        this.compilerExpression(); // lat2
        this.compilerExpression(); // lng2
        this.pos++; // Sauter )
        this.emettre(OP_VM.GEO_DIST);
        return;
    }
    
    if (jeton === 'liste_contient') {
        this.pos++; 
        this.compilerExpression(); 
        this.compilerExpression(); 
        this.pos++; 
        this.emettre(OP_VM.LISTE_A);
        return;
    }

    if (jeton === 'abs') {
        this.compilerExpression();
        this.emettre(OP_VM.ABS);
        return;
    }

    // Valeurs littérales
    if (!isNaN(Number(jeton))) {
      this.emettre(OP_VM.EMPI_NUM, Number(jeton));
    } 
    // Variables d'environnement
    else if (CARTE_ENV[jeton]) {
      this.emettre(OP_VM.ENV_LIRE, CARTE_ENV[jeton]);
    }
    // Chaînes de caractères
    else if (jeton.startsWith('"')) {
      let str = jeton;
      while (!str.endsWith('"') && this.pos < this.jetons.length) {
          str += " " + this.jetons[this.pos++];
      }
      str = str.replace(/"/g, '');
      this.emettre(OP_VM.EMPI_TXT, this.hacherChaine(str));
    }
    // Variables utilisateur
    else {
      this.emettre(OP_VM.CHARGER, this.hacherChaine(jeton));
    }

    // Opérateurs binaires
    if (this.pos < this.jetons.length) {
        const suivant = this.jetons[this.pos];
        if (['+', '-', '*', '/', 'EGAL', 'INF', 'SUP', 'ET', 'OU'].includes(suivant)) {
            this.pos++;
            this.compilerExpression(); // Récursif
            
            if (suivant === '+') this.emettre(OP_VM.ADD);
            if (suivant === '-') this.emettre(OP_VM.SOUS);
            if (suivant === '*') this.emettre(OP_VM.MULT);
            if (suivant === '/') this.emettre(OP_VM.DIV);
            if (suivant === 'EGAL') this.emettre(OP_VM.EGAL);
            if (suivant === 'INF') this.emettre(OP_VM.INF);
            if (suivant === 'SUP') this.emettre(OP_VM.SUP);
            if (suivant === 'ET') this.emettre(OP_VM.ET);
            if (suivant === 'OU') this.emettre(OP_VM.OU);
        }
    }
  }

  private emettre(op: number, arg?: number) {
    this.bytecode.push(op);
    if (arg !== undefined) {
       this.bytecode.push((arg >> 24) & 0xFF);
       this.bytecode.push((arg >> 16) & 0xFF);
       this.bytecode.push((arg >> 8) & 0xFF);
       this.bytecode.push(arg & 0xFF);
    }
  }
}

// --- MACHINE VIRTUELLE (NOYAU) ---
class NoyauSivara {
  private pile: any[] = [];
  private memoire: Record<number, any> = {};
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  private obtenirDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private hacherChaine(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
    return hash >>> 0;
  }

  public executer(bytecode: Uint8Array): boolean {
    let ip = 0;
    const vue = new DataView(bytecode.buffer);

    try {
      while (ip < bytecode.length) {
        const op = bytecode[ip++];

        switch (op) {
          case OP_VM.ARRET: return true;

          case OP_VM.EMPI_NUM:
            this.pile.push(vue.getInt32(ip)); ip += 4;
            break;
          
          case OP_VM.EMPI_TXT:
            this.pile.push(vue.getInt32(ip)); ip += 4;
            break;

          case OP_VM.ENV_LIRE:
            const idEnv = vue.getInt32(ip); ip += 4;
            if (idEnv === 1) this.pile.push(this.env.lat || 0);
            else if (idEnv === 2) this.pile.push(this.env.lng || 0);
            else if (idEnv === 3) this.pile.push(this.hacherChaine(this.env.email || ""));
            else if (idEnv === 4) this.pile.push(this.hacherChaine(this.env.fingerprint || ""));
            else if (idEnv === 5) this.pile.push(Date.now());
            else this.pile.push(0);
            break;

          case OP_VM.STOCKER:
            const adr = vue.getInt32(ip); ip += 4;
            this.memoire[adr] = this.pile.pop();
            break;

          case OP_VM.CHARGER:
            const adrCharg = vue.getInt32(ip); ip += 4;
            this.pile.push(this.memoire[adrCharg]);
            break;

          // Maths
          case OP_VM.ADD: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push(a + b); break; }
          case OP_VM.SOUS: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push(a - b); break; }
          case OP_VM.INF: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push(a < b ? 1 : 0); break; }
          case OP_VM.SUP: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push(a > b ? 1 : 0); break; }
          case OP_VM.EGAL: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push(a === b ? 1 : 0); break; }
          case OP_VM.ABS: { const a = this.pile.pop(); this.pile.push(Math.abs(a)); break; }

          // Logique
          case OP_VM.ET: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push((a && b) ? 1 : 0); break; }
          case OP_VM.OU: { const b = this.pile.pop(); const a = this.pile.pop(); this.pile.push((a || b) ? 1 : 0); break; }

          case OP_VM.GEO_DIST:
            const lng2 = this.pile.pop(); const lat2 = this.pile.pop();
            const lng1 = this.pile.pop(); const lat1 = this.pile.pop();
            this.pile.push(this.obtenirDistance(lat1, lng1, lat2, lng2));
            break;

          case OP_VM.LISTE_A:
             const val = this.pile.pop();
             const hashListe = this.pile.pop(); 
             this.pile.push(val === hashListe ? 1 : 0);
             break;

          case OP_VM.EXIGER:
            const verif = this.pile.pop();
            if (verif !== 1) {
               console.error("PANIQUE NOYAU: Assertion échouée. Violation de sécurité.");
               return false;
            }
            break;
        }
      }
    } catch (e) {
      console.error("Erreur d'exécution VM:", e);
      return false;
    }
    return true;
  }
}

// --- UTILITAIRES ---
const bufVersTexte = (buf: Uint8Array) => new TextDecoder().decode(buf);
const texteVersBuf = (str: string) => new TextEncoder().encode(str);

const melangeSivara = (buffer: Uint8Array, graineChaine: string): Uint8Array => {
  let graine = 0;
  for (let i = 0; i < graineChaine.length; i++) {
    graine = ((graine << 5) - graine) + graineChaine.charCodeAt(i);
    graine |= 0;
  }
  const resultat = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const cle = (graine + i) & 0xFF; 
    resultat[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ cle;
  }
  return resultat;
};

const demelangeSivara = (buffer: Uint8Array, graineChaine: string): Uint8Array => {
  let graine = 0;
  for (let i = 0; i < graineChaine.length; i++) {
    graine = ((graine << 5) - graine) + graineChaine.charCodeAt(i);
    graine |= 0;
  }
  const resultat = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const cle = (graine + i) & 0xFF; 
    const val = buffer[i] ^ cle;
    resultat[i] = (val >> 2) | (val << 6);
  }
  return resultat;
};

// --- GÉNÉRATEUR DE CONTRAT INTELLIGENT (JSON -> SIVARASCRIPT) ---
const genererScriptSivara = (securite: any): string => {
    let script = "";
    
    // 1. Restriction Utilisateur (Email)
    if (securite.allowed_emails && securite.allowed_emails.length > 0) {
        const emailProprio = securite.allowed_emails[0];
        script += `soit email_cible = "${emailProprio}"\n`;
        script += `soit email_courant = env.utilisateur.email\n`;
        script += `exiger ( email_courant == email_cible )\n`;
    }

    // 2. Geofencing
    if (securite.geofence) {
        script += `soit ma_lat = env.geo.lat\n`;
        script += `soit ma_lng = env.geo.lng\n`;
        script += `soit cible_lat = ${securite.geofence.lat}\n`;
        script += `soit cible_lng = ${securite.geofence.lng}\n`;
        script += `soit distance = calcul_distance ( ma_lat , ma_lng , cible_lat , cible_lng )\n`;
        script += `soit rayon = ${securite.geofence.radius_km}\n`;
        script += `exiger ( distance INF rayon )\n`;
    }

    // 3. Verrouillage Appareil (Fingerprint)
    if (securite.allowed_fingerprints && securite.allowed_fingerprints.length > 0) {
        const fp = securite.allowed_fingerprints[0];
        script += `soit fp_cible = "${fp}"\n`;
        script += `soit fp_courant = env.appareil.empreinte\n`;
        script += `exiger ( fp_courant == fp_cible )\n`;
    }

    return script;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData, context, body } = await req.json();
    
    const donneesRequete = body || { action, payload, fileData, context };
    const actionReq = donneesRequete.action;

    // --- LOCALISATION ---
    if (actionReq === 'locate_me') {
        const ipClient = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
        if (!CLE_GEO_IP) throw new Error("Service de géolocalisation non configuré.");
        const repGeo = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${CLE_GEO_IP}&ip=${ipClient}`);
        const donneesGeo = await repGeo.json();
        return new Response(JSON.stringify({ 
            lat: parseFloat(donneesGeo.latitude), 
            lng: parseFloat(donneesGeo.longitude),
            ip: ipClient,
            city: donneesGeo.city
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- COMPILATION (Export .sivara) ---
    if (actionReq === 'compile') {
       const { payload } = donneesRequete;
       
       // 1. Génération du Contrat Intelligent en Français
       const sourceScript = genererScriptSivara(payload.security || {});
       console.log("[Noyau] Compilation du script:\n", sourceScript);

       // 2. Compilation en Bytecode
       const compilateur = new CompilateurSivara(sourceScript);
       const bytecode = compilateur.compiler();

       // 3. Construction du Conteneur SBP
       const parties: Uint8Array[] = [];
       
       // En-tête
       parties.push(new Uint8Array([0x53, 0x56, 0x52, 0x02])); 

       // Bloc Bytecode
       const lenBc = new Uint8Array(4);
       new DataView(lenBc.buffer).setUint32(0, bytecode.length);
       parties.push(new Uint8Array([OP_SBP.BYTECODE_VM]));
       parties.push(lenBc);
       parties.push(bytecode);

       // Bloc IV
       const chaineBinIv = atob(payload.iv);
       const bufIv = new Uint8Array(chaineBinIv.length);
       for (let i = 0; i < chaineBinIv.length; i++) bufIv[i] = chaineBinIv.charCodeAt(i);
       parties.push(new Uint8Array([OP_SBP.BLOC_IV]));
       parties.push(new Uint8Array([bufIv.length]));
       parties.push(bufIv);

       // Morceau de Données (Titre + Contenu Chiffrés)
       const bufTitre = texteVersBuf(payload.encrypted_title);
       const bufContenu = texteVersBuf(payload.encrypted_content);
       const chargeUtileCombinee = new Uint8Array(bufTitre.length + 1 + bufContenu.length);
       chargeUtileCombinee.set(bufTitre, 0);
       chargeUtileCombinee[bufTitre.length] = 0x00;
       chargeUtileCombinee.set(bufContenu, bufTitre.length + 1);

       // Mélange avec le sel (ou owner_id si pas de sel)
       const graine = payload.salt || payload.owner_id;
       const chargeUtileMelangee = melangeSivara(chargeUtileCombinee, graine);
       
       const lenCharge = new Uint8Array(4);
       new DataView(lenCharge.buffer).setUint32(0, chargeUtileMelangee.length);
       parties.push(new Uint8Array([OP_SBP.MORCEAU_DONNEES]));
       parties.push(lenCharge);
       parties.push(chargeUtileMelangee);

       // Balise Méta
       const jsonMeta = JSON.stringify({ 
           owner_id: payload.owner_id, 
           salt: payload.salt, 
           icon: payload.icon,
           color: payload.color
       });
       const bufMeta = texteVersBuf(jsonMeta);
       const lenMeta = new Uint8Array(4);
       new DataView(lenMeta.buffer).setUint32(0, bufMeta.length);
       parties.push(new Uint8Array([OP_SBP.BALISE_META]));
       parties.push(lenMeta);
       parties.push(bufMeta);

       parties.push(new Uint8Array([OP_SBP.FIN_FICHIER]));

       // Assemblage final
       const longueurTotale = parties.reduce((acc, p) => acc + p.length, 0);
       const tamponFinal = new Uint8Array(longueurTotale);
       let decalage = 0;
       for (const partie of parties) { tamponFinal.set(partie, decalage); decalage += partie.length; }

       // Retour en Base64
       let binaire = '';
       for (let i = 0; i < tamponFinal.length; i++) binaire += String.fromCharCode(tamponFinal[i]);
       
       return new Response(JSON.stringify({ file: btoa(binaire) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- DÉCOMPILATION (Import / Lecture) ---
    if (actionReq === 'decompile') {
      const { fileData, context } = donneesRequete;
      const chaineBinaire = atob(fileData);
      const octets = new Uint8Array(chaineBinaire.length);
      for (let i = 0; i < chaineBinaire.length; i++) { octets[i] = chaineBinaire.charCodeAt(i); }
      
      const vue = new DataView(octets.buffer);
      
      if (octets[0] !== 0x53 || octets[1] !== 0x56 || octets[2] !== 0x52) throw new Error("Format SBP invalide.");
      
      // Récupération du contexte utilisateur pour la VM
      const supabase = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      let emailUtilisateur = "";
      if (context?.userId) {
          const { data: u } = await supabase.auth.admin.getUserById(context.userId);
          emailUtilisateur = u?.user?.email || "";
      }

      // Environnement VM Réel
      let envVm = { 
          lat: 0, lng: 0, 
          email: emailUtilisateur, 
          fingerprint: context?.fingerprint || "" 
      };

      // Enrichissement Geo (si possible)
      try {
          const ipClient = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
          if (CLE_GEO_IP) {
             const repGeo = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${CLE_GEO_IP}&ip=${ipClient}`);
             const donneesGeo = await repGeo.json();
             envVm.lat = parseFloat(donneesGeo.latitude);
             envVm.lng = parseFloat(donneesGeo.longitude);
          }
      } catch(e) {}

      const tentativeDecompilation = (graine: string) => {
          let curseur = 4; 
          const resultat: any = { header: 'SIVARA_SECURE_DOC_V2' };
          let metaDonnees: any = {};
          let succes = true;
          let vmValidee = true;

          const vm = new NoyauSivara(envVm);

          while (curseur < octets.length) {
            const opcode = octets[curseur++];
            if (opcode === OP_SBP.FIN_FICHIER) break;

            if (opcode === OP_SBP.BLOC_FANTOME) {
                const len = vue.getUint32(curseur);
                curseur += 4 + len;
                continue;
            }
            else if (opcode === OP_SBP.BYTECODE_VM) {
                const len = vue.getUint32(curseur);
                curseur += 4;
                const bytecode = octets.slice(curseur, curseur + len);
                
                console.log("[Noyau] Exécution du Contrat Intelligent...");
                const resultatVm = vm.executer(bytecode);
                if (!resultatVm) {
                    console.error("[Noyau] Échec de la vérification de sécurité");
                    vmValidee = false;
                    succes = false;
                    break; // Arrêt immédiat
                }
                curseur += len;
            }
            else if (opcode === OP_SBP.BLOC_IV) {
              const len = octets[curseur++];
              const octetsIv = octets.slice(curseur, curseur + len);
              let binIv = '';
              for(let i=0; i<octetsIv.length; i++) binIv += String.fromCharCode(octetsIv[i]);
              resultat.iv = btoa(binIv);
              curseur += len;
            }
            else if (opcode === OP_SBP.BALISE_META) {
              const len = vue.getUint32(curseur);
              curseur += 4;
              const morceau = octets.slice(curseur, curseur + len);
              try {
                 const jsonStr = bufVersTexte(morceau);
                 metaDonnees = JSON.parse(jsonStr);
                 Object.assign(resultat, metaDonnees);
              } catch(e) {}
              curseur += len;
            }
            else if (opcode === OP_SBP.MORCEAU_DONNEES) {
              if (!vmValidee) break; // On ne lit pas les données si la VM a échoué

              const len = vue.getUint32(curseur);
              curseur += 4;
              const morceau = octets.slice(curseur, curseur + len);
              const morceauClair = demelangeSivara(morceau, graine);
              
              let indexSeparateur = -1;
              for(let i=0; i<morceauClair.length; i++) { if (morceauClair[i] === 0x00) { indexSeparateur = i; break; } }
              
              if (indexSeparateur !== -1) {
                  resultat.encrypted_title = bufVersTexte(morceauClair.slice(0, indexSeparateur));
                  resultat.encrypted_content = bufVersTexte(morceauClair.slice(indexSeparateur + 1));
              } else {
                  // Si pas de séparateur, la graine est probablement mauvaise
                  succes = false;
              }
              curseur += len;
            }
          }
          return succes ? resultat : null;
      };

      // 1. Lecture préliminaire pour trouver le propriétaire/sel (via BALISE_META)
      let resultatTemp = tentativeDecompilation("DUMMY"); 
      let idProprio = resultatTemp?.owner_id;
      let sel = resultatTemp?.salt;

      // 2. Tentative de déchiffrement réel
      let resultatFinal = null;

      // A. Si public
      resultatFinal = tentativeDecompilation(GRAINE_CONTENEUR_PUBLIC);

      // B. Si privé (avec ID utilisateur courant)
      if (!resultatFinal && context?.userId) {
           resultatFinal = tentativeDecompilation(context.userId);
      }

      // C. Si privé (avec ID propriétaire du fichier - cas import)
      if (!resultatFinal && idProprio) {
           resultatFinal = tentativeDecompilation(idProprio);
      }
      
      // D. Si protégé par mot de passe (Sel présent)
      if (!resultatFinal && sel) {
           return new Response(JSON.stringify({ 
               error: "Mot de passe requis", 
               require_auth: true,
               salt: sel,
               iv: resultatTemp?.iv,
               header: 'SIVARA_SECURE_DOC_V2'
           }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (resultatFinal && resultatFinal.encrypted_title) {
          return new Response(JSON.stringify(resultatFinal), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
          return new Response(JSON.stringify({ error: "Accès refusé par le Noyau ou fichier corrompu" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    throw new Error("Instruction inconnue");

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})