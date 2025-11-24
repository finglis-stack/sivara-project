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

    // 1. Auth Check & Staff Profile Retrieval
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) throw new Error('Unauthorized');

    // Récupérer le profil du staff pour la signature
    const { data: staffProfile } = await supabase
        .from('profiles')
        .select('is_staff, first_name, last_name, job_title')
        .eq('id', user.id)
        .single();

    if (!staffProfile?.is_staff) throw new Error('Forbidden: Staff access required');

    const { ticketId, messageBody, status } = await req.json();

    // 2. Récupérer infos ticket
    const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', ticketId).single();
    if (!ticket) throw new Error('Ticket introuvable');

    // 3. Construction de l'email HTML Design
    const ticketRef = ticket.id.substring(0, 8).toUpperCase();
    const staffName = `${staffProfile.first_name || 'Agent'} ${staffProfile.last_name || ''}`.trim();
    const staffRole = staffProfile.job_title || 'Support Team';
    
    // Conversion des sauts de ligne en <br> pour l'HTML
    const formattedBody = messageBody.replace(/\n/g, '<br/>');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          .wrapper { width: 100%; background-color: #f4f4f5; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .header { background-color: #09090b; padding: 32px 40px; text-align: center; }
          .brand { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; text-decoration: none; }
          .ticket-pill { display: inline-block; background: rgba(255,255,255,0.15); color: #ffffff; padding: 6px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 12px; letter-spacing: 0.5px; }
          .content { padding: 40px; color: #333333; font-size: 16px; line-height: 1.6; }
          .signature { margin-top: 40px; padding-top: 24px; border-top: 1px solid #e4e4e7; }
          .staff-info { display: flex; align-items: center; gap: 12px; }
          .staff-avatar { width: 40px; height: 40px; background-color: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; float: left; margin-right: 15px;}
          .staff-details { overflow: hidden; }
          .staff-name { font-weight: 700; color: #09090b; font-size: 15px; display: block; }
          .staff-role { font-size: 13px; color: #71717a; display: block; }
          .footer { background-color: #fafafa; padding: 24px 40px; text-align: center; border-top: 1px solid #f4f4f5; }
          .footer-text { font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0; }
          a { color: #2563eb; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="brand">Sivara</div>
              <div class="ticket-pill">Ticket #${ticketRef}</div>
            </div>
            
            <div class="content">
              ${formattedBody}
              
              <div class="signature">
                <div style="overflow: hidden;">
                   <div class="staff-avatar">${staffProfile.first_name?.[0] || 'S'}</div>
                   <div style="padding-top: 2px;">
                      <span class="staff-name">${staffName}</span>
                      <span class="staff-role">${staffRole} • Sivara Canada</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Vous recevez cet email car vous avez contacté le support Sivara.<br>
                &copy; ${new Date().getFullYear()} Sivara Inc. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // 4. Envoi effectif via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Sivara Support <support@sivara.ca>',
        to: [ticket.customer_email],
        subject: `[Ticket #${ticketRef}] ${ticket.subject}`,
        html: emailHtml
      }),
    });

    if (!resendRes.ok) {
        const err = await resendRes.text();
        console.error("Resend API Error:", err);
        // On ne throw pas forcément ici pour ne pas bloquer l'UI admin si l'email plante,
        // mais on devrait idéalement le signaler. Pour l'instant on log.
        // Si tu veux bloquer l'envoi admin en cas d'erreur email, décommente la ligne suivante:
        // throw new Error(`Erreur envoi email: ${err}`);
    }

    // 5. Enregistrer le message en base (Historique)
    await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_email: 'support@sivara.ca',
      body: formattedBody,
      is_staff_reply: true
    });

    // 6. Mettre à jour le statut du ticket
    if (status) {
        await supabase.from('support_tickets').update({ 
            status: status,
            updated_at: new Date().toISOString()
        }).eq('id', ticketId);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Support Outbound Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});