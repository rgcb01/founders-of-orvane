import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {offlinePlugin} from './src/offlinePlugin';
export default defineConfig({plugins:[react(),offlinePlugin()],base:'./'});
