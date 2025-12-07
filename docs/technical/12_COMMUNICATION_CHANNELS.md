# TOME 12 : CANAUX DE COMMUNICATION
**CIBLE :** `supabase/functions/support-inbound`, `supabase/functions/support-outbound`

## 12.1. WEBHOOKS EMAIL ENTRANTS

Les emails envoyés à `support@sivara.ca` sont redirigés vers une Edge Function.
*   Parsing du JSON (Sujet, Corps, Expéditeur).
*   Recherche du client dans la base `profiles` via l'email.
*   Création automatique d'un ticket dans `support_tickets`.

## 12.2. OUTBOUND TRANSACTIONNEL

Lorsqu'un agent répond depuis le dashboard admin :
*   L'Edge Function génère un email HTML brandé.
*   Elle injecte la signature dynamique de l'agent (Nom, Titre).
*   Elle envoie via l'API Resend.
*   Elle archive la réponse dans la base de données pour l'historique.