# TOME 7 : MACHINE VIRTUELLE & PROTOCOLE SBP
**CIBLE :** `src/lib/sivara-vm.ts`, `supabase/functions/sivara-kernel/index.ts`

## 7.1. LE FORMAT `.SIVARA` (SBP)

C'est un format de fichier binaire propriétaire, pas du JSON.

**Structure Hexadécimale :**
```
[MAGIC: 53 56 52 03] [OP: B2] [LEN] [IV] [OP: D4] [LEN] [META] [OP: C3] [LEN] [DATA] [OP: FF]
```
*   `MAGIC` : Signature "SVR3".
*   `OP CODES` : Instructions pour la VM (`B2`=IV, `C3`=Data).

## 7.2. OBFUSCATION (BIT SHUFFLING)

Pour empêcher l'analyse du fichier, le Kernel applique une transformation :
1.  **Rotation de Bits :** `(byte << 2) | (byte >> 6)`.
2.  **XOR Dynamique :** `byte ^ (seed + index)`.
*   Cela détruit l'entropie statistique du fichier. Il ressemble à du bruit blanc.

## 7.3. SMART CONTRACTS DE SÉCURITÉ

Le bloc `META` contient des règles (JSON).
*   Lors de l'ouverture (`decompile`), le Kernel lit ces règles.
*   Si `geofence` est actif, il vérifie l'IP du client.
*   Si les conditions ne sont pas remplies, le Kernel lève une exception `Panic` et ne renvoie jamais le payload chiffré. La clé de l'utilisateur devient inutile.