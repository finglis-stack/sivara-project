# TOME 11 : IDENTITÉ & BIOMÉTRIE (KYC)
**CIBLE :** `supabase/functions/verify-identity/index.ts`

## 11.1. ANALYSE FORENSIQUE IA (GEMINI)

L'Edge Function envoie les images de la pièce d'identité à Google Gemini 1.5 Pro.
*   **Prompt Engineering :** Le prompt demande explicitement de détecter les signes de fraude (pixels modifiés, moiré d'écran).
*   **Extraction :** Récupère Nom, Prénom, Date de Naissance, Expiration.

## 11.2. VALIDATION MATHÉMATIQUE (NAM)

Pour le Québec (RAMQ), le système ne fait pas confiance à l'OCR.
*   Il recalcule le Numéro d'Assurance Maladie théorique à partir du Nom/Prénom/Date extraits.
*   Il compare avec le numéro lu sur la carte.
*   Si ça matche : **TrustScore +60**. C'est une preuve forte d'authenticité.

## 11.3. FINGERPRINTING

Utilisation de `FingerprintJS` pour lier la vérification à un appareil physique.
*   Détecte si l'utilisateur utilise une machine virtuelle ou un émulateur (souvent utilisé par les fraudeurs).