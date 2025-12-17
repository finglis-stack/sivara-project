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
  VM_BYTECODE: 0xE5, // Le bloc contenant le code exécutable
  EOF: 0xFF
};

// --- SIVARA SCRIPT VM INSTRUCTIONS (ISA) ---
const VM_OP = {
  HALT: 0x00,
  PUSH: 0x01, // PUSH <val>
  POP: 0x02,
  ADD: 0x10,
  SUB: 0x11,
  MUL: 0x12,
  DIV: 0x13,
  EQ: 0x20,  // ==
  LT: 0x21,  // <
  GT: 0x22,  // >
  AND: 0x23, // ET
  OR: 0x24,  // OU
  JMP: 0x30, // Jump
  JMP_IF: 0x31, // Jump if True
  STORE: 0x40, // Store variable
  LOAD: 0x41,  // Load variable
  ENV_GET: 0x50, // Get Env Variable (geo, time...)
  ASSERT: 0x99   // CRITICAL: Fail if false
};

// --- COMPILATEUR SIVARASCRIPT (FR -> BYTECODE) ---
class SivaraCompiler {
  private tokens: string[];
  private position: number = 0;
  private bytecode: number[] = [];
  private labels: Record<string, number> = {};
  private jumps: { pos: number, label: string }[] = [];

