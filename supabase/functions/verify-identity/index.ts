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

// Configuration Gemini
// @ts-ignore
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Utilitaires de normalisation
const normalizeString = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enlève les accents
    .replace(/[^a-z0-9]/g, ""); // Garde uniquement alphanumérique
};

const calculateAge = (dobString: string) => {
  if (!dobString) return 0;
  // Format attendu YYYY-MM-DD
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

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      frontImage, 
      backImage, 
      fingerprint, 
      userId, 
      userProfile, 
      cardBin 
    } = await req.json();

    console.log(`[ID-CHECK] Starting verification for User ${userId}`);

    // 1. ANALYSE DOCUMENT (GEMINI 2.5 FLASH)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const imageParts = [
      { inlineData: { data: frontImage, mimeType: "image/jpeg" } },
      { inlineData: { data: backImage, mimeType: "image/jpeg" } }
    ];

    // Prompt strict pour extraction de données brutes UNIQUEMENT
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

    // 2. LOGIQUE DE COMPARAISON (Code déterministe)
    let riskScore = 0;
    let rejectionReason = null;

    // A. Comparaison Noms (Normalisée)
    const dbFirstName = normalizeString(userProfile.first_name);
    const dbLastName = normalizeString(userProfile.last_name);
    const idFirstName = normalizeString(extraction.firstName);
    const idLastName = normalizeString(extraction.lastName);

    // On vérifie si le nom extrait CONTIENT le nom DB (pour gérer les seconds prénoms) ou vice versa
    const isNameMatch = 
      (idFirstName.includes(dbFirstName) || dbFirstName.includes(idFirstName)) &&
      (idLastName.includes(dbLastName) || dbLastName.includes(idLastName));

    if (!isNameMatch) {
      console.log(`[ID-CHECK] Name Mismatch: DB[${dbFirstName} ${dbLastName}] vs ID[${idFirstName} ${idLastName}]`);
      riskScore += 100;
      rejectionReason = "Nom ne correspond pas au profil (Vérifiez l'orthographe)";
    }

    // B. Calcul Âge (Date Système)
    const age = calculateAge(extraction.dateOfBirth);
    console.log(`[ID-CHECK] Calculated Age: ${age} (DOB: ${extraction.dateOfBirth})`);
    
    if (age < 18) {
      riskScore += 100;
      rejectionReason = `Utilisateur mineur (${age} ans)`;
    }

    // C. Check Validité Document
    if (extraction.isExpired) { riskScore += 100; rejectionReason = "Document expiré"; }
    if (extraction.isFake || extraction.tamperingDetected) { riskScore += 100; rejectionReason = "Document suspect ou altéré"; }

    // D. Check Device (Fingerprint)
    const isHighEndDevice = fingerprint.gpu?.toLowerCase().includes('nvidia') || 
                           fingerprint.gpu?.toLowerCase().includes('apple') ||
                           fingerprint.memory >= 8;
    
    if (!isHighEndDevice) riskScore += 10;
    if (fingerprint.os === 'Linux' && !fingerprint.mobile) riskScore += 20;
    
    // E. Check Location (Risk Zones Montreal)
    const riskyZones = ['montreal-nord', 'montréal-nord', 'saint-michel']; 
    const addressLower = (extraction.address || "").toLowerCase();
    
    let zoneRisk = 'low';
    if (riskyZones.some(z => addressLower.includes(z))) {
        riskScore += 45;
        zoneRisk = 'high';
    }

    // F. Check Paiement
    if (cardBin && ['4567', '5123'].includes(cardBin)) {
        riskScore += 30;
    }

    // 3. DÉCISION
    const decision = riskScore >= 50 ? 'REJECT' : 'APPROVE';
    
    let estimatedLTV = 'Low';
    if (riskScore < 20 && age > 25 && isHighEndDevice) estimatedLTV = 'High (> 12 mois)';
    else if (riskScore < 40) estimatedLTV = 'Medium (6-12 mois)';
    else estimatedLTV = 'Churn Risk (< 3 mois)';

    await supabase.from('crawl_logs').insert({
        message: `ID Check User ${userId}: ${decision} (Score: ${riskScore}) - Age: ${age} - LTV: ${estimatedLTV}`,
        step: 'RISK_ENGINE',
        status: decision === 'APPROVE' ? 'success' : 'error'
    });

    return new Response(JSON.stringify({ 
      status: decision,
      riskScore,
      riskLevel: zoneRisk,
      ltvPrediction: estimatedLTV,
      reason: rejectionReason,
      // Debug info (optional)
      debug: { age, nameMatch: isNameMatch }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[ID-CHECK] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})