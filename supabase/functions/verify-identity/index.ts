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
  const todayDate = new Date().toISOString().split('T')[0];

  try {
    const body = await req.json();
    const { 
      frontImage, 
      backImage, 
      fingerprint, 
      userId, 
      cardBin 
    } = body;

    console.log(`[ID-CHECK] Request received for User ID: "${userId}"`);

    if (!userId) throw new Error("UserID is missing");

    const { data: realProfile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .maybeSingle();

    if (profileError || !realProfile) {
        throw new Error(`Profile not found for ID ${userId}`);
    }

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

    // 1. ANALYSE DOCUMENT AVEC PROMPT RAMQ OPTIMISÉ
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imageParts = [
      { inlineData: { data: frontImage, mimeType: "image/jpeg" } }
    ];
    if (backImage) imageParts.push({ inlineData: { data: backImage, mimeType: "image/jpeg" } });

    // Prompt Spécialisé Québec/Canada
    const prompt = `
      You are an expert identity document verification system specialized in Canadian and Quebec documents (RAMQ, Driver's License).
      
      CONTEXT - TODAY'S DATE IS: ${todayDate}
      
      SPECIFIC INSTRUCTIONS FOR QUEBEC HEALTH INSURANCE CARD (RAMQ):
      1. IGNORE the administrative code at the top (e.g., "INGF 0511...").
      2. The NAME is located under the label "PRÉNOM ET NOM À LA NAISSANCE".
      3. The First Name is the first part, Last Name is the rest.
      4. IGNORE the letter "M" or "F" standing alone (this is Sex, not a name).
      5. EXPIRATION is at the bottom left, labeled "EXPIRATION". Format is usually YYYY MM (e.g., "2029 11").
      6. BIRTH DATE is vertical on the left, labeled "NAISSANCE". Format is YY MM JJ.
      
      TASK:
      Extract the data and verify validity.
      
      Return ONLY a JSON object (no markdown):
      {
        "firstName": "extracted first name (e.g. FELIX)",
        "lastName": "extracted last name (e.g. INGLIS-CHEVARIE)",
        "dateOfBirth": "YYYY-MM-DD",
        "expirationDate": "YYYY-MM-DD",
        "isExpired": boolean, // true if expirationDate is before today (${todayDate})
        "isFake": boolean,
        "tamperingDetected": boolean
      }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const extraction = JSON.parse(jsonStr);

    console.log("[ID-CHECK] Extraction Result:", extraction);

    // 2. COMPARAISON STRICTE
    let riskScore = 0;
    let rejectionReason = null;

    // A. Noms (Normalisés)
    const dbFirstName = normalizeString(realProfile.first_name);
    const dbLastName = normalizeString(realProfile.last_name);
    const idFirstName = normalizeString(extraction.firstName);
    const idLastName = normalizeString(extraction.lastName);

    // Vérification de correspondance plus souple (pour gérer les "M." ou prénoms multiples)
    const isFirstNameMatch = idFirstName.includes(dbFirstName) || dbFirstName.includes(idFirstName);
    const isLastNameMatch = idLastName.includes(dbLastName) || dbLastName.includes(idLastName);
    
    const isNameMatch = isFirstNameMatch && isLastNameMatch;

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

    // C. Expiration
    if (extraction.isExpired) { 
        riskScore += 100; 
        rejectionReason = `Document expiré (Exp: ${extraction.expirationDate})`; 
    }
    
    // D. Simulation Check
    const gpuLower = (fingerprint?.gpu || "").toLowerCase();
    const isSimulated = gpuLower.includes('simulated') || gpuLower.includes('vmware') || gpuLower.includes('software');
    if (isSimulated) {
        riskScore += 50; 
        console.warn("[ID-CHECK] VM/Simulator detected via GPU");
    }

    // 3. DECISION
    const decision = riskScore >= 50 ? 'REJECT' : 'APPROVE';
    
    if (attemptId) {
        await supabase
            .from('identity_verifications')
            .update({
                completed_at: new Date().toISOString(),
                status: decision === 'APPROVE' ? 'approved' : 'rejected',
                risk_score: riskScore,
                rejection_reason: rejectionReason,
                verification_metadata: {
                    age,
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
          idName: `${idFirstName} ${idLastName}`
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