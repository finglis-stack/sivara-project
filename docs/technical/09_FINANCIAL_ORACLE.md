# TOME 9 : ORACLE FINANCIER (DAAS)
**CIBLE :** `src/components/OraclePanel.tsx`, `src/pages/DeviceCustomerDetails.tsx`

## 9.1. MODÉLISATION MONTE-CARLO

L'Oracle est un outil de prédiction financière pour la location de matériel.
*   Il projette le cashflow sur 24 mois.
*   Il intègre des variables aléatoires (Volatilité du marché, Inflation).

## 9.2. INTÉGRATION DU RISQUE (TRUST SCORE)

Le score de confiance issu du KYC (voir Tome 11) impacte directement le modèle.
*   **Formule :** `Probabilité_Paiement(Mois N) = TrustScore * (Taux_Retention ^ N)`.
*   Un client avec un mauvais score KYC verra sa courbe de rentabilité "Probable" s'effondrer après quelques mois, signalant à l'admin un risque de perte sèche.

## 9.3. STRATÉGIE DE SORTIE (FLIP POINT)

L'Oracle calcule le moment optimal pour revendre le matériel.
*   Il croise la courbe de dépréciation du matériel (Hardware Value) avec le cash accumulé.
*   Il identifie le mois où `Cash + Valeur_Residuelle` est maximal.