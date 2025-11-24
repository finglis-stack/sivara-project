import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, FileText, Calendar } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const HelpCategory = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      
      try {
        // 1. Récupérer la catégorie
        const { data: catData, error: catError } = await supabase
          .from('help_categories')
          .select('*')
          .eq('slug', slug)
          .single();
        
        if (catError || !catData) {
            navigate('/not-found');
            return;
        }
        setCategory(catData);

        // 2. Récupérer les articles
        const { data: artData } = await supabase
          .from('help_articles')
          .select('*')
          .eq('category_id', catData.id)
          .eq('is_published', true)
          .order('order', { ascending: true });
          
        setArticles(artData || []);
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
    <div className="min-h-screen bg-white font-sans">
      {/* Header minimaliste */}
      <div className="bg-gray-50 border-b border-gray-100 py-10">
        <div className="container mx-auto px-6">
            <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 pl-0 hover:bg-transparent hover:text-indigo-600">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l'accueil
            </Button>
            <div className="max-w-3xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{category?.title}</h1>
                <p className="text-gray-500 text-lg">{category?.description}</p>
            </div>
        </div>
      </div>

      {/* Liste des articles */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-3xl">
            {articles.length > 0 ? (
                <div className="grid gap-4">
                    {articles.map((article) => (
                        <Card key={article.id} className="p-5 hover:shadow-md transition-all cursor-pointer border-gray-100 hover:border-indigo-100 group" onClick={() => navigate(`/article/${article.slug}`)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">{article.title}</h3>
                                        <p className="text-sm text-gray-500 line-clamp-1">{article.content.substring(0, 100).replace(/[#*]/g, '')}...</p>
                                    </div>
                                </div>
                                <span className="text-xl mr-2">{article.language === 'en' ? '🇺🇸' : '🇫🇷'}</span>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
                    <p className="text-gray-500">Aucun article disponible dans cette catégorie.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default HelpCategory;