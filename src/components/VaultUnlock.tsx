import { useState } from 'react';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Loader2, Lock } from 'lucide-react';

interface VaultUnlockProps {
  open: boolean;
  userId: string;
  onUnlocked: () => void;
}

/**
 * Modal de déverrouillage du coffre-fort.
 * Affiché quand l'utilisateur est authentifié (cookie SSO)
 * mais que la DEK n'est pas en sessionStorage (cross-subdomain).
 */
const VaultUnlock = ({ open, userId, onUnlocked }: VaultUnlockProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');
    try {
      await encryptionService.initializeWithPassword(password, userId);
      onUnlocked();
    } catch (err: any) {
      setError(err.message || 'Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-gray-900" />
          </div>
          <DialogTitle className="text-center">Déverrouiller vos documents</DialogTitle>
          <DialogDescription className="text-center">
            Entrez votre mot de passe pour accéder à vos documents chiffrés.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUnlock} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="vault-password">Mot de passe</Label>
            <Input
              id="vault-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="h-11"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-xs text-red-500 font-medium">{error}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-gray-900 hover:bg-black text-white"
            disabled={loading || !password}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Déverrouiller
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VaultUnlock;
