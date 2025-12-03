// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.13.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Nettoyage agressif des strings (vire accents, espaces, tirets)
const normalizeString = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, ""); 
};

// Comparaison floue (Fuzzy Matching)
const calculateSimilarity = (s1: string, s2: string) => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  
  const editDistance = (s1: string, s2: string) => {
    s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i == 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
};

// Générateur de NAM théorique (Algorithme RAMQ)
const generateTheoreticalNAM = (first: string, last: string, dob: string, sex: 'M' | 'F' = 'M') => {
    try {
        const normLast = normalizeString(last).padEnd(3, 'X').toUpperCase();
        const normFirst = normalizeString(first).padEnd(1, 'X').toUpperCase();
        
        const date = new Date(dob);
        const year = date.getFullYear().toString().slice(-2);
        let month = date.getMonth() + 1;
        const day = date.getDate().toString().padStart(2, '0');

        // Si on ne connait pas le sexe, on génère les deux possibilités (Mois et Mois+50)
        const codeStart = (normLast.substring(0, 3) + normFirst.substring(0, 1));
        const codeEnd = day; // La fin complète est inconnue (séquence aléatoire), on check le début
        
        return {
            maleBase: `${codeStart}${year}${month.toString().padStart(2, '0')}${day}`,
            femaleBase: `${codeStart}${year}${(month + 50).toString().padStart(2, '0')}${day}`
        };
    } catch (e) {
        return null;
    }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let attemptId = null;
  const startTime = new Date().toISOString();
  const todayDate = new Date().toISOString().split('T')[0];
  const detailedLogs: string[] = [];

  const log = (msg: string) => {
      console.log(msg);
      detailedLogs.push(`[${new Date().toISOString().split('T')[1].slice(0,8)}] ${msg}`);
  };

  try {
    const body = await req.json();
    const { frontImage, backImage, fingerprint, userId } = body;

    if (!userId) throw new Error("UserID manquant");

    // 1. Check Limite Tentatives (Max 3)
    const { count } = await supabase
        .from('identity_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'rejected')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Max 3 par 24h

    if (count && count >= 3) {
        return new Response(JSON.stringify({ 
            status: 'REJECT', 
            reason: "Nombre maximum de tentatives atteint. Veuillez contacter le support.",
            fatal: true
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Récupération Profil DB
    const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();

    if (!profile) throw new Error("Profil introuvable");

    // Création entrée DB
    const { data: logEntry } = await supabase
        .from('identity_verifications')
        .insert({ user_id: userId, started_at: startTime, status: 'processing', fingerprint_data: fingerprint })
        .select('id')
        .single();
    if (logEntry) attemptId = logEntry.id;

    log(`Analyse pour: ${profile.first_name} ${profile.last_name}`);

    // 3. IA : ANALYSE VISUELLE POUSSÉE
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imageParts = [{ inlineData: { data: frontImage, mimeType: "image/jpeg" } }];
    if (backImage) imageParts.push({ inlineData: { data: backImage, mimeType: "image/jpeg" } });

    const prompt = `
      You are a forensic document expert specializing in Quebec RAMQ cards, Canadian Driver Licenses, and Passports.
      
      CRITICAL CONTEXT:
      - RAMQ cards have **EMBOSSED TEXT** (raised letters). In photos, this creates shadows/highlights. 
      - "H" often reads as "F", "B" as "E", "8" as "B". BE EXTREMELY SMART ABOUT THIS.
      - "M" or "F" alone is Sex, not a Name.
      - Administrative codes (like "INGF...") are NOT names.
      - Ignore small text. Focus on the big embossed areas.

      TASK: Extract data and estimate visual age.

      RETURN JSON ONLY:
      {
        "docType": "RAMQ" | "DL" | "PASSPORT",
        "firstName": "string (Clean extraction, guess if ambiguous)",
        "lastName": "string",
        "documentNumber": "string (The RAMQ NAM or DL Number)",
        "dateOfBirth": "YYYY-MM-DD (ISO Format)",
        "expirationDate": "YYYY-MM-DD",
        "visualAgeEstimation": number (Estimate age of person in photo),
        "isExpired": boolean (Is expirationDate before ${todayDate}?),
        "isScreen": boolean (Is this a photo of a screen?),
        "isDigitalEdit": boolean
      }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const extraction = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
    
    log(`Extraction IA: ${JSON.stringify(extraction)}`);

    // 4. MOTEUR DE VALIDATION (SCORING)
    let trustScore = 0; // On veut atteindre 100
    
    // --- CHECK A: NAM vs PROFIL (Le plus puissant) ---
    // On ignore ce que l'IA a lu comme Nom/Prénom si le NAM est valide par rapport à la DB
    if (extraction.documentNumber) {
        // Nettoyage NAM IA (supprime espaces)
        const extractedNAM = normalizeString(extraction.documentNumber).toUpperCase();
        
        // On génère ce que le NAM *devrait* être selon la base de données (si on avait la date de naissance)
        // Comme on a pas la DOB en DB (souvent), on utilise la DOB extraite de la carte pour faire le pont
        if (extraction.dateOfBirth) {
            const theory = generateTheoreticalNAM(profile.first_name, profile.last_name, extraction.dateOfBirth);
            
            // Check Match (Début du NAM : 3 lettres nom + 1 prénom + Année + Mois + Jour)
            // On vérifie les 10 premiers caractères qui contiennent l'essentiel
            if (theory) {
                const checkLen = 10; 
                const matchMale = extractedNAM.startsWith(theory.maleBase.substring(0, checkLen));
                const matchFemale = extractedNAM.startsWith(theory.femaleBase.substring(0, checkLen));

                if (matchMale || matchFemale) {
                    trustScore += 60; // ENORME BOOST
                    log("SUCCESS: Le NAM correspond mathématiquement au profil DB (Validation croisée)");
                } else {
                    log(`FAIL: NAM Incohérent. Extrait: ${extractedNAM} vs Théorique: ${theory.maleBase.substring(0, 10)}...`);
                }
            }
        }
    }

    // --- CHECK B: NOM (Fuzzy Logic tolérante) ---
    const nameSim = calculateSimilarity(
        normalizeString(`${profile.first_name}${profile.last_name}`),
        normalizeString(`${extraction.firstName}${extraction.lastName}`)
    );
    
    if (nameSim > 0.85) {
        trustScore += 40;
        log(`SUCCESS: Nom correspond parfaitement (${(nameSim*100).toFixed(0)}%)`);
    } else if (nameSim > 0.60) {
        trustScore += 20; // Tolérance erreurs OCR (Hélix vs Félix)
        log(`WARNING: Nom correspond partiellement (${(nameSim*100).toFixed(0)}%). Probable erreur OCR relief.`);
    } else {
        log(`FAIL: Nom trop différent. DB: ${profile.first_name} ${profile.last_name} vs SCAN: ${extraction.firstName} ${extraction.lastName}`);
    }

    // --- CHECK C: VISUAL AGE (Anti-Spoofing & Cohérence) ---
    if (extraction.visualAgeEstimation && extraction.dateOfBirth) {
        const birthYear = new Date(extraction.dateOfBirth).getFullYear();
        const currentYear = new Date().getFullYear();
        const realAge = currentYear - birthYear;
        const diff = Math.abs(realAge - extraction.visualAgeEstimation);

        if (diff <= 8) { // Tolérance de 8 ans
            trustScore += 20;
            log(`SUCCESS: Âge visuel cohérent (Réel: ${realAge}, Est: ${extraction.visualAgeEstimation})`);
        } else {
            log(`WARNING: Âge visuel douteux (Réel: ${realAge}, Est: ${extraction.visualAgeEstimation})`);
        }
    }

    // --- CHECK D: EXPIRATION (Bloquant mais avec tolérance log) ---
    if (extraction.isExpired) {
        // Parfois l'IA se trompe sur "2029" vs "2024" avec le relief
        // On ne baisse pas le score drastiquement si le reste est béton
        if (trustScore > 60) {
            log("INFO: Document marqué expiré par l'IA mais haut score de confiance. On ignore l'expiration (possible erreur OCR date).");
        } else {
            trustScore -= 50;
            log("FAIL: Document expiré et confiance basse.");
        }
    }

    // --- CHECK E: SCREEN DETECTION ---
    if (extraction.isScreen || extraction.isDigitalEdit) {
        trustScore -= 100; // BLOQUANT
        log("CRITICAL: Photo d'écran ou montage détecté.");
    }

    // 5. VERDICT
    // Seuil à 50 : Si le NAM match (60pts), on passe direct même si le nom est mal lu.
    // Si le nom match bien (40pts) + age (20pts) = 60pts, on passe.
    const finalStatus = trustScore >= 50 ? 'approved' : 'rejected';
    
    // Déduction de la raison finale depuis les logs
    const finalReason = finalStatus === 'rejected' 
        ? detailedLogs.filter(l => l.includes('FAIL') || l.includes('CRITICAL')).join(' | ') || 'Score insuffisant'
        : null;
    
    // MESSAGE UTILISATEUR (Générique)
    const userMessage = finalStatus === 'approved' 
        ? null 
        : `Vérification échouée. Veuillez reprendre une photo claire et sans reflets. (Tentative ${(count || 0) + 1}/3)`;

    if (attemptId) {
        await supabase
            .from('identity_verifications')
            .update({
                completed_at: new Date().toISOString(),
                status: finalStatus,
                risk_score: 100 - trustScore, // Inverse du trust
                rejection_reason: finalReason, // Interne
                verification_metadata: {
                    logs: detailedLogs, // On sauvegarde TOUT
                    ai_raw: extraction,
                    trust_score: trustScore
                }
            })
            .eq('id', attemptId);
    }

    // Réponse Client (Censurée)
    return new Response(JSON.stringify({ 
      status: finalStatus === 'approved' ? 'APPROVE' : 'REJECT',
      reason: userMessage // Message générique pour l'UI
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    if (attemptId) {
        await supabase.from('identity_verifications').update({ 
            status: 'error', 
            verification_metadata: { logs: [...detailedLogs, `ERROR: ${error.message}`] } 
        }).eq('id', attemptId);
    }
    // Toujours renvoyer une réponse propre
    return new Response(JSON.stringify({ status: 'REJECT', reason: "Erreur technique. Veuillez réessayer." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})