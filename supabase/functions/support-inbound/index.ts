// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// @ts-ignore
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const sendRejectionEmail = async (email: string) => {
  console.log(`[Support] Envoi rejet à ${email}`);
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Sivara Support <support@sivara.ca>',
      to: [email],
      subject: 'Action requise : Compte client nécessaire',
      html: `
        <div style="font-family: sans-serif; color: #111; padding: 20px;">
          <h2 style="margin-top:0;">Bonjour,</h2>
          <p>Nous avons bien reçu votre message.</p>
          <p>Cependant, le système de support prioritaire est <strong>exclusivement réservé aux clients identifiés</strong> de Sivara Canada.</p>
          <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #000;">
            Aucun compte actif n'a été trouvé pour l'adresse : <strong>${email}</strong>
          </p>
          <p>Pour bénéficier de l'assistance, veuillez créer un compte ou vous connecter :</p>
          <div style="margin: 30px 0;">
            <a href="https://sivara.ca" style="background: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accéder à Sivara.ca</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Sivara Canada - Automated Security System</p>
        </div>
      `
    }),
  });
};

serve(async (req) => {
  try {
    const payload = await req.json();
    // Le payload initial contient l'ID
    const initialData = payload.data || payload;
    const emailId = initialData.id;

    console.log(`[Inbound] Webhook reçu pour ID: ${emailId}. Attente de 2s...`);
    
    // Pause de 2 secondes pour laisser le temps à Resend de traiter
    await new Promise(resolve => setTimeout(resolve, 2000));

    let emailData = initialData;

    // Si on a un ID, on va chercher le contenu complet via l'API
    if (emailId) {
        try {
            const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`
                }
            });
            
            if (res.ok) {
                emailData = await res.json();
                console.log(`[Inbound] Contenu récupéré via API pour ${emailId}`);
            } else {
                console.error(`[Inbound] Echec API Resend: ${res.status}`);
            }
        } catch (e) {
            console.error(`[Inbound] Erreur fetch API: ${e.message}`);
        }
    }

    const from = emailData.from?.email || emailData.from; // L'API renvoie parfois un objet { email: "..." }
    let subject = emailData.subject || '(Sans sujet)';
    let html = emailData.html;
    let text = emailData.text;

    // Logique de contenu (inchangée mais utilisant les données fraîches)
    let bodyContent = html;
    if (!bodyContent || bodyContent.trim() === '') {
        bodyContent = text ? text.replace(/\n/g, '<br/>') : '';
    }

    if (subject.length > 150) {
        const oldSubject = subject;
        subject = oldSubject.substring(0, 50) + '...';
        bodyContent = `<p><strong>Sujet original :</strong> ${oldSubject}</p><hr/>${bodyContent}`;
    }

    if (!bodyContent || bodyContent.trim() === '') {
        bodyContent = '<p><em>(Contenu vide ou illisible)</em></p>';
    }

    // Nettoyage email
    let email = from;
    // Si c'est une chaine "Nom <email>", on extrait
    if (typeof from === 'string') {
        email = from.match(/<(.+)>/)?.[1] || from;
    }

    console.log(`[Inbound] Traitement pour: ${email}`);

    if (!email) return new Response("No sender found", { status: 200 });

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. VÉRIFICATION CLIENT
    const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .or(`email.eq.${email},contact_email.eq.${email}`)
        .maybeSingle();

    let userId = users?.id;
    
    if (!userId) {
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const authUser = authUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim());
        if (authUser) userId = authUser.id;
    }

    if (!userId) {
      await sendRejectionEmail(email);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 200 });
    }

    // 2. LOGIQUE TICKET
    const { data: existingTicket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'closed') 
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketId = existingTicket?.id;

    if (ticketId) {
      await supabase.from('support_tickets').update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'open'
      }).eq('id', ticketId);
    } else {
      const { data: newTicket, error: createError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: userId,
          customer_email: email,
          subject: subject,
          status: 'open',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) throw createError;
      ticketId = newTicket.id;
    }

    // 3. INSERTION MESSAGE
    await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: userId,
      sender_email: email,
      body: bodyContent,
      is_staff_reply: false
    });

    return new Response(JSON.stringify({ success: true, ticketId }), { status: 200 });

  } catch (error) {
    console.error("[Inbound Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});