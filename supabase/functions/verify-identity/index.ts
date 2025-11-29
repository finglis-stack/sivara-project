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

const normalizeString = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, ""); 
};

const calculateAge = (dobString: string) => {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
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

  try {
    const body = await req.json();
    const { 
      frontImage, 
      backImage, 
      fingerprint, 
      userId, 
      cardBin 
    } = body;

    console.log(`[ID-CHECK] Request received for User ID: "${userId}" (Type: ${typeof userId})`);

    if (!userId) {
        throw new Error("UserID is missing from request body");
    }

    // --- ETAPE CRUCIALE: RECUPERATION DU VRAI PROFIL DB ---
    // Correction: On ne demande QUE les colonnes qui existent dans public.profiles
    const { data: realProfile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name') // Suppression de 'email' qui causait l'erreur 42703
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
        console.error("[ID-CHECK] DB Error fetching profile:", profileError);
        throw new Error(`Erreur base de données: ${profileError.message}`);
    }

    if (!realProfile) {
        console.error(`[ID-CHECK] No profile found for ID: ${userId}`);
        throw new Error(`Impossible de trouver le profil utilisateur pour l'ID ${userId}`);
    }

    console.log(`[ID-CHECK] Profile Loaded: ${realProfile.first_name} ${realProfile.last_name}`);

    // LOG DEBUT
    const { data: logEntry } = await supabase
        .from('identity_verifications')
        .insert({
            user_id: userId,
            started_at: startTime,
            status: 'processing',
            fingerprint_data: fingerprint
        })
        .select('id')
        .single();
    if (logEntry) attemptId = logEntry.id;

    // 1. ANALYSE DOCUMENT
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imageParts = [
      { inlineData: { data: frontImage, mimeType: "image/jpeg" } },
      { inlineData: { data: backImage, mimeType: "image/jpeg" } }
    ];

    const prompt = `
      Analyze these ID documents strictly. Extract raw data.
      Return ONLY a JSON object with this exact structure:
      {
        "firstName": "extracted first name",
        "lastName": "extracted last name",
        "dateOfBirth": "YYYY-MM-DD",
        "address": "full address",
        "isExpired": boolean,
        "isFake": boolean,
        "tamperingDetected": boolean
      }
      If date is ambiguous, use ISO format YYYY-MM-DD.
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const extraction = JSON.parse(jsonStr);

    console.log("[ID-CHECK] Gemini Extraction:", extraction);

    // 2. COMPARAISON STRICTE
    let riskScore = 0;
    let rejectionReason = null;

    // A. Noms (Normalisés)
    const dbFirstName = normalizeString(realProfile.first_name);
    const dbLastName = normalizeString(realProfile.last_name);
    const idFirstName = normalizeString(extraction.firstName);
    const idLastName = normalizeString(extraction.lastName);

    // Debug Logs pour vous
    console.log(`[ID-CHECK] COMPARE: DB[${dbFirstName}|${dbLastName}] vs ID[${idFirstName}|${idLastName}]`);

    const isNameMatch = 
      (idFirstName.includes(dbFirstName) || dbFirstName.includes(idFirstName)) &&
      (idLastName.includes(dbLastName) || dbLastName.includes(idLastName));

    if (!isNameMatch) {
      riskScore += 100;
      rejectionReason = `Nom ne correspond pas. DB: ${realProfile.first_name} ${realProfile.last_name} vs ID: ${extraction.firstName} ${extraction.lastName}`;
    }

    // B. Âge
    const age = calculateAge(extraction.dateOfBirth);
    if (age < 18) {
      riskScore += 100;
      rejectionReason = `Utilisateur mineur (${age} ans)`;
    }

    if (extraction.isExpired) { riskScore += 100; rejectionReason = "Document expiré"; }
    
    // C. Device Check
    console.log("[ID-CHECK] Fingerprint Analysis:", fingerprint);
    
    // Détection de simulation basique
    const gpuLower = (fingerprint.gpu || "").toLowerCase();
    const isSimulated = gpuLower.includes('simulated') || gpuLower.includes('vmware') || gpuLower.includes('software');
    
    if (isSimulated) {
        riskScore += 50; 
        console.warn("[ID-CHECK] VM/Simulator detected via GPU");
    }

    // 3. DECISION
    const decision = riskScore >= 50 ? 'REJECT' : 'APPROVE';
    
    // Update Log
    if (attemptId) {
        await supabase
            .from('identity_verifications')
            .update({
                completed_at: new Date().toISOString(),
                status: decision === 'APPROVE' ? 'approved' : 'rejected',
                risk_score: riskScore,
                rejection_reason: rejectionReason,
                verification_metadata: {
                    age: age,
                    name_match: isNameMatch,
                    ai_extraction: extraction,
                    db_profile_snapshot: { first: dbFirstName, last: dbLastName }
                }
            })
            .eq('id', attemptId);
    }

    return new Response(JSON.stringify({ 
      status: decision,
      riskScore,
      reason: rejectionReason,
      debug: { 
          dbName: `${dbFirstName} ${dbLastName}`,
          idName: `${idFirstName} ${idLastName}`,
          match: isNameMatch
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[ID-CHECK] Fatal Error:", error);
    if (attemptId) {
        await supabase.from('identity_verifications').update({ status: 'error', rejection_reason: error.message }).eq('id', attemptId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})