# VOLUME 2 : LE NOYAU CRYPTOGRAPHIQUE (ZERO-KNOWLEDGE)
**STANDARD :** AES-256-GCM / PBKDF2 / SHA-512
**STATUT :** AUDIT CRITIQUE REQUIS

---

## 1. INTRODUCTION À L'ARCHITECTURE "BLIND SERVER"

Sivara repose sur un postulat de sécurité paranoïaque : **Le serveur est compromis.**
Toute l'architecture cryptographique est conçue pour que, même si un attaquant obtient un accès `root` à la base de données Supabase, il ne puisse extraire aucune donnée utilisateur lisible (titres de documents, contenus, emails).

---

## 2. LE SERVICE DE CHIFFREMENT CLIENT (`src/lib/encryption.ts`)

Ce module est un wrapper autour de l'API W3C **Web Crypto** (`window.crypto.subtle`). Il s'exécute exclusivement dans le navigateur de l'utilisateur. Aucune clé privée ne quitte jamais la mémoire volatile (RAM) du client.

### 2.1. Dérivation de Clé (Key Derivation)

Avant de chiffrer quoi que ce soit, nous devons transformer un secret (Mot de passe ou ID Utilisateur) en une clé cryptographique mathématiquement robuste.

```typescript
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  encoder.encode(secret),
  'PBKDF2',
  false,
  ['deriveBits', 'deriveKey']
);

this.masterKey = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: finalSalt,
    iterations: 100000,
    hash: 'SHA-512'
  },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);
```

**Dissémination des Paramètres :**
*   **Algorithme : PBKDF2** (Password-Based Key Derivation Function 2). Choisi pour sa robustesse éprouvée (NIST approved).
*   **Hash : SHA-512**. Utilise des blocs de 64 bits, plus performant sur les CPU 64 bits modernes que SHA-256, et plus résistant aux collisions.
*   **Itérations : 100,000**. C'est le paramètre de coût temporel.
    *   *But :* Ralentir l'exécution de la fonction de dérivation.
    *   *Impact :* Pour un utilisateur légitime, attendre 100ms au login est imperceptible. Pour un attaquant essayant de deviner le mot de passe (Brute Force), devoir dépenser 100ms de calcul CPU *par tentative* rend l'attaque économiquement impossible (des siècles pour cracker un mot de passe fort).
*   **Sel (Salt) :** Si l'utilisateur n'a pas de mot de passe dédié au document, nous utilisons une combinaison déterministe : `userID + "sivara-static-salt"`. Cela empêche l'utilisation de Rainbow Tables pré-calculées.

### 2.2. Le Chiffrement Symétrique (AES-GCM)

```typescript
const iv = crypto.getRandomValues(new Uint8Array(12));
const encryptedData = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: iv, tagLength: 128 },
  this.masterKey,
  data
);
```

**Pourquoi AES-GCM (Galois/Counter Mode) ?**
C'est un mode de chiffrement **AEAD** (Authenticated Encryption with Associated Data).
1.  **Confidentialité :** Le texte est chiffré (AES).
2.  **Intégrité & Authenticité :** GCM génère un "Tag" d'authentification (inclus dans le résultat chiffré).
    *   Si un bit du message chiffré est modifié (par corruption réseau ou par un attaquant malveillant), le Tag ne correspondra plus lors du déchiffrement.
    *   Le navigateur rejettera l'opération avec une erreur `OperationError` avant même de tenter de produire du texte clair. Cela neutralise les attaques par "Oracle de Padding" ou modification de bits.

**Gestion du Vecteur d'Initialisation (IV) :**
*   Taille : 12 octets (96 bits), le standard pour GCM.
*   Génération : `crypto.getRandomValues`.
*   **Unicité :** Il est impératif de ne jamais réutiliser le même couple (Clé, IV). Puisque nous générons un IV aléatoire à *chaque sauvegarde*, cette condition est respectée.
*   Stockage : L'IV n'est pas secret. Il est stocké en clair (Base64) à côté du contenu chiffré dans la base de données (`encryption_iv`).

---

## 3. LE KERNEL SIVARA (`supabase/functions/sivara-kernel`)

Cette fonction Edge (Deno) agit comme une "Machine Virtuelle" pour gérer le format de fichier propriétaire `.sivara`.

### 3.1. Structure du SBP (Sivara Binary Protocol)

Le format `.sivara` n'est pas un JSON. C'est un flux binaire séquentiel conçu pour être opaque.

