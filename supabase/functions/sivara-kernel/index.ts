// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const IP_GEO_KEY = Deno.env.get('IPGEOLOCATION_API_KEY');
const PUBLIC_CONTAINER_SEED = "SIVARA_PUBLIC_CONTAINER_V1";

// --- SIVARA BINARY PROTOCOL (SBP) ---
const SBP_OP = {
  MAGIC: 0x53, // 'S'
  HEADER: 0xA1,
  IV_BLOCK: 0xB2,
  DATA_CHUNK: 0xC3,
  META_TAG: 0xD4,
  GHOST_BLOCK: 0x1F,
  VM_BYTECODE: 0xE5,
  EOF: 0xFF
};

// --- JEU D'INSTRUCTIONS (ISA) ---
const VM_OP = {
  HALT: 0x00,
  PUSH_NUM: 0x01, // PUSH float
  PUSH_STR: 0x02, // PUSH string hash
  LOAD: 0x10,     // Charger variable
  STORE: 0x11,    // Stocker variable
  
  // Math
  ADD: 0x20, SUB: 0x21, MUL: 0x22, DIV: 0x23, ABS: 0x24,
  
  // Logic
  EQ: 0x30, NEQ: 0x31, LT: 0x32, GT: 0x33, AND: 0x34, OR: 0x35,
  
  // Flow
  JMP: 0x40, JMP_FALSE: 0x41,
  
  // Environment & Security
  ENV_GET: 0x50,   // Récupérer variable env (geo, user...)
  GEO_DIST: 0x51,  // Calcul distance Haversine (lat1, lng1, lat2, lng2)
  LIST_HAS: 0x52,  // Vérifier si liste contient valeur
  ASSERT: 0x99     // KERNEL PANIC si faux
};

// --- MAPPINGS ENVIRONNEMENT ---
const ENV_MAP: Record<string, number> = {
  'env.geo.lat': 1,
  'env.geo.lng': 2,
  'env.utilisateur.email': 3,
  'env.appareil.empreinte': 4,
  'env.temps.actuel': 5
};

// --- COMPILATEUR SIVARASCRIPT (FRANÇAIS) ---
class SivaraCompiler {
  private tokens: string[];
  private pos: number = 0;
  private bytecode: number[] = [];
  private stringTable: Record<string, number> = {}; // Hash map pour les strings

