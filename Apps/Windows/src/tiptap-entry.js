/**
 * TipTap Editor Entry Point for Electron
 * Bundled by esbuild into dist/tiptap-bundle.js
 * Includes AdvancedImage extension matching docs.sivara.ca
 */
import { Editor, Extension, Node, mergeAttributes } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// FontSize custom extension
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize?.replace('px', ''),
          renderHTML: (attributes) => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}px` };
          },
        },
      },
    }];
  },
});

// AdvancedImage — same as DocEditor.tsx with width, alignment, style preserved
const AdvancedImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      width: {
        default: '100%',
        parseHTML: (el) => el.style.width || el.getAttribute('width'),
      },
      style: {
        default: '',
        parseHTML: (el) => el.getAttribute('style'),
      },
      textAlign: {
        default: 'center',
        parseHTML: (el) => el.style.textAlign || el.getAttribute('data-align'),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { style, width, textAlign, ...rest } = HTMLAttributes;
    const styles = [
      style,
      width ? `width: ${width}` : '',
      textAlign ? `text-align: ${textAlign}` : '',
      'display: block',
      textAlign === 'center' ? 'margin-left: auto; margin-right: auto;' : '',
      textAlign === 'right' ? 'margin-left: auto; margin-right: 0;' : '',
      textAlign === 'left' ? 'margin-right: auto; margin-left: 0;' : '',
    ].filter(Boolean).join('; ');

    return ['img', mergeAttributes(this.options.HTMLAttributes, rest, {
      style: styles,
      'data-align': textAlign,
    })];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node;

      // Helper: update attributes via ProseMirror transaction
      const updateAttrs = (newAttrs) => {
        const pos = getPos();
        if (pos === undefined) return;
        const mergedAttrs = { ...currentNode.attrs, ...newAttrs };
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, mergedAttrs)
        );
      };

      // Helper: apply alignment CSS to wrapper + img
      const applyAlignment = (align) => {
        wrapper.style.textAlign = align || 'center';
        // Update margin on img for alignment
        if (align === 'center') {
          img.style.marginLeft = 'auto';
          img.style.marginRight = 'auto';
        } else if (align === 'right') {
          img.style.marginLeft = 'auto';
          img.style.marginRight = '0';
        } else {
          img.style.marginLeft = '0';
          img.style.marginRight = 'auto';
        }
      };

      // Helper: apply filter from style attr
      const applyFilter = (styleStr) => {
        if (styleStr && styleStr.includes('filter:')) {
          const m = styleStr.match(/filter:\s*([^;]+)/);
          img.style.filter = m ? m[1].trim() : 'none';
        } else {
          img.style.filter = 'none';
        }
      };

      // Helper: update alignment active states
      const updateAlignBtns = (align) => {
        toolbar.querySelectorAll('[data-align]').forEach(b => {
          if (b.dataset.align === align) {
            b.style.background = 'white';
            b.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
          } else {
            b.style.background = 'transparent';
            b.style.boxShadow = 'none';
          }
        });
      };

      // === DOM ===

      // Outer wrapper with padding for toolbar hover zone
      const wrapper = document.createElement('div');
      wrapper.className = 'image-node-view';
      wrapper.style.position = 'relative';
      wrapper.style.margin = '1rem 0';
      wrapper.style.paddingTop = '48px';
      wrapper.contentEditable = 'false';

      // Container (inline-block for alignment)
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.display = 'inline-block';

      // Image
      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      img.style.width = node.attrs.width || '100%';
      img.style.maxWidth = '100%';
      img.style.borderRadius = '0.5rem';
      img.style.transition = 'box-shadow 0.2s ease, filter 0.3s ease';
      img.style.display = 'block';
      img.draggable = false;
      applyFilter(node.attrs.style);
      container.appendChild(img);

      // Apply initial alignment
      applyAlignment(node.attrs.textAlign);

      // === TOOLBAR (exact copy of web) ===
      const toolbar = document.createElement('div');
      toolbar.className = 'img-toolbar';
      toolbar.contentEditable = 'false';
      toolbar.style.opacity = '0';
      toolbar.style.pointerEvents = 'none';
      toolbar.innerHTML = `
        <div class="img-toolbar-inner">
          <!-- Alignment group -->
          <div class="img-toolbar-group">
            <button class="img-tb-btn" data-align="left" title="Gauche">
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M1 5h8M1 8h12M1 11h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
            <button class="img-tb-btn" data-align="center" title="Centre">
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M3 5h8M1 8h12M3 11h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
            <button class="img-tb-btn" data-align="right" title="Droite">
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M1 8h12M5 11h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="img-tb-sep"></div>
          <!-- Size -->
          <button class="img-tb-btn" data-size="50%" title="50%">½</button>
          <button class="img-tb-btn" data-size="100%" title="100%">⬜</button>
          <div class="img-tb-sep"></div>
          <!-- Filter toggle -->
          <button class="img-tb-btn img-tb-filter" title="Filtres" style="color: #7c3aed;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 4V2M15 16v-2M8 9H2M22 9h-4M3 18l2-2M19 4l2 2M12 12l3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <div class="img-tb-sep"></div>
          <!-- Delete -->
          <button class="img-tb-btn img-tb-delete" data-action="delete" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
          </button>
        </div>
      `;
      container.appendChild(toolbar);

      // Update active alignment button on init
      setTimeout(() => updateAlignBtns(node.attrs.textAlign || 'center'), 0);

      // === FILTER DROPDOWN ===
      const filterMenu = document.createElement('div');
      filterMenu.className = 'img-filter-menu';
      filterMenu.style.display = 'none';
      filterMenu.innerHTML = `
        <button data-filter="">Normal</button>
        <button data-filter="filter: grayscale(100%);">Noir & Blanc</button>
        <button data-filter="filter: sepia(100%);">Sépia</button>
        <button data-filter="filter: blur(2px);">Flou</button>
        <button data-filter="filter: contrast(150%);">Contraste +</button>
        <hr>
        <button data-filter="filter: drop-shadow(0 10px 8px rgb(0 0 0 / 0.04)) drop-shadow(0 4px 3px rgb(0 0 0 / 0.1));">Ombre portée</button>
      `;
      container.appendChild(filterMenu);

      // Filter menu toggle
      toolbar.querySelector('.img-tb-filter').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        filterMenu.style.display = filterMenu.style.display === 'none' ? 'block' : 'none';
      });

      // Filter menu actions
      filterMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const filterVal = btn.dataset.filter;
        updateAttrs({ style: filterVal });
        applyFilter(filterVal);
        filterMenu.style.display = 'none';
      });

      // Close filter menu on outside click
      document.addEventListener('click', () => { filterMenu.style.display = 'none'; });

      // === RESIZE HANDLE ===
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'img-resize-handle';
      resizeHandle.style.opacity = '0';
      resizeHandle.style.pointerEvents = 'none';
      container.appendChild(resizeHandle);

      // === HOVER BEHAVIOR ===
      wrapper.addEventListener('mouseenter', () => {
        toolbar.style.opacity = '1';
        toolbar.style.pointerEvents = 'auto';
        resizeHandle.style.opacity = '1';
        resizeHandle.style.pointerEvents = 'auto';
        img.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
      });
      wrapper.addEventListener('mouseleave', () => {
        toolbar.style.opacity = '0';
        toolbar.style.pointerEvents = 'none';
        resizeHandle.style.opacity = '0';
        resizeHandle.style.pointerEvents = 'none';
        img.style.boxShadow = 'none';
        filterMenu.style.display = 'none';
      });

      // === TOOLBAR CLICK HANDLERS ===
      toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('img-tb-filter')) return; // handled separately
        e.preventDefault();
        e.stopPropagation();

        if (btn.dataset.align) {
          updateAttrs({ textAlign: btn.dataset.align });
          applyAlignment(btn.dataset.align);
          updateAlignBtns(btn.dataset.align);
        }

        if (btn.dataset.size) {
          updateAttrs({ width: btn.dataset.size });
          img.style.width = btn.dataset.size;
        }

        if (btn.dataset.action === 'delete') {
          const pos = getPos();
          if (pos !== undefined) {
            editor.chain().focus().deleteRange({ from: pos, to: pos + currentNode.nodeSize }).run();
          }
        }
      });

      // === RESIZE DRAG ===
      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = img.clientWidth;
        img.style.transition = 'none';

        const onMove = (ev) => {
          const newW = Math.max(80, startW + (ev.clientX - startX));
          img.style.width = `${newW}px`;
        };
        const onUp = () => {
          img.style.transition = 'box-shadow 0.2s ease, filter 0.3s ease';
          updateAttrs({ width: img.style.width });
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      wrapper.appendChild(container);

      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false;
          currentNode = updatedNode;
          img.src = updatedNode.attrs.src;
          img.style.width = updatedNode.attrs.width || '100%';
          applyAlignment(updatedNode.attrs.textAlign);
          applyFilter(updatedNode.attrs.style);
          updateAlignBtns(updatedNode.attrs.textAlign || 'center');
          return true;
        },
        destroy: () => {},
        stopEvent: (event) => {
          return !!(event.target.closest('.img-toolbar') || event.target.closest('.img-resize-handle') || event.target.closest('.img-filter-menu'));
        },
      };
    };
  },
});

// Export globally
window.TipTapEditor = Editor;
window.TipTapExtensions = {
  StarterKit,
  Underline,
  TextAlign,
  TextStyle,
  FontFamily,
  FontSize,
  AdvancedImage,
  Placeholder,
};

window.FONT_FAMILIES = [
  { name: 'Inter (Sans)', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Serif', value: 'serif' },
  { name: 'Playfair Display', value: '"Playfair Display", serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Courier Prime', value: '"Courier Prime", monospace' },
];

window.FONT_SIZES = ['12', '14', '16', '18', '20', '24', '30', '36', '48', '60', '72'];
