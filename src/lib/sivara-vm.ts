import { supabase } from '@/integrations/supabase/client';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const sivaraVM = {
  /**
   * Compile un document chiffré en format binaire propriétaire SBP (.sivara)
   * via le Kernel distant.
   */
  async compile(payload: any): Promise<Blob> {
    const { data, error } = await supabase.functions.invoke('sivara-kernel', {
      body: { action: 'compile', payload }
    });

    if (error) {
        throw new Error(error.message || "Erreur de compilation SIVARA");
    }
    
    if (!data.file) {
        throw new Error("Réponse kernel invalide");
    }

    // Conversion Base64 -> Blob Binaire
    const binaryString = atob(data.file);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'application/x-sivara-binary' });
  },

  /**
   * Décompile un fichier .sivara binaire en objet JS chiffré
   * via le Kernel distant.
   * @param file Le fichier .sivara
   * @param userId (Optionnel) L'ID de l'utilisateur courant pour tenter de déverrouiller les archives privées
   */
  async decompile(file: File, userId?: string): Promise<any> {
    // Capture de l'empreinte locale pour preuve de propriété
    let fingerprint = null;
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        fingerprint = result.visitorId;
    } catch (e) {
        console.warn("Impossible de générer le fingerprint", e);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file); // On lit en base64 pour l'envoi
        reader.onload = async () => {
            try {
                const base64Content = (reader.result as string).split(',')[1];
                
                const { data, error } = await supabase.functions.invoke('sivara-kernel', {
                    body: { 
                        action: 'decompile', 
                        fileData: base64Content,
                        context: { 
                            fingerprint,
                            userId // On passe l'ID pour le déverrouillage privé
                        } 
                    }
                });

                if (error) {
                    // On essaie d'extraire le message JSON si possible
                    try {
                        const errBody = JSON.parse(error.message);
                        throw new Error(errBody.error || "Fichier corrompu");
                    } catch {
                        throw new Error(error.message || "Fichier corrompu ou format invalide");
                    }
                }
                
                if (data.error) {
                    // Si le kernel demande une auth spécifique (mot de passe manuel)
                    if (data.require_auth) {
                        resolve(data); // On renvoie l'erreur structurée pour que l'UI gère le prompt
                        return;
                    }
                    throw new Error(data.error);
                }

                resolve(data);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
    });
  }
};