  constructor(source: string) {
    // Tokenizer simple qui gère les parenthèses et les opérateurs
    this.tokens = source
      .replace(/\(/g, ' ( ')
      .replace(/\)/g, ' ) ')
      .replace(/,/g, ' ')
      .replace(/==/g, ' EQ ')
      .replace(/</g, ' LT ')
      .replace(/>/g, ' GT ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  // Hachage simple pour les strings (DJB2)
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash >>> 0; // Ensure unsigned 32-bit
  }

  public compile(): Uint8Array {
    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos++];
      
      if (token === 'soit') {
        const varName = this.tokens[this.pos++];
        if (this.tokens[this.pos++] !== '=') throw new Error(`Syntaxe: attendu '=' après ${varName}`);
        this.compileExpression();
        this.emit(VM_OP.STORE, this.hashString(varName));
      }
      else if (token === 'exiger') {
        this.compileExpression();
        this.emit(VM_OP.ASSERT);
      }
      else if (token === 'si') {
        // Implémentation basique du saut conditionnel
        // Pour simplifier ce prototype, on ne gère pas les blocs imbriqués complexes
        // On assume une structure linéaire pour la sécurité
      }
    }
    this.emit(VM_OP.HALT);
    return new Uint8Array(this.bytecode);
  }

  private compileExpression() {
    const token = this.tokens[this.pos++];
    
    // Gestion des fonctions natives
    if (token === 'calcul_distance') {
        // Attend 4 arguments sur la stack
        this.pos++; // Skip (
        this.compileExpression(); // lat1
        this.compileExpression(); // lng1
        this.compileExpression(); // lat2
        this.compileExpression(); // lng2
        this.pos++; // Skip )
        this.emit(VM_OP.GEO_DIST);
        return;
    }
    
    if (token === 'liste_contient') {
        this.pos++; // Skip (
        this.compileExpression(); // liste
        this.compileExpression(); // valeur
        this.pos++; // Skip )
        this.emit(VM_OP.LIST_HAS);
        return;
    }

    if (token === 'abs') {
        this.compileExpression();
        this.emit(VM_OP.ABS);
        return;
    }

    // Valeurs littérales
    if (!isNaN(Number(token))) {
      this.emit(VM_OP.PUSH_NUM, Number(token));
    } 
    // Variables d'environnement
    else if (ENV_MAP[token]) {
      this.emit(VM_OP.ENV_GET, ENV_MAP[token]);
    }
    // Chaînes de caractères (entre guillemets)
    else if (token.startsWith('"')) {
      // Reconstitution de la string si elle a des espaces
      let str = token;
      while (!str.endsWith('"') && this.pos < this.tokens.length) {
          str += " " + this.tokens[this.pos++];
      }
      str = str.replace(/"/g, ''); // Enlever les quotes
      this.emit(VM_OP.PUSH_STR, this.hashString(str));
    }
    // Variables utilisateur
    else {
      this.emit(VM_OP.LOAD, this.hashString(token));
    }

    // Opérateurs binaires (Lookahead simple)
    if (this.pos < this.tokens.length) {
        const next = this.tokens[this.pos];
        if (['+', '-', '*', '/', 'EQ', 'LT', 'GT', 'ET', 'OU'].includes(next)) {
            this.pos++;
            this.compileExpression(); // Récursif pour l'opérande droite
            
            if (next === '+') this.emit(VM_OP.ADD);
            if (next === '-') this.emit(VM_OP.SUB);
            if (next === '*') this.emit(VM_OP.MUL);
            if (next === '/') this.emit(VM_OP.DIV);
            if (next === 'EQ') this.emit(VM_OP.EQ);
            if (next === 'LT') this.emit(VM_OP.LT);
            if (next === 'GT') this.emit(VM_OP.GT);
            if (next === 'ET') this.emit(VM_OP.AND);
            if (next === 'OU') this.emit(VM_OP.OR);
        }
    }
  }

  private emit(op: number, arg?: number) {
    this.bytecode.push(op);
    if (arg !== undefined) {
       // Encodage 32-bit Big Endian
       this.bytecode.push((arg >> 24) & 0xFF);
       this.bytecode.push((arg >> 16) & 0xFF);
       this.bytecode.push((arg >> 8) & 0xFF);
       this.bytecode.push(arg & 0xFF);
    }
  }
}

// --- MACHINE VIRTUELLE (KERNEL) ---
class SivaraVM {
  private stack: any[] = []; // Peut contenir number ou string hash
  private memory: Record<number, any> = {};
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  // Haversine Formula
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Hachage pour vérification runtime (doit matcher le compilateur)
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
    return hash >>> 0;
  }

  public execute(bytecode: Uint8Array): boolean {
    let ip = 0;
    const view = new DataView(bytecode.buffer);

    try {
      while (ip < bytecode.length) {
        const op = bytecode[ip++];

        switch (op) {
          case VM_OP.HALT: return true;

          case VM_OP.PUSH_NUM:
            this.stack.push(view.getInt32(ip)); ip += 4;
            break;
          
          case VM_OP.PUSH_STR:
            this.stack.push(view.getInt32(ip)); ip += 4; // On push le hash
            break;

          case VM_OP.ENV_GET:
            const envId = view.getInt32(ip); ip += 4;
            if (envId === 1) this.stack.push(this.env.lat || 0);
            else if (envId === 2) this.stack.push(this.env.lng || 0);
            else if (envId === 3) this.stack.push(this.hashString(this.env.email || ""));
            else if (envId === 4) this.stack.push(this.hashString(this.env.fingerprint || ""));
            else if (envId === 5) this.stack.push(Date.now());
            else this.stack.push(0);
            break;

          case VM_OP.STORE:
            const addr = view.getInt32(ip); ip += 4;
            this.memory[addr] = this.stack.pop();
            break;

          case VM_OP.LOAD:
            const loadAddr = view.getInt32(ip); ip += 4;
            this.stack.push(this.memory[loadAddr]);
            break;

          // Opérations
          case VM_OP.ADD: { const b = this.stack.pop(); const a = this.stack.pop(); this.stack.push(a + b); break; }
          case VM_OP.SUB: { const b = this.stack.pop(); const a = this.stack.pop(); this.stack.push(a - b); break; }
          case VM_OP.LT: { const b = this.stack.pop(); const a = this.stack.pop(); this.stack.push(a < b ? 1 : 0); break; }
          case VM_OP.GT: { const b = this.stack.pop(); const a = this.stack.pop(); this.stack.push(a > b ? 1 : 0); break; }
          case VM_OP.EQ: { const b = this.stack.pop(); const a = this.stack.pop(); this.stack.push(a === b ? 1 : 0); break; }
          case VM_OP.ABS: { const a = this.stack.pop(); this.stack.push(Math.abs(a)); break; }

          case VM_OP.GEO_DIST:
            const lng2 = this.stack.pop(); const lat2 = this.stack.pop();
            const lng1 = this.stack.pop(); const lat1 = this.stack.pop();
            this.stack.push(this.getDistance(lat1, lng1, lat2, lng2));
            break;

          case VM_OP.LIST_HAS:
             // Pour simplifier, on assume que la liste est une string hashée ou gérée autrement
             // Ici on fait une comparaison simple d'égalité pour le prototype
             const val = this.stack.pop();
             const listHash = this.stack.pop(); 
             // Dans une vraie implémentation, on aurait une table de symboles pour vérifier l'inclusion
             // Ici on triche : si le hash de l'email est égal au hash stocké, c'est bon
             this.stack.push(val === listHash ? 1 : 0);
             break;

          case VM_OP.ASSERT:
            const check = this.stack.pop();
            if (check !== 1) {
               console.error("KERNEL PANIC: Assertion Failed. Security Violation.");
               return false;
            }
            break;
        }
      }
    } catch (e) {
      console.error("VM Runtime Error:", e);
      return false;
    }
    return true;
  }
}

