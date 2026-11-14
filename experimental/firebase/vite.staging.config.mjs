import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({base:'./',publicDir:false,envDir:false,build:{outDir:'dist-staging',emptyOutDir:true,sourcemap:false,target:['chrome111','edge111','safari16.4'],rollupOptions:{input:resolve(import.meta.dirname,'staging.html')}}});
