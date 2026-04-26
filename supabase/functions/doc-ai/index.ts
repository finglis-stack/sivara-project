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
        temperature: 0,
        maxOutputTokens: 8192,
      },
    });

    let prompt = '';
    if (action === 'revise') {
      // Simple prompt — only ask for corrected text (no JSON, no corrections list)
      // This cuts output tokens by 80%+, making pro models fast enough
      prompt = `Tu es un correcteur de français. Corrige UNIQUEMENT: orthographe, accents, conjugaison, accords grammaticaux, ponctuation.
Ne change JAMAIS les mots, le sens, le style ou la structure des phrases. Conserve exactement la même structure.

Retourne UNIQUEMENT le texte corrigé, sans explication, sans formatage, sans JSON, sans guillemets. Juste le texte corrigé tel quel.

Texte à corriger:
${text}`;
    } else if (action === 'summarize') {
      prompt = `Résumé concis professionnel, texte brut sans formatage:\n\n${text}`;
    } else {
      throw new Error("Action non supportée");
    }

    const result = await model.generateContent(prompt);
    let outputText = result.response.text();

    // Clean markdown fences
    if (outputText.startsWith('```')) {
      const firstNl = outputText.indexOf('\n');
      if (firstNl > -1) outputText = outputText.substring(firstNl + 1);
      if (outputText.endsWith('```')) outputText = outputText.slice(0, -3);
    }
    outputText = outputText.trim();

    if (action === 'revise') {
      // Compute corrections by diffing original vs corrected text word-by-word
      const originalWords = text.split(/(\s+)/);
      const correctedWords = outputText.split(/(\s+)/);
      const corrections: {original: string; corrected: string; explanation: string; type: string}[] = [];

      const len = Math.min(originalWords.length, correctedWords.length);
      for (let i = 0; i < len; i++) {
        const ow = originalWords[i];
        const cw = correctedWords[i];
        if (!ow.trim() || !cw.trim()) continue;
        if (ow !== cw) {
          let type = 'orthographe';
          // Detect accent-only changes
          const normalize = (s: string) => s.toLowerCase()
            .replace(/[àâäáã]/g, 'a').replace(/[éèêë]/g, 'e')
            .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
            .replace(/[ùûü]/g, 'u').replace(/[ç]/g, 'c');
          if (normalize(ow) === normalize(cw)) type = 'accent';
          else if (ow.replace(/[.,;:!?]/g, '') === cw.replace(/[.,;:!?]/g, '')) type = 'ponctuation';

          corrections.push({ original: ow, corrected: cw, explanation: '', type });
        }
      }

      return new Response(JSON.stringify({
        result: outputText,
        corrections,
        original_text: text
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
