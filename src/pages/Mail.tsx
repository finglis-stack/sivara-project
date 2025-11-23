import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import MailLanding from './MailLanding';
import MailInbox from './MailInbox';

const Mail = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!user) {
    return <MailLanding />;
  }

  return <MailInbox />;
};

export default Mail;