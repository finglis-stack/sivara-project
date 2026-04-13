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
      prompt = `Tu es un correcteur orthographique et grammatical. Ta SEULE tâche est de corriger les fautes d'orthographe, de grammaire, de conjugaison, d'accents et de ponctuation dans le texte suivant.

RÈGLES ABSOLUES :
- NE CHANGE JAMAIS les mots. Garde exactement les mêmes mots que l'utilisateur a écrits.
- NE REFORMULE JAMAIS. Ne réécris pas les phrases différemment.
- NE RAJOUTE PAS de mots, d'expressions ou de phrases.
- NE SUPPRIME PAS de mots ou de phrases.
- NE CHANGE PAS le style, le ton ou la structure des phrases.
- Corrige UNIQUEMENT : les fautes d'orthographe, les accents manquants/incorrects, la conjugaison, les accords (genre/nombre), et la ponctuation.
- NE RAJOUTE PAS DE FORMATTAGE MARKDOWN (pas de \`\`\`html ou autre).
- Renvoie UNIQUEMENT le texte corrigé, rien d'autre.

Texte à corriger :
${text}`;
    } else if (action === 'generate') {
      prompt = `Tu es un assistant de rédaction IA intégré dans un traitement de texte. Ta tâche est de générer du texte basé sur les instructions suivantes de l'utilisateur.
      Instructions: ${instructions || 'Génère un texte pertinent'}
      (S'il y a un texte de contexte fourni, base-toi dessus : ${context || 'Aucun'})
      
      Rédige le texte de la manière la plus fluide possible. Utilise des paragraphes si nécessaire, avec des balises HTML basiques comme <p>, <strong>, <em> etc. pour le formatage, car ton rendu sera injecté dans un éditeur riche (TipTap).
      N'encapsule pas ta réponse dans un code block markdown, donne directement le HTML.`;
    } else if (action === 'summarize') {
      prompt = `Tu es un assistant d'analyse. Fais un résumé concis professionnel du document suivant. 
      Utilise des balises HTML simples (<p>, <ul>, <li>, <strong>) pour formater ta réponse, car ce sera inséré dans un éditeur de texte riche. Ne mets pas de bloc markdown.
      
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
    } else if (outputText.startsWith('```')) {
      outputText = outputText.replace(/^```\n/g, '').replace(/```$/g, '');
    }

    return new Response(JSON.stringify({ result: outputText.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
