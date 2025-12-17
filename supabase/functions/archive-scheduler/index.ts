// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Connexion Admin (Service Role) pour pouvoir lire/écrire partout
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Trouver les documents "Hot" inactifs depuis > 5 minutes
    // Critères : content n'est pas vide, storage_path est vide, updated_at vieux
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: docsToArchive, error: fetchError } = await supabase
      .from('documents')
      .select('id, content, owner_id')
      .is('storage_path', null)
      .neq('content', '') // Seulement ceux qui ont du contenu
      .lt('updated_at', fiveMinutesAgo)
      .limit(50); // Batch de 50 pour pas timeout

    if (fetchError) throw fetchError;

    console.log(`[Archiver] ${docsToArchive?.length || 0} documents à archiver.`);

    const results = [];

    for (const doc of docsToArchive || []) {
        if (!doc.content) continue;

        // Chemin : owner_id/doc_id.sivara
        const filePath = `${doc.owner_id}/${doc.id}.sivara`;

        // 2. Upload vers le Cold Storage
        const { error: uploadError } = await supabase.storage
            .from('doc-archives')
            .upload(filePath, doc.content, {
                contentType: 'text/plain',
                upsert: true
            });

        if (uploadError) {
            console.error(`Erreur upload doc ${doc.id}:`, uploadError);
            continue;
        }

        // 3. Nettoyer la DB (Passage en Cold)
        // On garde le titre et les métadonnées, on vide juste le gros blob 'content'
        const { error: updateError } = await supabase
            .from('documents')
            .update({ 
                content: '', // On vide pour sauver de la place
                storage_path: filePath 
            })
            .eq('id', doc.id);

        if (!updateError) {
            results.push(doc.id);
        }
    }

    return new Response(JSON.stringify({ archived: results.length, ids: results }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})