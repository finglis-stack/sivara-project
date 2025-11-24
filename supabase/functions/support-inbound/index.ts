// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { Webhook } from 'https://esm.sh/svix@1.8.1'

// @ts-ignore
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// @ts-ignore
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

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
    // --- VÉRIFICATION SIGNATURE WEBHOOK ---
    const payload = await req.text();
    const headers = req.headers;

    if (RESEND_WEBHOOK_SECRET) {
      const wh = new Webhook(RESEND_WEBHOOK_SECRET);
      const svix_id = headers.get("svix-id");
      const svix_timestamp = headers.get("svix-timestamp");
      const svix_signature = headers.get("svix-signature");

      if (!svix_id || !svix_timestamp || !svix_signature) {
        console.error("Webhook Error: Missing svix headers");
        return new Response("Error occured -- no svix headers", { status: 400 });
      }

      try {
        wh.verify(payload, {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        });
      } catch (err) {
        console.error("Webhook Error: Signature verification failed", err);
        return new Response("Error occured -- signature verification failed", { status: 400 });
      }
    }
    // --------------------------------------

    const data = JSON.parse(payload);
    
    // Gestion Inbound (Email reçu)
    // Note: Resend peut wrapper l'event différemment selon le type de webhook
    // Ici on assume le format direct Inbound ou Event "email.delivery"
    
    // Pour Inbound, les champs sont souvent à la racine ou dans 'data'
    const from = data.from || data.data?.from;
    const subject = data.subject || data.data?.subject;
    const text = data.text || data.data?.text;
    const html = data.html || data.data?.html;

    if (!from) {
        // Ce n'est peut-être pas un email entrant (ex: event de livraison), on ignore poliment
        return new Response(JSON.stringify({ message: 'Not an inbound email event' }), { status: 200 });
    }

    const email = from.replace(/.*<(.+)>$/, '$1').trim(); // Extraction email propre

    console.log(`[Support] Email reçu de: ${email}`);

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Vérifier si l'utilisateur existe
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