// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// @ts-ignore
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const sendRejectionEmail = async (email: string) => {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Sivara Support <support@sivara.ca>',
      to: [email],
      subject: 'Accès réservé aux clients Sivara',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Bonjour,</h1>
          <p>Nous avons bien reçu votre demande.</p>
          <p>Cependant, le support technique est réservé aux clients disposant d'un compte actif sur Sivara Canada.</p>
          <p>Nous n'avons trouvé aucun compte associé à cette adresse email.</p>
          <br/>
          <a href="https://sivara.ca" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Créer un compte Sivara</a>
        </div>
      `
    }),
  });
};

serve(async (req) => {
  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    
    // Resend Webhook format
    const { from, subject, text, html } = payload;
    const email = from.replace(/.*<(.+)>$/, '$1').trim(); // Extraction email propre

    console.log(`[Support] Email reçu de: ${email}`);

    // 1. Vérifier si l'utilisateur existe
    // On doit chercher dans auth.users, mais via RPC ou admin API
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log(`[Support] Utilisateur inconnu: ${email}. Rejet.`);
      await sendRejectionEmail(email);
      return new Response(JSON.stringify({ message: 'User not found, rejection sent' }), { status: 200 });
    }

    // 2. Chercher un ticket ouvert
    const { data: existingTicket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('user_id', user.id)
      .neq('status', 'closed')
      .single();

    let ticketId = existingTicket?.id;

    // 3. Créer ticket si inexistant
    if (!ticketId) {
      const { data: newTicket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          customer_email: email,
          subject: subject || 'Nouveau ticket sans sujet',
          status: 'open'
        })
        .select()
        .single();
      
      if (ticketError) throw ticketError;
      ticketId = newTicket.id;
      console.log(`[Support] Nouveau ticket créé: ${ticketId}`);
    } else {
      // Update timestamp
      await supabase.from('support_tickets').update({ 
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        status: 'open' // Réouvrir si suspendu
      }).eq('id', ticketId);
      console.log(`[Support] Ticket existant mis à jour: ${ticketId}`);
    }

    // 4. Ajouter le message
    await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_email: email,
      body: html || text || '(Message vide)',
      is_staff_reply: false
    });

    return new Response(JSON.stringify({ success: true, ticketId }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});