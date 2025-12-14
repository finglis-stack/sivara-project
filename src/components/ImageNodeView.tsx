import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlignLeft, AlignCenter, AlignRight, Trash2, 
  Maximize2, Minimize2, Upload,
  Wand2, RefreshCcw
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

export const ImageNodeView = (props: NodeViewProps) => {
  const { node, updateAttributes, deleteNode } = props;
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const resizeRef = useRef<{ startX: number, startWidth: number } | null>(null);

  // --- GESTION DU REDIMENSIONNEMENT ---
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!imageRef.current) return;
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: imageRef.current.clientWidth
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeRef.current || !imageRef.current) return;
    const currentX = e.clientX;
    const diffX = currentX - resizeRef.current.startX;
    const newWidth = Math.max(100, resizeRef.current.startWidth + diffX);
    
    // On met à jour le style directement pour la fluidité
    imageRef.current.style.width = `${newWidth}px`;
  }, []);

  const onMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // On sauvegarde la taille finale dans Tiptap
    if (imageRef.current) {
      updateAttributes({ width: imageRef.current.style.width });
    }
  }, [updateAttributes]);

  // --- GESTION DU REMPLACEMENT D'IMAGE ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non connecté");

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        // Upload vers Supabase
        const { error: uploadError } = await supabase.storage
            .from('doc-assets')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('doc-assets').getPublicUrl(fileName);
        
        // Mise à jour de la source
        updateAttributes({ src: publicUrl });
        showSuccess("Image remplacée");
    } catch (err: any) {
        console.error(err);
        showError("Erreur upload");
    } finally {
        setIsUploading(false);
    }
  };

  // --- STYLES DYNAMIQUES ---
  const wrapperStyle = {
    textAlign: node.attrs.textAlign || 'center',
    position: 'relative' as const,
    marginTop: '1rem',
    marginBottom: '1rem',
    // Important pour le drag & drop Tiptap
    userSelect: 'none' as const,
  };

  const imgStyle = {
    width: node.attrs.width || '100%',
    maxWidth: '100%',
    borderRadius: '0.5rem',
    transition: isResizing ? 'none' : 'all 0.2s ease',
    filter: node.attrs.style?.includes('filter:') ? node.attrs.style.split('filter:')[1].split(';')[0] : 'none',
    boxShadow: props.selected ? '0 0 0 3px #3b82f6' : 'none',
    cursor: 'default'
  };

  return (
    <NodeViewWrapper style={wrapperStyle} className="group image-node-view">
      <div 
        className="relative inline-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* L'IMAGE */}
        <img 
          ref={imageRef}
          src={node.attrs.src} 
          alt={node.attrs.alt}
          style={imgStyle}
          className="block"
          draggable="false" // EMPÊCHE LA DUPLICATION NATIVE
          onClick={() => props.updateAttributes({})} // Force selection logic
        />

        {/* OVERLAY DE CHARGEMENT */}
        {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
        )}

        {/* BARRE D'OUTILS FLOTTANTE (Visible si sélectionné ou hover) */}
        {(props.selected || isHovered) && !isResizing && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-lg p-1 flex items-center gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            
            {/* Alignement */}
            <div className="flex bg-gray-100 rounded p-0.5">
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${node.attrs.textAlign === 'left' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateAttributes({ textAlign: 'left' })}><AlignLeft className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${node.attrs.textAlign === 'center' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateAttributes({ textAlign: 'center' })}><AlignCenter className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${node.attrs.textAlign === 'right' ? 'bg-white shadow-sm' : ''}`} onClick={() => updateAttributes({ textAlign: 'right' })}><AlignRight className="h-3.5 w-3.5" /></Button>
            </div>
            
            <div className="w-px h-4 bg-gray-200 mx-1"></div>

            {/* Taille Rapide */}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateAttributes({ width: '50%' })} title="50%"><Minimize2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateAttributes({ width: '100%' })} title="100%"><Maximize2 className="h-3.5 w-3.5" /></Button>

            <div className="w-px h-4 bg-gray-200 mx-1"></div>

            {/* Filtres & Actions */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Wand2 className="h-3.5 w-3.5 text-purple-600" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => updateAttributes({ style: '' })}>Normal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAttributes({ style: 'filter: grayscale(100%);' })}>Noir & Blanc</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAttributes({ style: 'filter: sepia(100%);' })}>Sépia</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAttributes({ style: 'filter: blur(2px);' })}>Flou</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAttributes({ style: 'filter: contrast(150%);' })}>Contraste +</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => updateAttributes({ style: 'filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04)) drop-shadow(0 4px 3px rgb(0 0 0 / 0.1));' })}>Ombre portée</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="Remplacer"><RefreshCcw className="h-3.5 w-3.5" /></Button>
            
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={deleteNode}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )}

        {/* POIGNÉE DE REDIMENSIONNEMENT (Coin bas droit) */}
        {(props.selected || isHovered) && (
            <div 
                className="absolute bottom-2 right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md z-40 hover:scale-125 transition-transform"
                onMouseDown={onMouseDown}
            />
        )}

        {/* Input caché pour le remplacement */}
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
        />
      </div>
    </NodeViewWrapper>
  );
};