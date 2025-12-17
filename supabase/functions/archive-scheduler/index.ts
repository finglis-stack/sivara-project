// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  EMPI_NUM: 0x01, 
  EMPI_TXT: 0x02, 
  EGAL: 0x30, OU: 0x35, 
  ENV_LIRE: 0x50, EXIGER: 0x99
};

const ENV_EMAIL = 3; // ID pour env.utilisateur.email

// Clé universelle pour les archives publiques
const GRAINE_CONTENEUR_PUBLIC = "SIVARA_PUBLIC_CONTAINER_V1";

const strVersBuf = (str: string) => new TextEncoder().encode(str);

// Hachage DJB2 pour les chaînes (identique au Noyau)
const hacherChaine = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return hash >>> 0;
};

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

const genererBlocFantome = (): Uint8Array[] => {
  const taille = Math.floor(Math.random() * 64) + 16;
  const bruit = crypto.getRandomValues(new Uint8Array(taille));
  const lenBuffer = new Uint8Array(4);
  new DataView(lenBuffer.buffer).setUint32(0, taille);
  return [new Uint8Array([OP_SBP.BLOC_FANTOME]), lenBuffer, bruit];
};

// Générateur de Bytecode ACL (Liste de Contrôle d'Accès)
const genererBytecodeACL = (emailsAutorises: string[]): Uint8Array => {
    const bytecode: number[] = [];
    
    // Init: EMPI_NUM 0 (Faux) - État initial "Accès Refusé"
    bytecode.push(OP_VM.EMPI_NUM, 0, 0, 0, 0); 

    for (const email of emailsAutorises) {
        // 1. Récupérer Email Courant
        bytecode.push(OP_VM.ENV_LIRE, 0, 0, 0, ENV_EMAIL);
        
        // 2. EMPI Hash Email Autorisé
        const hash = hacherChaine(email.toLowerCase().trim());
        bytecode.push(OP_VM.EMPI_TXT, (hash >> 24) & 0xFF, (hash >> 16) & 0xFF, (hash >> 8) & 0xFF, hash & 0xFF);
        
        // 3. Comparer (EGAL)
        bytecode.push(OP_VM.EGAL);
        
        // 4. OU Logique (Si c'est bon, on passe à 1)
        bytecode.push(OP_VM.OU);
    }

    // Final: EXIGER (Si 0 -> Panique Noyau)
    bytecode.push(OP_VM.EXIGER);
    
    return new Uint8Array(bytecode);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. TIMING : 3 Minutes
    const troisMinutesAvant = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const { data: docsAArchiver, error: erreurRecup } = await supabase
      .from('documents')
      .select('id, title, content, encryption_iv, owner_id, icon, color, visibility')
      .eq('type', 'file') // EXCLUSION DES DOSSIERS
      .is('storage_path', null)
      .neq('content', '') 
      .lt('updated_at', troisMinutesAvant)
      .limit(15);

    if (erreurRecup) throw erreurRecup;

    console.log(`[Archiveur] ${docsAArchiver?.length || 0} fichiers inactifs (>3min) à traiter.`);

    const resultats = [];

    for (const doc of docsAArchiver || []) {
        if (!doc.content) continue;

        // --- LOGIQUE DE SÉCURITÉ (CONTRAT INTELLIGENT) ---
        let bytecodeVm: Uint8Array;
        let graineConteneur = doc.owner_id;

        if (doc.visibility === 'public') {
            // Public : Tout le monde passe, Graine publique
            graineConteneur = GRAINE_CONTENEUR_PUBLIC;
            // Bytecode: EMPI_NUM 1, EXIGER (Toujours vrai)
            bytecodeVm = new Uint8Array([OP_VM.EMPI_NUM, 0, 0, 0, 1, OP_VM.EXIGER]);
        } else {
            // Privé / Limité : Liste blanche stricte
            const emailsAutorises: string[] = [];
            
            // A. Récupérer l'email du propriétaire
            const { data: profilProprio } = await supabase.from('profiles').select('email').eq('id', doc.owner_id).single();
            if (profilProprio?.email) emailsAutorises.push(profilProprio.email);

            // B. Récupérer les invités (si limité)
            if (doc.visibility === 'limited') {
                const { data: listeAcces } = await supabase.from('document_access').select('email').eq('document_id', doc.id);
                if (listeAcces) listeAcces.forEach((a: any) => emailsAutorises.push(a.email));
            }

            // Génération du contrat
            bytecodeVm = genererBytecodeACL(emailsAutorises);
            console.log(`[Archiveur] ACL générée pour ${doc.id} : ${emailsAutorises.length} emails autorisés.`);
        }

        // --- CONSTRUCTION SBP ---
        const parties: Uint8Array[] = [];
        
        // En-tête
        parties.push(new Uint8Array([0x53, 0x56, 0x52, 0x02])); 

        // Bloc VM (Le contrat de sécurité)
        const lenBc = new Uint8Array(4);
        new DataView(lenBc.buffer).setUint32(0, bytecodeVm.length);
        parties.push(new Uint8Array([OP_SBP.BYTECODE_VM]));
        parties.push(lenBc);
        parties.push(bytecodeVm);

        // Bloc IV
        const chaineBinIv = atob(doc.encryption_iv);
        const bufIv = new Uint8Array(chaineBinIv.length);
        for (let i = 0; i < chaineBinIv.length; i++) bufIv[i] = chaineBinIv.charCodeAt(i);
        parties.push(new Uint8Array([OP_SBP.BLOC_IV]));
        parties.push(new Uint8Array([bufIv.length]));
        parties.push(bufIv);

        // Métadonnées
        const jsonMeta = JSON.stringify({ 
            owner_id: doc.owner_id, 
            icon: doc.icon, 
            color: doc.color,
            visibility: doc.visibility,
            archived_at: new Date().toISOString(),
            type: 'auto-archive'
        });
        const bufMeta = strVersBuf(jsonMeta);
        const lenMeta = new Uint8Array(4);
        new DataView(lenMeta.buffer).setUint32(0, bufMeta.length);
        parties.push(new Uint8Array([OP_SBP.BALISE_META]));
        parties.push(lenMeta);
        parties.push(bufMeta);

        // Bloc Fantôme
        parties.push(...genererBlocFantome());

        // Charge Utile
        const bufTitre = strVersBuf(doc.title);
        const bufContenu = strVersBuf(doc.content);
        const chargeUtileCombinee = new Uint8Array(bufTitre.length + 1 + bufContenu.length);
        chargeUtileCombinee.set(bufTitre, 0);
        chargeUtileCombinee[bufTitre.length] = 0x00;
        chargeUtileCombinee.set(bufContenu, bufTitre.length + 1);

        const chargeUtileMelangee = melangeSivara(chargeUtileCombinee, graineConteneur);
        const lenCharge = new Uint8Array(4);
        new DataView(lenCharge.buffer).setUint32(0, chargeUtileMelangee.length);
        parties.push(new Uint8Array([OP_SBP.MORCEAU_DONNEES]));
        parties.push(lenCharge);
        parties.push(chargeUtileMelangee);

        // Fin de Fichier
        parties.push(new Uint8Array([OP_SBP.FIN_FICHIER]));

        // Assemblage
        const longueurTotale = parties.reduce((acc, p) => acc + p.length, 0);
        const tamponFinal = new Uint8Array(longueurTotale);
        let decalage = 0;
        for (const partie of parties) { tamponFinal.set(partie, decalage); decalage += partie.length; }

        // Upload
        const cheminFichier = `${doc.owner_id}/${doc.id}.sivara`;
        const { error: erreurUpload } = await supabase.storage
            .from('doc-archives')
            .upload(cheminFichier, tamponFinal, {
                contentType: 'application/x-sivara-binary',
                upsert: true
            });

        if (erreurUpload) {
            console.error(`Erreur upload ${doc.id}:`, erreurUpload);
            continue;
        }

        // Mise à jour DB (Stockage Froid)
        const { error: erreurMaj } = await supabase
            .from('documents')
            .update({ 
                content: '', // Contenu vidé
                storage_path: cheminFichier 
            })
            .eq('id', doc.id);

        if (!erreurMaj) {
            resultats.push(doc.id);
        }
    }

    return new Response(JSON.stringify({ archived: resultats.length, ids: resultats }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (erreur) {
    console.error(erreur);
    return new Response(JSON.stringify({ error: erreur.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})