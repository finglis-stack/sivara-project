import { supabase } from '@/integrations/supabase/client';

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
   */
  async decompile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file); // On lit en base64 pour l'envoi
        reader.onload = async () => {
            try {
                const base64Content = (reader.result as string).split(',')[1];
                
                const { data, error } = await supabase.functions.invoke('sivara-kernel', {
                    body: { action: 'decompile', fileData: base64Content }
                });

                if (error) {
                    console.error("Kernel Error:", error);
                    // On essaie d'extraire le message JSON si possible
                    try {
                        const errBody = JSON.parse(error.message);
                        throw new Error(errBody.error || "Fichier corrompu");
                    } catch {
                        throw new Error(error.message || "Fichier corrompu ou format invalide");
                    }
                }
                
                if (data.error) {
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