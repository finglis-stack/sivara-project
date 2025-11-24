import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Clock, ThumbsUp, ThumbsDown, Lock } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from '@/components/UserMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const HelpArticle = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (user) {
        supabase.from('profiles').select('is_staff').eq('id', user.id).single()
        .then(({ data }) => {
            if (data?.is_staff) setIsStaff(true);
        });
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      
      try {
        // 1. Récupérer l'article et sa catégorie
        const { data: articleData, error: articleError } = await supabase
          .from('help_articles')
          .select('*, help_categories(*)')
          .eq('slug', slug)
          .single();
        
        if (articleError || !articleData) {
            console.error("Article fetch error:", articleError);
            navigate('/not-found');
            return;
        }
        
        setArticle(articleData);
        setCategory(articleData.help_categories);

        // 2. Récupérer le profil de l'auteur via la fonction sécurisée (RPC)
        // Cela garantit l'accès même si l'utilisateur n'est pas connecté ou n'est pas staff
        if (articleData.author_id) {
            const { data: authorData } = await supabase
                .rpc('get_author_details', { author_id: articleData.author_id })
                .maybeSingle();
            
            if (authorData) {
                setAuthor(authorData);
            }
        }
        
        // Incrémenter vue (sans bloquer)
        supabase.rpc('increment_view_count', { article_id: articleData.id });

      } catch (err) {
        console.error("Unexpected error:", err);
        navigate('/not-found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [slug, navigate]);

  const handleLogin = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) window.location.href = '/?app=account&path=/profile';
    else window.location.href = 'https://account.sivara.ca/profile';
  };

  const getAuthorName = () => {
    if (!author) return 'Staff Sivara';
    const first = author.first_name || '';
    const last = author.last_name || '';
    const fullName = `${first} ${last}`.trim();
    return fullName || 'Staff Sivara';
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-white font-sans pb-20">
      {/* NAVBAR GLOBAL */}
      <nav className="sticky top-0 w-full z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">Sivara Help</span>
          </div>
          <div className="flex items-center gap-4">
            {isStaff && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-gray-600 hover:bg-gray-100">
                <Lock className="w-4 h-4 mr-2" /> Admin
              </Button>
            )}
            {user ? (
              <UserMenu />
            ) : (
              <Button 
                onClick={handleLogin}
                className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-6 font-medium"
              >
                Connexion
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Breadcrumb nav */}
        <div className="flex items-center text-sm text-gray-500 mb-8 gap-2 flex-wrap">
            <Button variant="link" className="p-0 h-auto text-gray-500 hover:text-indigo-600" onClick={() => navigate('/')}>Aide</Button>
            <span>/</span>
            <Button variant="link" className="p-0 h-auto text-gray-500 hover:text-indigo-600" onClick={() => navigate(`/category/${category?.slug}`)}>{category?.title}</Button>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-[200px]">{article?.title}</span>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">{article?.title}</h1>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-6 mb-8 border-y border-gray-100">
            {/* Author Section */}
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-gray-200">
                    {author?.avatar_url && <AvatarImage src={author.avatar_url} />}
                    <AvatarFallback className="bg-indigo-50 text-indigo-600 text-xs">
                        {author?.first_name?.[0] || 'S'}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold text-gray-900 leading-none mb-1">
                        {getAuthorName()}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">
                        {author?.job_title || 'Support Specialist'}
                    </p>
                </div>
            </div>

            {/* Meta Section */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{new Date(article?.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="h-4 w-px bg-gray-200"></div>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs uppercase font-bold tracking-wide">
                    {article?.language === 'en' ? 'English' : 'Français'}
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="prose prose-indigo max-w-none prose-lg text-gray-700">
            {article?.content.split('\n').map((line: string, i: number) => (
                <p key={i} className="mb-4 leading-relaxed">{line}</p>
            ))}
        </div>

        {/* Feedback */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-600 mb-4 font-medium">Cet article vous a-t-il été utile ?</p>
            <div className="flex justify-center gap-4">
                <Button variant="outline" className="gap-2 hover:text-green-600 hover:border-green-200 hover:bg-green-50 transition-all">
                    <ThumbsUp className="h-4 w-4" /> Oui
                </Button>
                <Button variant="outline" className="gap-2 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all">
                    <ThumbsDown className="h-4 w-4" /> Non
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default HelpArticle;