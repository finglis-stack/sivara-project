import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.13.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Non autorisé');

    const { data: profile } = await supabaseClient.from('profiles').select('is_pro').eq('id', user.id).single();
    if (!profile?.is_pro) throw new Error('Nécessite un abonnement SIVARA PRO');

    const { action, text } = await req.json();

    // Model from Supabase env — DO NOT hardcode
    const modelName = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,        // Deterministic = faster inference
        maxOutputTokens: 81920, // Large enough for long texts with many corrections
      },
    });

    let prompt = '';
    if (action === 'revise') {
      prompt = `Tu es un correcteur de français. Corrige UNIQUEMENT: orthographe, accents, conjugaison, accords grammaticaux, ponctuation.
Ne change JAMAIS les mots, le sens, le style ou la structure des phrases.

RÈGLES DE RÉPONSE:
1. Réponds UNIQUEMENT en JSON brut (pas de backticks, pas de markdown)
2. Le champ "corrected_text" doit TOUJOURS contenir le texte ENTIER corrigé, même s'il est long
3. Le tableau "corrections" doit lister au maximum 30 corrections (les plus importantes)
4. Chaque correction doit avoir: "original" (le mot/groupe fautif exact tel qu'il apparaît), "corrected", "explanation" (très courte), "type"

Format:
{"corrections":[{"original":"mot fautif","corrected":"mot corrigé","explanation":"raison","type":"orthographe|grammaire|conjugaison|accent|ponctuation"}],"corrected_text":"texte complet corrigé"}

Si aucune faute: {"corrections":[],"corrected_text":"texte original"}

Texte à corriger:
${text}`;
    } else if (action === 'summarize') {
      prompt = `Résumé concis professionnel, texte brut sans formatage:\n\n${text}`;
    } else {
      throw new Error("Action non supportée");
    }

    const result = await model.generateContent(prompt);
    let outputText = result.response.text();

    // Clean markdown fences (```json ... ```)
    if (outputText.startsWith('```')) {
      const firstNl = outputText.indexOf('\n');
      if (firstNl > -1) outputText = outputText.substring(firstNl + 1);
      if (outputText.endsWith('```')) outputText = outputText.slice(0, -3);
    }
    outputText = outputText.trim();

    if (action === 'revise') {
      try {
        const parsed = JSON.parse(outputText);
        return new Response(JSON.stringify({
          result: parsed.corrected_text || text,
          corrections: parsed.corrections || [],
          original_text: text
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (parseError) {
        console.error('JSON parse error, raw output:', outputText.substring(0, 500));
        console.error('Parse error details:', parseError);

        // Try to salvage: extract corrected_text if JSON was truncated
        const correctedMatch = outputText.match(/"corrected_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const salvaged = correctedMatch ? correctedMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : null;

        return new Response(JSON.stringify({
          result: salvaged || text,
          corrections: salvaged ? [{ original: '(texte complet)', corrected: '(corrigé)', explanation: 'Corrections multiples appliquées', type: 'orthographe' }] : [],
          original_text: text
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ result: outputText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
