// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Auth Check (Staff Only)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabase.from('profiles').select('is_staff').eq('id', user.id).single();
    if (!profile?.is_staff) throw new Error('Forbidden');

    const { ticketId, messageBody, status } = await req.json();

    // Récupérer infos ticket
    const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', ticketId).single();
    if (!ticket) throw new Error('Ticket introuvable');

    // Envoyer email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Sivara Support <support@sivara.ca>',
        to: [ticket.customer_email],
        subject: `Re: ${ticket.subject} [Ticket #${ticket.id.substring(0,8)}]`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.6;">
            ${messageBody.replace(/\n/g, '<br/>')}
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">Sivara Canada - Support Team</p>
          </div>
        `
      }),
    });

    if (!resendRes.ok) {
        const err = await resendRes.text();
        throw new Error(`Resend Error: ${err}`);
    }

    // Enregistrer le message en base
    await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_email: 'support@sivara.ca',
      body: messageBody,
      is_staff_reply: true
    });

    // Mettre à jour le statut du ticket
    if (status) {
        await supabase.from('support_tickets').update({ 
            status: status,
            updated_at: new Date().toISOString()
        }).eq('id', ticketId);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});