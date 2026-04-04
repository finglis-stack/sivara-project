import { defineConfig, type Plugin } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Plugin Vite custom qui applique javascript-obfuscator
 * UNIQUEMENT sur le module sivara-vm en production.
 * Rend le code machine complètement illisible dans le bundle final.
 */
function sivaraObfuscator(): Plugin {
  let isProd = false;
  return {
    name: 'sivara-obfuscator',
    enforce: 'post' as const,
    configResolved(config) {
      isProd = config.command === 'build';
    },
    async renderChunk(code, chunk) {
      if (!isProd) return null;
      if (!chunk.fileName.includes('sivara-core')) return null;

      const JavaScriptObfuscator = (await import('javascript-obfuscator')).default;
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: 4000,
        identifierNamesGenerator: 'hexadecimal',
        numbersToExpressions: true,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 3,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['rc4'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 3,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        stringArrayThreshold: 1,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        target: 'browser',
      });

      return { code: result.getObfuscatedCode(), map: null };
    }
  };
}

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react(), sivaraObfuscator()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'sivara-core': ['./src/lib/sivara-vm.ts'],
        }
      }
    }
  },
}));