  constructor(source: string) {
    // Tokenizer basique
    this.tokens = source
      .replace(/\(/g, ' ( ')
      .replace(/\)/g, ' ) ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  compile(): Uint8Array {
    while (this.position < this.tokens.length) {
      const token = this.tokens[this.position++];
      
      if (token === 'soit') { // Variable declaration
        const varName = this.tokens[this.position++];
        if (this.tokens[this.position++] !== '=') throw new Error("Syntaxe invalide: attendu '='");
        this.compileExpression();
        this.emit(VM_OP.STORE, this.hashVar(varName));
      } 
      else if (token === 'exiger') { // ASSERT
        this.compileExpression();
        this.emit(VM_OP.ASSERT);
      }
      else if (token === 'si') { // IF
        this.compileExpression();
        if (this.tokens[this.position++] !== 'alors') throw new Error("Syntaxe invalide: attendu 'alors'");
        // ... (Simplification pour l'exemple: supporte expressions simples)
      }
      // ... (Autres instructions)
    }
    return new Uint8Array(this.bytecode);
  }

  private compileExpression() {
    const token = this.tokens[this.position++];
    if (!isNaN(Number(token))) {
      this.emit(VM_OP.PUSH, Number(token));
    } else if (token.startsWith('env.')) {
      // Mapping env vars
      let envId = 0;
      if (token === 'env.geo.lat') envId = 1;
      if (token === 'env.geo.lng') envId = 2;
      this.emit(VM_OP.ENV_GET, envId);
    } else {
      // Variable load
      this.emit(VM_OP.LOAD, this.hashVar(token));
    }
    
    // Opérateurs simples (postfix pour simplifier ici, mais le vrai serait infix)
    if (this.position < this.tokens.length) {
        const next = this.tokens[this.position];
        if (['+', '-', '<', '>', '=='].includes(next)) {
            this.position++;
            this.compileExpression(); // Recursive right side
            if (next === '+') this.emit(VM_OP.ADD);
            if (next === '-') this.emit(VM_OP.SUB);
            if (next === '<') this.emit(VM_OP.LT);
            if (next === '>') this.emit(VM_OP.GT);
            if (next === '==') this.emit(VM_OP.EQ);
        }
    }
  }

  private emit(op: number, arg?: number) {
    this.bytecode.push(op);
    if (arg !== undefined) {
       // Simple encoding for numbers (can be improved)
       this.bytecode.push((arg >> 24) & 0xFF);
       this.bytecode.push((arg >> 16) & 0xFF);
       this.bytecode.push((arg >> 8) & 0xFF);
       this.bytecode.push(arg & 0xFF);
    }
  }

  private hashVar(name: string): number {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0;
    return h;
  }
}

// --- MACHINE VIRTUELLE (INTERPRÉTEUR) ---
class SivaraVM {
  private stack: number[] = [];
  private memory: Record<number, number> = {};
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  execute(bytecode: Uint8Array): boolean {
    let ip = 0; // Instruction Pointer
    const view = new DataView(bytecode.buffer);

    while (ip < bytecode.length) {
      const op = bytecode[ip++];

      switch (op) {
        case VM_OP.PUSH:
          const val = view.getInt32(ip); ip += 4;
          this.stack.push(val);
          break;
        
        case VM_OP.ENV_GET:
          const envId = view.getInt32(ip); ip += 4;
          if (envId === 1) this.stack.push(this.env.lat || 0);
          else if (envId === 2) this.stack.push(this.env.lng || 0);
          else this.stack.push(0);
          break;

        case VM_OP.LOAD:
          const addr = view.getInt32(ip); ip += 4;
          this.stack.push(this.memory[addr] || 0);
          break;

        case VM_OP.STORE:
          const storeAddr = view.getInt32(ip); ip += 4;
          const storeVal = this.stack.pop();
          if (storeVal !== undefined) this.memory[storeAddr] = storeVal;
          break;

        case VM_OP.ADD:
          const b = this.stack.pop()!; const a = this.stack.pop()!;
          this.stack.push(a + b);
          break;
        
        case VM_OP.LT:
          const b2 = this.stack.pop()!; const a2 = this.stack.pop()!;
          this.stack.push(a2 < b2 ? 1 : 0);
          break;

        case VM_OP.ASSERT:
          const check = this.stack.pop();
          if (check !== 1) {
             console.error("VM ASSERT FAILED");
             return false; // Security Panic
          }
          break;
          
        case VM_OP.HALT:
          return true;
      }
    }
    return true;
  }
}

// --- UTILS ---
const bufToStr = (buf: Uint8Array) => new TextDecoder().decode(buf);

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload, fileData, context } = await req.json();

    // --- LOCALISATION ---
    if (action === 'locate_me') {
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

    // --- COMPILATION (Export Manuel avec SivaraScript) ---
    if (action === 'compile') {
       // Ici on générerait le bytecode à partir du script de sécurité
       // Pour l'instant on mock un bytecode vide si pas de script
       return new Response(JSON.stringify({ error: "Non implémenté dans cette mise à jour" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- DÉCOMPILATION (Import / Lecture Cold Storage) ---
    if (action === 'decompile') {
      const binaryString = atob(fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
      
      const view = new DataView(bytes.buffer);
      
      if (bytes[0] !== 0x53 || bytes[1] !== 0x56 || bytes[2] !== 0x52) throw new Error("Format SBP invalide.");
      
      const attemptDecompile = (seed: string) => {
          let cursor = 4; // Skip Magic
          const result: any = { header: 'SIVARA_SECURE_DOC_V2' };
          let metaData: any = {};
          let success = true;

          // Environnement VM (Mocké pour l'instant, à connecter avec IP_GEO)
          const vmEnv = { lat: 455017, lng: -735673 }; 
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
                
                // EXÉCUTION DU SMART CONTRACT AVANT DÉCHIFFREMENT
                const vmResult = vm.execute(bytecode);
                if (!vmResult) {
                    throw new Error("Sivara Kernel Panic: Security Assertion Failed");
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
              const clearChunk = sivaraUnshuffle(chunk, seed);
              try {
                 const jsonStr = bufToStr(clearChunk);
                 metaData = JSON.parse(jsonStr);
                 Object.assign(result, metaData);
              } catch(e) {
                 success = false;
                 break; 
              }
              cursor += len;
            }
            else if (opcode === SBP_OP.DATA_CHUNK) {
              const len = view.getUint32(cursor);
              cursor += 4;
              const chunk = bytes.slice(cursor, cursor + len);
              const clearChunk = sivaraUnshuffle(chunk, seed);
              
              let separatorIndex = -1;
              for(let i=0; i<clearChunk.length; i++) { if (clearChunk[i] === 0x00) { separatorIndex = i; break; } }
              
              if (separatorIndex !== -1) {
                  result.encrypted_title = bufToStr(clearChunk.slice(0, separatorIndex));
                  result.encrypted_content = bufToStr(clearChunk.slice(separatorIndex + 1));
              }
              cursor += len;
            }
          }
          return success ? result : null;
      };

      // TENTATIVE 1 : PUBLIC
      let finalResult = attemptDecompile(PUBLIC_CONTAINER_SEED);

      // TENTATIVE 2 : PRIVÉ
      if (!finalResult && context?.userId) {
           console.log(`[Kernel] Tentative déverrouillage privé pour ${context.userId}`);
           finalResult = attemptDecompile(context.userId);
      }

      if (finalResult) {
          return new Response(JSON.stringify(finalResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
          return new Response(JSON.stringify({ error: "Fichier protégé ou clé invalide", require_auth: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    throw new Error("Instruction inconnue");

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})