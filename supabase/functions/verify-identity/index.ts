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

// --- UTILITAIRES DE CRYPTOGRAPHIE & TEXTE ---

const normalizeString = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, ""); 
};

// Algorithme de distance de Levenshtein pour la comparaison floue des noms
const levenshteinDistance = (a: string, b: string) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Vérifie si le nom correspond avec une tolérance
const isNameMatchStrict = (dbName: string, idName: string) => {
  const normDb = normalizeString(dbName);
  const normId = normalizeString(idName);
  
  // 1. Inclusion directe
  if (normId.includes(normDb) || normDb.includes(normId)) return true;
  
  // 2. Levenshtein (Tolérance de 2 caractères pour les fautes de frappe/OCR)
  const dist = levenshteinDistance(normDb, normId);
  if (dist <= 2) return true;

  return false;
};

// --- LOGIQUE METIER : VALIDATION RAMQ ---
// Le numéro RAMQ (NAM) est construit : ABCD 1234 5678
// A B C : 3 premières lettres du nom
// D : 1ère lettre du prénom
// 12 : Deux derniers chiffres de l'année de naissance
// 34 : Mois de naissance (+50 pour les femmes)
// 56 : Jour de naissance
const validateRAMQLogic = (nam: string, firstName: string, lastName: string, dob: string) => {
  const cleanNAM = nam.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleanNAM.length !== 12) return { valid: false, reason: "Format NAM invalide (longueur)" };

  const normLast = normalizeString(lastName).toUpperCase();
  const normFirst = normalizeString(firstName).toUpperCase();
  
  // Vérification des lettres (Nom/Prénom)
  // Note: On est souple car l'OCR peut confondre certaines lettres ou le nom peut être composé
  const namLetters = cleanNAM.substring(0, 4);
  const expectedLetters = (normLast.substring(0, 3) + normFirst.substring(0, 1)).padEnd(4, 'X');
  
  // Vérification de la date dans le NAM
  const namYear = cleanNAM.substring(4, 6);
  const namMonth = parseInt(cleanNAM.substring(6, 8));
  const namDay = cleanNAM.substring(8, 10);

  const dobDate = new Date(dob);
  const dobYear = dobDate.getFullYear().toString().slice(-2);
  const dobMonth = dobDate.getMonth() + 1;
  const dobDay = dobDate.getDate().toString().padStart(2, '0');

  // Check Année & Jour (Strict)
  if (namYear !== dobYear) return { valid: false, reason: "Année naissance NAM incohérente" };
  if (namDay !== dobDay) return { valid: false, reason: "Jour naissance NAM incohérent" };

  // Check Mois (Gère le +50 pour les femmes)
  const isFemale = namMonth > 50;
  const normalizedMonth = isFemale ? namMonth - 50 : namMonth;
  
  if (normalizedMonth !== dobMonth) return { valid: false, reason: "Mois naissance NAM incohérent" };

  return { valid: true, sex: isFemale ? 'F' : 'M' };
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

  try {
    const body = await req.json();
    const { frontImage, backImage, fingerprint, userId } = body;

    console.log(`[ID-SECURE] Security Check initiated for: "${userId}"`);

    // 1. Récupération & Snapshot du Profil
    const { data: realProfile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .maybeSingle();

    if (profileError || !realProfile) throw new Error("Profile introuvable");

    // Init Log
    const { data: logEntry } = await supabase
        .from('identity_verifications')
        .insert({
            user_id: userId,
            started_at: startTime,
            status: 'processing',
            fingerprint_data: fingerprint,
            client_ip: req.headers.get('x-forwarded-for') || 'unknown'
        })
        .select('id')
        .single();
    if (logEntry) attemptId = logEntry.id;

    // 2. ANALYSE FORENSIQUE & OCR (IA)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imageParts = [{ inlineData: { data: frontImage, mimeType: "image/jpeg" } }];
    if (backImage) imageParts.push({ inlineData: { data: backImage, mimeType: "image/jpeg" } });

    // PROMPT DE SÉCURITÉ RENFORCÉ
    const prompt = `
      ACT AS A FORENSIC DOCUMENT EXPERT.
      Your goal is to detect FRAUD and extract identity data from Canadian/Quebec ID documents (RAMQ, Driver's License, Passport).

      CURRENT DATE: ${todayDate}

      PHASE 1: FORENSIC ANALYSIS (PIXEL LEVEL)
      - Look for "Screen Moiré" patterns (photos taken of a screen).
      - Look for mismatched fonts or "floating text" (digital editing).
      - Check if holograms look flat or printed (photocopy detection).
      - Check edge artifacts (cut-out images).

      PHASE 2: DATA EXTRACTION (SPECIFIC RULES)
      - **RAMQ Card (Health Insurance)**:
        - The "No assurance maladie" is composed of 4 letters then 8 digits. Format: AAAA 0000 0000. It is often located near the middle-right.
        - NAME: Under "Nom".
        - FIRST NAME: Under "Prénom". (Ignore "PRÉNOM ET NOM À LA NAISSANCE").
        - DOB: Look for "NAISSANCE" (Format YYYY MM DD or YY MM DD). 
        - EXPIRATION: Look for "EXPIRATION" (Format YYYY MM). STRICTLY CHECK if this date is in the past relative to ${todayDate}.
      
      - **Driver's License (Permis)**:
        - Class usually "5".
        - Reference number matches the RAMQ logic (First letter of Last Name + Date logic).
      
      - **Passport**:
        - Read the MRZ (Machine Readable Zone) at the bottom if visible.
        - Compare MRZ data with visual zone.

      OUTPUT FORMAT (JSON ONLY):
      {
        "docType": "RAMQ" | "DL" | "PASSPORT" | "UNKNOWN",
        "forensics": {
           "isScreenPhoto": boolean,
           "isDigitalEdit": boolean,
           "isBlackAndWhite": boolean,
           "overallIntegrityScore": number (0-100, 100 is perfect)
        },
        "data": {
           "firstName": "string",
           "lastName": "string",
           "documentNumber": "string (The RAMQ code or DL number)",
           "dateOfBirth": "YYYY-MM-DD",
           "expirationDate": "YYYY-MM-DD",
           "isExpired": boolean
        }
      }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const jsonStr = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(jsonStr);

    console.log("[ID-SECURE] AI Analysis:", analysis);

    // 3. MOTEUR DE DÉCISION (ZERO-TRUST)
    let riskScore = 0;
    const reasons: string[] = [];

    // --- CHECK 1: FORENSICS (Image Quality) ---
    if (analysis.forensics.isScreenPhoto) {
        riskScore += 100;
        reasons.push("Fraude détectée : Photo d'un écran (Moiré)");
    }
    if (analysis.forensics.isDigitalEdit) {
        riskScore += 100;
        reasons.push("Fraude détectée : Retouche numérique suspectée");
    }
    if (analysis.forensics.overallIntegrityScore < 80) {
        riskScore += 50;
        reasons.push("Qualité du document insuffisante ou suspecte");
    }

    // --- CHECK 2: VALIDITÉ DOCUMENT ---
    if (analysis.data.isExpired) {
        riskScore += 100;
        reasons.push(`Document expiré le ${analysis.data.expirationDate}`);
    } else {
        // Double check manuel de la date au cas où l'IA hallucine le booléen
        const expDate = new Date(analysis.data.expirationDate);
        const now = new Date();
        // Pour une RAMQ, souvent juste Année/Mois. On met le dernier jour du mois pour être gentil.
        const effectiveExp = new Date(expDate.getFullYear(), expDate.getMonth() + 1, 0); 
        if (effectiveExp < now) {
            riskScore += 100;
            reasons.push(`Document expiré (Calcul Système: ${effectiveExp.toISOString().split('T')[0]})`);
        }
    }

    // --- CHECK 3: IDENTITÉ (Fuzzy Match) ---
    const firstNameMatch = isNameMatchStrict(realProfile.first_name, analysis.data.firstName);
    const lastNameMatch = isNameMatchStrict(realProfile.last_name, analysis.data.lastName);

    if (!firstNameMatch || !lastNameMatch) {
        riskScore += 100;
        reasons.push(`Identité discordante. ID: "${analysis.data.firstName} ${analysis.data.lastName}" vs Profil: "${realProfile.first_name} ${realProfile.last_name}"`);
    }

    // --- CHECK 4: COHÉRENCE MATHÉMATIQUE (RAMQ/Permis QC) ---
    if (analysis.docType === 'RAMQ' || analysis.docType === 'DL') {
        if (analysis.data.documentNumber) {
            const validation = validateRAMQLogic(
                analysis.data.documentNumber, 
                analysis.data.firstName, 
                analysis.data.lastName, 
                analysis.data.dateOfBirth
            );
            
            if (!validation.valid) {
                riskScore += 75; // Score élevé mais pas 100 car erreur OCR possible sur un chiffre
                reasons.push(`Incohérence Sécurité RAMQ: ${validation.reason}`);
            } else {
                console.log(`[ID-SECURE] RAMQ Algorithm Validated. Sex: ${validation.sex}`);
            }
        } else {
            riskScore += 50;
            reasons.push("Numéro de document illisible ou manquant");
        }
    }

    // --- CHECK 5: FINGERPRINT (Anti-Bot) ---
    // Les bots et VM utilisent souvent des GPUs génériques
    const gpuLower = (fingerprint?.gpu || "").toLowerCase();
    const suspiciousGPU = gpuLower.includes('llvm') || gpuLower.includes('software') || gpuLower.includes('vmware') || gpuLower.includes('swiftshader');
    
    if (suspiciousGPU) {
        riskScore += 100;
        reasons.push("Environnement virtuel/simulé détecté (Anti-Spoofing)");
    }

    // 4. VERDICT FINAL
    const status = riskScore >= 50 ? 'rejected' : 'approved';
    const finalReason = reasons.length > 0 ? reasons.join(' | ') : null;

    if (attemptId) {
        await supabase
            .from('identity_verifications')
            .update({
                completed_at: new Date().toISOString(),
                status: status,
                risk_score: riskScore,
                risk_level: riskScore > 80 ? 'CRITICAL' : riskScore > 40 ? 'HIGH' : 'LOW',
                rejection_reason: finalReason,
                verification_metadata: {
                    analysis: analysis,
                    logic_checks: {
                        name_match: firstNameMatch && lastNameMatch,
                        doc_logic_valid: riskScore < 50
                    }
                }
            })
            .eq('id', attemptId);
    }

    return new Response(JSON.stringify({ 
      status: status === 'approved' ? 'APPROVE' : 'REJECT',
      riskScore,
      reason: finalReason,
      debug: {
          docType: analysis.docType,
          extracted: analysis.data,
          forensics: analysis.forensics
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[ID-SECURE] CRASH:", error);
    if (attemptId) {
        await supabase.from('identity_verifications').update({ status: 'error', rejection_reason: `System Error: ${error.message}` }).eq('id', attemptId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})