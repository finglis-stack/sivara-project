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

    // 1. ANALYSE DOCUMENT (GEMINI 2.5 FLASH - 2025 MODEL)
    // Utilisation du modèle Flash 2.5 pour une latence minimale et capacités de raisonnement
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Conversion Base64 -> Parts pour Gemini
    const imageParts = [
      { inlineData: { data: frontImage, mimeType: "image/jpeg" } },
      { inlineData: { data: backImage, mimeType: "image/jpeg" } }
    ];

    const prompt = `
      Analyze these ID documents (Front and Back) strictly. Return ONLY a JSON object.
      1. Extract: firstName, lastName, dateOfBirth (YYYY-MM-DD), address, expiryDate.
      2. Verify: Does the name match "${userProfile.first_name} ${userProfile.last_name}"? (fuzzy match allowed).
      3. Security: Check for holograms, font consistency, edge tampering.
      4. Age: Calculate current age.
      
      Format:
      {
        "extracted": { "firstName": "", "lastName": "", "age": 0, "address": "" },
        "verification": { "nameMatch": boolean, "isExpired": boolean, "isFake": boolean },
        "confidence": 0-100
      }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
    // Nettoyage du JSON (Gemini met parfois des backticks)
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(jsonStr);

    console.log("[ID-CHECK] Gemini Analysis:", analysis);

    // 2. ANALYSE DE RISQUE (SCORING)
    let riskScore = 0; // 0 = Safe, 100 = Fraud
    let rejectionReason = null;

    // A. Check Identité
    if (!analysis.verification.nameMatch) { riskScore += 100; rejectionReason = "Nom ne correspond pas au profil"; }
    if (analysis.verification.isFake) { riskScore += 100; rejectionReason = "Document détecté comme faux"; }
    if (analysis.extracted.age < 18) { riskScore += 100; rejectionReason = "Utilisateur mineur"; }

    // B. Check Device (Fingerprint)
    // GPU detection simplifiée
    const isHighEndDevice = fingerprint.gpu?.toLowerCase().includes('nvidia') || 
                           fingerprint.gpu?.toLowerCase().includes('apple') ||
                           fingerprint.memory >= 8;
    
    if (!isHighEndDevice) riskScore += 10; // Appareil bas de gamme = risque légèrement accru pour un sub premium
    if (fingerprint.os === 'Linux' && !fingerprint.mobile) riskScore += 20; // Linux desktop souvent utilisé pour spoofing (sauf devs)
    
    // C. Check Location (Simulation IP via Headers ou Payload)
    // Simulation : Si l'adresse extraite contient certains mots clés de zones à risque
    const riskyZones = ['montreal-nord', 'montréal-nord', 'saint-michel']; 
    const addressLower = analysis.extracted.address.toLowerCase();
    
    let zoneRisk = 'low';
    if (riskyZones.some(z => addressLower.includes(z))) {
        riskScore += 45; // Forte augmentation du risque
        zoneRisk = 'high';
    }

    // D. Graph de Paiement (BIN check simulé)
    // 4 derniers chiffres ou BIN
    if (cardBin) {
       // Simulation: Prepaid cards often start with certain bins
       const isPrepaid = ['4567', '5123'].includes(cardBin);
       if (isPrepaid) {
           riskScore += 30;
           console.log("[ID-CHECK] Carte prépayée détectée");
       }
    }

    // 3. DÉCISION FINALE
    const decision = riskScore >= 50 ? 'REJECT' : 'APPROVE';
    
    // Estimation Durée Abonnement (LTV Prediction)
    // Basé sur: Age > 25, HighEnd Device, Low Risk Zone => Long Term
    let estimatedLTV = 'Low';
    if (riskScore < 20 && analysis.extracted.age > 25 && isHighEndDevice) estimatedLTV = 'High (> 12 mois)';
    else if (riskScore < 40) estimatedLTV = 'Medium (6-12 mois)';
    else estimatedLTV = 'Churn Risk (< 3 mois)';

    // Log transaction
    await supabase.from('crawl_logs').insert({
        message: `ID Check User ${userId}: ${decision} (Score: ${riskScore}) - LTV: ${estimatedLTV}`,
        step: 'RISK_ENGINE',
        status: decision === 'APPROVE' ? 'success' : 'error'
    });

    return new Response(JSON.stringify({ 
      status: decision,
      riskScore,
      riskLevel: zoneRisk,
      details: analysis,
      ltvPrediction: estimatedLTV,
      reason: rejectionReason
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[ID-CHECK] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})