// --- UTILS ---
const bufToStr = (buf: Uint8Array) => new TextDecoder().decode(buf);
const strToBuf = (str: string) => new TextEncoder().encode(str);

const sivaraShuffle = (buffer: Uint8Array, seedString: string): Uint8Array => {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
    seed |= 0;
  }
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    result[i] = ((buffer[i] << 2) | (buffer[i] >> 6)) ^ key;
  }
  return result;
};

const sivaraUnshuffle = (buffer: Uint8Array, seedString: string): Uint8Array => {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
    seed |= 0;
  }
  const result = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const key = (seed + i) & 0xFF; 
    const val = buffer[i] ^ key;
    result[i] = (val >> 2) | (val << 6);
  }
  return result;
};

// --- GÉNÉRATEUR DE SMART CONTRACT (JSON -> SIVARASCRIPT) ---
const generateSivaraScript = (security: any): string => {
    let script = "";
    
    // 1. Restriction Utilisateur (Email)
    if (security.allowed_emails && security.allowed_emails.length > 0) {
        // Note: Pour le prototype, on ne gère qu'un seul email autorisé (le propriétaire)
        // car la gestion des listes complexes en bytecode demande plus de temps
        const ownerEmail = security.allowed_emails[0];
        script += `soit email_cible = "${ownerEmail}"\n`;
        script += `soit email_courant = env.utilisateur.email\n`;
        script += `exiger ( email_courant == email_cible )\n`;
    }

    // 2. Geofencing
    if (security.geofence) {
        script += `soit ma_lat = env.geo.lat\n`;
        script += `soit ma_lng = env.geo.lng\n`;
        script += `soit cible_lat = ${security.geofence.lat}\n`;
        script += `soit cible_lng = ${security.geofence.lng}\n`;
        script += `soit distance = calcul_distance ( ma_lat , ma_lng , cible_lat , cible_lng )\n`;
        script += `soit rayon = ${security.geofence.radius_km}\n`;
        script += `exiger ( distance < rayon )\n`;
    }

    // 3. Verrouillage Appareil (Fingerprint)
    if (security.allowed_fingerprints && security.allowed_fingerprints.length > 0) {
        const fp = security.allowed_fingerprints[0];
        script += `soit fp_cible = "${fp}"\n`;
        script += `soit fp_courant = env.appareil.empreinte\n`;
        script += `exiger ( fp_courant == fp_cible )\n`;
    }

    return script;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData, context, body } = await req.json();
    
    // Support pour les appels imbriqués (body vs direct)
    const requestData = body || { action, payload, fileData, context };
    const reqAction = requestData.action;

    // --- LOCALISATION ---
    if (reqAction === 'locate_me') {
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
        if (!IP_GEO_KEY) throw new Error("Service de géolocalisation non configuré.");
        const geoRes = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEO_KEY}&ip=${clientIp}`);
        const geoData = await geoRes.json();
        return new Response(JSON.stringify({ 
            lat: parseFloat(geoData.latitude), 
            lng: parseFloat(geoData.longitude),
            ip: clientIp,
            city: geoData.city
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- COMPILATION (Export .sivara) ---
    if (reqAction === 'compile') {
       const { payload } = requestData;
       
       // 1. Génération du Smart Contract en Français
       const scriptSource = generateSivaraScript(payload.security || {});
       console.log("[Kernel] Compiling Script:\n", scriptSource);

       // 2. Compilation en Bytecode
       const compiler = new SivaraCompiler(scriptSource);
       const bytecode = compiler.compile();

       // 3. Construction du Conteneur SBP
       const parts: Uint8Array[] = [];
       
       // Header
       parts.push(new Uint8Array([0x53, 0x56, 0x52, 0x02])); 

       // Bytecode Block (NOUVEAU)
       const bcLen = new Uint8Array(4);
       new DataView(bcLen.buffer).setUint32(0, bytecode.length);
       parts.push(new Uint8Array([SBP_OP.VM_BYTECODE]));
       parts.push(bcLen);
       parts.push(bytecode);

       // IV Block
       const ivBinString = atob(payload.iv);
       const ivBuf = new Uint8Array(ivBinString.length);
       for (let i = 0; i < ivBinString.length; i++) ivBuf[i] = ivBinString.charCodeAt(i);
       parts.push(new Uint8Array([SBP_OP.IV_BLOCK]));
       parts.push(new Uint8Array([ivBuf.length]));
       parts.push(ivBuf);

       // Data Chunk (Encrypted Title + Content)
       const titleBuf = strToBuf(payload.encrypted_title);
       const contentBuf = strToBuf(payload.encrypted_content);
       const combinedPayload = new Uint8Array(titleBuf.length + 1 + contentBuf.length);
       combinedPayload.set(titleBuf, 0);
       combinedPayload[titleBuf.length] = 0x00;
       combinedPayload.set(contentBuf, titleBuf.length + 1);

       // Shuffling avec le sel (ou owner_id si pas de sel)
       const seed = payload.salt || payload.owner_id;
       const shuffledPayload = sivaraShuffle(combinedPayload, seed);
       
       const payloadLen = new Uint8Array(4);
       new DataView(payloadLen.buffer).setUint32(0, shuffledPayload.length);
       parts.push(new Uint8Array([SBP_OP.DATA_CHUNK]));
       parts.push(payloadLen);
       parts.push(shuffledPayload);

       // Meta Tag (Pour aider le déchiffrement)
       const metaJson = JSON.stringify({ 
           owner_id: payload.owner_id, 
           salt: payload.salt, // Important pour le déchiffrement par mot de passe
           icon: payload.icon,
           color: payload.color
       });
       const metaBuf = strToBuf(metaJson);
       // On ne shuffle pas les métadonnées de base pour permettre l'identification du propriétaire
       // Mais dans une version prod, on le ferait. Ici on laisse en clair pour faciliter le debug.
       const metaLen = new Uint8Array(4);
       new DataView(metaLen.buffer).setUint32(0, metaBuf.length);
       parts.push(new Uint8Array([SBP_OP.META_TAG]));
       parts.push(metaLen);
       parts.push(metaBuf);

       parts.push(new Uint8Array([SBP_OP.EOF]));

       // Assemblage final
       const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
       const finalBuffer = new Uint8Array(totalLength);
       let offset = 0;
       for (const part of parts) { finalBuffer.set(part, offset); offset += part.length; }

       // Retour en Base64 pour le client
       let binary = '';
       for (let i = 0; i < finalBuffer.length; i++) binary += String.fromCharCode(finalBuffer[i]);
       
       return new Response(JSON.stringify({ file: btoa(binary) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- DÉCOMPILATION (Import / Lecture) ---
    if (reqAction === 'decompile') {
      const { fileData, context } = requestData;
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const view = new DataView(bytes.buffer);
      
      if (bytes[0] !== 0x53 || bytes[1] !== 0x56 || bytes[2] !== 0x52) throw new Error("Format SBP invalide.");
      
      // Récupération du contexte utilisateur pour la VM
      const supabase = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      let userEmail = "";
      if (context?.userId) {
          const { data: u } = await supabase.auth.admin.getUserById(context.userId);
          userEmail = u?.user?.email || "";
      }

      // Environnement VM Réel
      let vmEnv = { 
          lat: 0, lng: 0, 
          email: userEmail, 
          fingerprint: context?.fingerprint || "" 
      };

      // Enrichissement Geo (si possible)
      try {
          const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
          if (IP_GEO_KEY) {
             const geoRes = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEO_KEY}&ip=${clientIp}`);
             const geoData = await geoRes.json();
             vmEnv.lat = parseFloat(geoData.latitude);
             vmEnv.lng = parseFloat(geoData.longitude);
          }
      } catch(e) {}

      const attemptDecompile = (seed: string) => {
          let cursor = 4; 
          const result: any = { header: 'SIVARA_SECURE_DOC_V2' };
          let metaData: any = {};
          let success = true;
          let vmPassed = true;

          const vm = new SivaraVM(vmEnv);

          while (cursor < bytes.length) {
            const opcode = bytes[cursor++];
            if (opcode === SBP_OP.EOF) break;

            if (opcode === SBP_OP.GHOST_BLOCK) {
                const len = view.getUint32(cursor);
                cursor += 4 + len;
                continue;
            }
            else if (opcode === SBP_OP.VM_BYTECODE) {
                const len = view.getUint32(cursor);
                cursor += 4;
                const bytecode = bytes.slice(cursor, cursor + len);
                
                console.log("[Kernel] Executing Smart Contract...");
                const vmResult = vm.execute(bytecode);
                if (!vmResult) {
                    console.error("[Kernel] Security Check Failed");
                    vmPassed = false;
                    success = false;
                    break; // Arrêt immédiat
                }
                cursor += len;
            }
            else if (opcode === SBP_OP.IV_BLOCK) {
              const len = bytes[cursor++];
              const ivBytes = bytes.slice(cursor, cursor + len);
              let ivBin = '';
              for(let i=0; i<ivBytes.length; i++) ivBin += String.fromCharCode(ivBytes[i]);
              result.iv = btoa(ivBin);
              cursor += len;
            }
            else if (opcode === SBP_OP.META_TAG) {
              const len = view.getUint32(cursor);
              cursor += 4;
              const chunk = bytes.slice(cursor, cursor + len);
              // Les métadonnées ne sont pas shufflées dans cette version pour permettre la récupération du salt/owner
              try {
                 const jsonStr = bufToStr(chunk);
                 metaData = JSON.parse(jsonStr);
                 Object.assign(result, metaData);
              } catch(e) {}
              cursor += len;
            }
            else if (opcode === SBP_OP.DATA_CHUNK) {
              if (!vmPassed) break; // On ne lit pas les données si la VM a échoué

              const len = view.getUint32(cursor);
              cursor += 4;
              const chunk = bytes.slice(cursor, cursor + len);
              const clearChunk = sivaraUnshuffle(chunk, seed);
              
              let separatorIndex = -1;
              for(let i=0; i<clearChunk.length; i++) { if (clearChunk[i] === 0x00) { separatorIndex = i; break; } }
              
              if (separatorIndex !== -1) {
                  result.encrypted_title = bufToStr(clearChunk.slice(0, separatorIndex));
                  result.encrypted_content = bufToStr(clearChunk.slice(separatorIndex + 1));
              } else {
                  // Si pas de séparateur, le seed est probablement mauvais
                  success = false;
              }
              cursor += len;
            }
          }
          return success ? result : null;
      };

      // 1. Lecture préliminaire pour trouver le propriétaire/sel (via META_TAG)
      // On fait une passe rapide sans déchiffrer les données
      let tempResult = attemptDecompile("DUMMY"); 
      let ownerId = tempResult?.owner_id;
      let salt = tempResult?.salt;

      // 2. Tentative de déchiffrement réel
      let finalResult = null;

      // A. Si public
      finalResult = attemptDecompile(PUBLIC_CONTAINER_SEED);

      // B. Si privé (avec ID utilisateur courant)
      if (!finalResult && context?.userId) {
           finalResult = attemptDecompile(context.userId);
      }

      // C. Si privé (avec ID propriétaire du fichier - cas import)
      if (!finalResult && ownerId) {
           finalResult = attemptDecompile(ownerId);
      }
      
      // D. Si protégé par mot de passe (Salt présent)
      if (!finalResult && salt) {
           // On ne peut pas déchiffrer ici car on n'a pas le mot de passe
           // On renvoie les métadonnées pour que le client demande le mot de passe
           return new Response(JSON.stringify({ 
               error: "Mot de passe requis", 
               require_auth: true,
               salt: salt,
               iv: tempResult?.iv,
               header: 'SIVARA_SECURE_DOC_V2'
           }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (finalResult && finalResult.encrypted_title) {
          return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
          return new Response(JSON.stringify({ error: "Accès refusé par le Kernel ou fichier corrompu" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    throw new Error("Instruction inconnue");

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})