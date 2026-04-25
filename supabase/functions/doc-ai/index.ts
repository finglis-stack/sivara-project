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

    const { action, text, context, instructions } = await req.json();

    const modelName = Deno.env.get('GEMINI_MODEL') || 'gemini-3-flash-preview';
    const model = genAI.getGenerativeModel({ model: modelName });

    let prompt = '';
    if (action === 'revise') {
      prompt = [
        'Tu es un correcteur orthographique et grammatical expert. Analyse le texte suivant et identifie TOUTES les erreurs.',
        '',
        'REGLES ABSOLUES :',
        '- NE CHANGE JAMAIS les mots ou le sens.',
        '- NE REFORMULE JAMAIS.',
        '- NE RAJOUTE PAS de mots.',
        '- NE SUPPRIME PAS de mots.',
        '- Corrige UNIQUEMENT : orthographe, accents, conjugaison, accords, ponctuation.',
        '',
        'Reponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas de backticks).',
        'Format du JSON :',
        '{',
        '  "corrections": [',
        '    {"original": "mot fautif", "corrected": "correction", "explanation": "explication courte", "type": "orthographe"}',
        '  ],',
        '  "corrected_text": "texte complet corrige"',
        '}',
        '',
        'Types possibles: orthographe, grammaire, conjugaison, accent, ponctuation',
        'Si aucune faute: {"corrections": [], "corrected_text": "texte original"}',
        '',
        'Texte a analyser :',
        text
      ].join('\n');
    } else if (action === 'summarize') {
      prompt = `Tu es un assistant d'analyse. Fais un résumé concis professionnel du document suivant. 
      N'utilise AUCUN formatage (pas de gras, pas de puces, pas de balises HTML). Renvoie uniquement du texte brut, en un seul paragraphe ou paragraphes séparés par des sauts de ligne réguliers.
      
      Document:
      ${text}`;
    } else {
      throw new Error("Action non supportée");
    }

    const result = await model.generateContent(prompt);
    let outputText = result.response.text();

    // Nettoyage markdown éventuel
    if (outputText.startsWith('```html')) {
      outputText = outputText.replace(/^```html\n/g, '').replace(/```$/g, '');
    } else if (outputText.startsWith('```json')) {
      outputText = outputText.replace(/^```json\n?/g, '').replace(/\n?```$/g, '');
    } else if (outputText.startsWith('```')) {
      outputText = outputText.replace(/^```\n/g, '').replace(/```$/g, '');
    }
    outputText = outputText.trim();

    if (action === 'revise') {
      // Parse JSON response for revise action
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
        // Fallback: if JSON parsing fails, return old format
        console.error('JSON parse error, falling back:', parseError);
        return new Response(JSON.stringify({
          result: outputText,
          corrections: [],
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
