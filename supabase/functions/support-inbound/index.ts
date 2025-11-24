// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { Resend } from 'npm:resend@3.2.0';

// @ts-ignore
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const resend = new Resend(RESEND_API_KEY);

const sendRejectionEmail = async (email: string) => {
  console.log(`[Support] Envoi rejet à ${email}`);
  await resend.emails.send({
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
  });
};

serve(async (req) => {
  try {
    const payload = await req.json();
    
    // Extraction robuste de l'ID (supporte structure évènement et structure directe)
    const dataObj = payload.data || payload;
    const emailId = dataObj.id || dataObj.email_id || payload.id;

    console.log(`[Inbound] Webhook reçu. ID extrait: ${emailId}`);
    
    if (!emailId) {
        console.error("[Inbound] ID MANQUANT. Payload dump:", JSON.stringify(payload).substring(0, 200));
        return new Response("No email ID found in webhook", { status: 200 }); // 200 to stop retries on bad payloads
    }

    // Pause pour laisser Resend traiter l'email (ingestion & disponibilité API)
    console.log(`[Inbound] Attente de 3s pour propagation API...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Récupération du contenu complet via API SDK
    // Note: On utilise le SDK qui gère mieux les endpoints que le fetch manuel
    const { data: emailData, error: fetchError } = await resend.emails.get(emailId);

    if (fetchError || !emailData) {
        console.error("[Inbound] Echec récupération contenu:", fetchError);
        // Fallback sur les données du webhook si l'API échoue (mieux que rien)
        console.log("[Inbound] Utilisation des données du webhook en fallback (potentiellement incomplètes)");
    } else {
        console.log(`[Inbound] Contenu récupéré avec succès via API.`);
    }

    // Fusionner les données (priorité à l'API, sinon webhook)
    const finalData = emailData || dataObj;

    const from = finalData.from?.email || finalData.from || "inconnu@unknown.com";
    let subject = finalData.subject || '(Sans sujet)';
    let html = finalData.html;
    let text = finalData.text;

    // Logique de contenu
    let bodyContent = html;
    if (!bodyContent || bodyContent.trim() === '') {
        bodyContent = text ? text.replace(/\n/g, '<br/>') : '';
    }

    if (!bodyContent || bodyContent.trim() === '') {
        bodyContent = '<p><em>(Contenu vide ou illisible)</em></p>';
    }

    if (subject.length > 150) {
        const oldSubject = subject;
        subject = oldSubject.substring(0, 50) + '...';
        bodyContent = `<p><strong>Sujet original :</strong> ${oldSubject}</p><hr/>${bodyContent}`;
    }

    // Nettoyage email expediteur
    let email = from;
    if (typeof from === 'string') {
        // Extrait l'email si format "Nom <email@domaine.com>"
        const match = from.match(/<(.+)>/);
        if (match) email = match[1];
    }
    email = email.trim().toLowerCase();

    console.log(`[Inbound] Traitement pour l'expéditeur: ${email}`);

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. VÉRIFICATION CLIENT
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .or(`email.eq.${email},contact_email.eq.${email}`)
        .maybeSingle();

    let userId = profile?.id;
    
    // Fallback: Recherche dans Auth Users (admin)
    if (!userId) {
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const authUser = authUsers.find((u: any) => u.email?.toLowerCase() === email);
        if (authUser) userId = authUser.id;
    }

    if (!userId) {
      await sendRejectionEmail(email);
      return new Response(JSON.stringify({ error: 'User not found, rejection sent' }), { status: 200 });
    }

    // 2. LOGIQUE TICKET (Thread)
    // On cherche le dernier ticket ouvert de cet utilisateur
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
      // Mise à jour ticket existant
      await supabase.from('support_tickets').update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'open' // On réouvre si c'était suspendu
      }).eq('id', ticketId);
    } else {
      // Nouveau ticket
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
    const { error: msgError } = await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: userId,
      sender_email: email,
      body: bodyContent,
      is_staff_reply: false
    });

    if (msgError) throw msgError;

    console.log(`[Inbound] Succès. Ticket: ${ticketId}`);
    return new Response(JSON.stringify({ success: true, ticketId }), { status: 200 });

  } catch (error) {
    console.error("[Inbound Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});