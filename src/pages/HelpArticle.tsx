import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const HelpArticle = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      
      try {
        const { data, error } = await supabase
          .from('help_articles')
          .select('*, help_categories(*)')
          .eq('slug', slug)
          .single();
        
        if (error || !data) {
            navigate('/not-found');
            return;
        }
        
        setArticle(data);
        setCategory(data.help_categories);
        
        // Incrémenter vue
        await supabase.rpc('increment_view_count', { article_id: data.id });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [slug, navigate]);

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-white font-sans pb-20">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Breadcrumb nav */}
        <div className="flex items-center text-sm text-gray-500 mb-8 gap-2">
            <Button variant="link" className="p-0 h-auto text-gray-500 hover:text-indigo-600" onClick={() => navigate('/')}>Aide</Button>
            <span>/</span>
            <Button variant="link" className="p-0 h-auto text-gray-500 hover:text-indigo-600" onClick={() => navigate(`/category/${category?.slug}`)}>{category?.title}</Button>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-[200px]">{article?.title}</span>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-6">{article?.title}</h1>
        
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Mis à jour le {new Date(article?.updated_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs uppercase font-bold tracking-wide">
                {article?.language === 'en' ? 'English' : 'Français'}
            </div>
        </div>

        {/* Content */}
        <div className="prose prose-indigo max-w-none prose-lg">
            {/* Rendu simple du contenu (saut de lignes) */}
            {article?.content.split('\n').map((line: string, i: number) => (
                <p key={i} className="mb-4">{line}</p>
            ))}
        </div>

        {/* Feedback (Visuel uniquement pour l'instant) */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-600 mb-4 font-medium">Cet article vous a-t-il été utile ?</p>
            <div className="flex justify-center gap-4">
                <Button variant="outline" className="gap-2 hover:text-green-600 hover:border-green-200 hover:bg-green-50">
                    <ThumbsUp className="h-4 w-4" /> Oui
                </Button>
                <Button variant="outline" className="gap-2 hover:text-red-600 hover:border-red-200 hover:bg-red-50">
                    <ThumbsDown className="h-4 w-4" /> Non
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default HelpArticle;