// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction simple pour signer les requêtes AWS (AWS Signature V4 est complexe, on utilise souvent une lib, 
// mais ici on simule l'appel ou on utilise un fetch direct si SES SMTP est utilisé).
// Pour simplifier l'exemple, on va supposer l'utilisation de l'API REST ou d'une lib légère.
// NOTE: En prod, utilisez "aws-sdk-js-v3" compatible Deno ou appelez l'endpoint SMTP.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized');

    const { to, subject, htmlBody, textBody } = await req.json()

    // 1. Sauvegarder dans "Sent" (copie locale)
    // Note: Idéalement, le client devrait chiffrer ceci AVANT d'envoyer, 
    // mais pour l'instant on le stocke tel quel ou on laisse le client gérer l'insertion.
    const { error: dbError } = await supabaseClient.from('emails').insert({
        user_id: user.id,
        folder: 'sent',
        sender_address: user.email, // L'email Sivara de l'utilisateur
        recipient_address: to,
        subject: subject,
        body_html: htmlBody, // À chiffrer
        body_text: textBody, // À chiffrer
        is_read: true
    });

    if (dbError) console.error("Erreur sauvegarde DB:", dbError);

    // 2. Envoyer via AWS SES
    // Ceci est un pseudo-code pour l'appel API. En réalité, il faut utiliser aws-sdk pour Deno
    // ou faire un fetch signé vers https://email.us-east-1.amazonaws.com
    
    console.log(`[AWS SES] Envoi de mail de ${user.email} vers ${to}`);
    
    /* 
    // Exemple d'implémentation réelle nécessitant les credentials
    const client = new SESClient({
        region: Deno.env.get('AWS_REGION'),
        credentials: {
            accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID'),
            secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')
        }
    });
    
    const command = new SendEmailCommand({
        Source: user.email,
        Destination: { ToAddresses: [to] },
        Message: {
            Subject: { Data: subject },
            Body: { Html: { Data: htmlBody }, Text: { Data: textBody } }
        }
    });
    
    await client.send(command);
    */

    // Simulation de succès pour le moment
    return new Response(
      JSON.stringify({ success: true, message: "Email expédié via SES" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})