| Offset | Composant | Description |
| :--- | :--- | :--- |
| 0x00 | **Magic Header** | `0x53 0x56 0x52 0x03` (ASCII: SVR3). Identifie le type de fichier. |
| 0x04 | **OpCode 1** | `0xB2` (Start IV Block). |
| 0x05 | **Length** | Longueur de l'IV (généralement 12). |
| 0x06 | **IV Data** | Les octets bruts de l'IV. |
| ... | **OpCode 2** | `0xD4` (Start Meta Block). |
| ... | **OpCode 3** | `0xC3` (Start Payload Block). Contient les données chiffrées + obfusquées. |
| ... | **EOF** | `0xFF` (End of File). |

### 3.2. Obfuscation par Bit-Shuffling

En plus du chiffrement AES (qui rend les données aléatoires), le Kernel applique une couche d'obfuscation propriétaire sur les données binaires avant de les écrire dans le fichier.

```typescript
// Extrait de l'algorithme de shuffling
const result = new Uint8Array(buffer.length);
for (let i = 0; i < buffer.length; i++) {
  const key = (seed + i) & 0xFF; // Clé de flux dérivée de la position
  // Rotation de 2 bits vers la gauche + XOR
  result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
}
```

**Analyse de Sécurité :**
*   Ce n'est pas du chiffrement fort (c'est réversible facilement si on connaît l'algo).
*   **Objectif :** Casser la signature statistique des fichiers. Un fichier chiffré AES commence souvent par des headers ou des structures reconnaissables. Le Bit-Shuffling détruit ces motifs.
*   Cela empêche les outils d'analyse automatique (DLP, Antivirus, Scanners de flux) d'identifier le contenu comme étant "des données chiffrées AES", le faisant passer pour du bruit binaire aléatoire ou un format inconnu propriétaire.

### 3.3. Contrats Intelligents de Sécurité (Smart Contracts)

Lors de l'exportation d'un fichier `.sivara`, l'utilisateur peut définir des règles d'accès. Ces règles sont scellées dans le bloc `META_TAG` du fichier.

Le Kernel applique ces règles lors de la décompilation (`decompile`), **avant** de renvoyer le payload chiffré au client.

#### A. Geofencing Actif
```typescript
if (sec.geofence) {
    const clientIp = req.headers.get('x-forwarded-for');
    const geoData = await fetch(`https://api.ipgeolocation.io...&ip=${clientIp}`);
    const distance = getDistanceKm(geoData.lat, geoData.lng, sec.lat, sec.lng);
    
    if (distance > sec.radius) throw new Error("Accès hors zone");
}
```
Si le fichier est ouvert hors de la zone autorisée (ex: QG de l'entreprise), le serveur refuse de livrer la "matière première" chiffrée. La clé de déchiffrement que possède l'utilisateur devient inutile car il n'a rien à déchiffrer.

#### B. Verrouillage Biométrique (Fingerprinting)
Le fichier peut être lié à un `visitorId` (Empreinte matérielle générée par `FingerprintJS`).
Le Kernel compare l'empreinte envoyée par le client avec celle stockée dans les métadonnées du fichier.
*   Si le fichier a été copié sur une clé USB et ouvert sur un autre ordinateur : **Accès Refusé**.

---

## 4. MENACES ET MITIGATIONS

### Menace 1 : Compromission de la Base de Données (SQL Dump)
*   **Scénario :** Un hacker vole toute la table `documents`.
*   **Impact :** Il obtient des blobs Base64 (`content`) et des IVs.
*   **Mitigation :** Sans les clés maîtres (qui sont dans la tête des utilisateurs ou dérivées à la volée dans le navigateur), ces données sont statistiquement indiscernables de données aléatoires. Le `Bit-Shuffling` ajoute une couche de complexité pour l'ingénierie inverse.

### Menace 2 : Attaque Man-in-the-Middle (MITM)
*   **Scénario :** Un attaquant intercepte le trafic entre le Client et Supabase.
*   **Mitigation :**
    *   HTTPS (TLS 1.3) obligatoire.
    *   Même si TLS est cassé, l'attaquant ne voit passer que des données déjà chiffrées (E2EE). Il ne peut ni les lire ni les modifier sans casser le Tag d'intégrité AES-GCM.

### Menace 3 : Attaque XSS (Cross-Site Scripting)
*   **Scénario :** Un script malveillant est injecté dans la page.
*   **Impact :** C'est le risque le plus critique. Si un script tourne dans le contexte de la page, il peut lire la variable `encryptionService.masterKey` en mémoire.
*   **Mitigation :**
    *   Politique CSP (Content Security Policy) stricte.
    *   Cookies `HttpOnly` pour l'authentification (empêche le vol de session, bien que la clé crypto soit en mémoire).
    *   Architecture React qui échappe par défaut les contenus (sauf `dangerouslySetInnerHTML` qui est audité).