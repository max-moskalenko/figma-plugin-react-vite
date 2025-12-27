import path from "node:path";
import { defineConfig } from "vite";
import generateFile from "vite-plugin-generate-file";
import { viteSingleFile } from "vite-plugin-singlefile";
import figmaManifest from "./figma.manifest";

// #region agent log
const resolvedOutDir = path.resolve("dist");
const resolvedInput = path.resolve('src/plugin/plugin.ts');
const cwd = process.cwd();
fetch('http://127.0.0.1:7243/ingest/91b73fdf-8b70-4673-a95e-404f0c41272f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.config.plugin.ts:7',message:'Path resolution - outDir',data:{resolvedOutDir,resolvedInput,cwd},timestamp:Date.now(),sessionId:'debug-session',runId:'build-check',hypothesisId:'A'})}).catch(()=>{});
// #endregion

export default defineConfig(({ mode }) => ({
  plugins: [
    viteSingleFile(),
    generateFile({
      type: "json",
      output: "./manifest.json",
      data: figmaManifest,
    }),
    // #region agent log
    {
      name: 'debug-manifest-path',
      generateBundle() {
        const manifestPath = path.resolve(resolvedOutDir, "manifest.json");
        fetch('http://127.0.0.1:7243/ingest/91b73fdf-8b70-4673-a95e-404f0c41272f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vite.config.plugin.ts:14',message:'Manifest output path',data:{manifestPath,outDir:resolvedOutDir},timestamp:Date.now(),sessionId:'debug-session',runId:'build-check',hypothesisId:'B'})}).catch(()=>{});
      }
    },
    // #endregion
  ],
  build: {
    minify: mode === 'production',
    sourcemap: mode !== 'production' ? 'inline' : false,
    target: 'es2017',
    emptyOutDir: false,
    outDir: path.resolve("dist"),
    rollupOptions: {
      input: path.resolve('src/plugin/plugin.ts'),
      output: {
        entryFileNames: 'plugin.js',
      },
    },
  },
  resolve: {
    alias: {
      "@common": path.resolve("src/common"),
      "@plugin": path.resolve("src/plugin"),
    },
  },
}));
