import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages에 배포할 경우 base를 '/<리포지토리이름>/' 으로 설정해야 합니다.
// Firebase Hosting을 쓸 경우 base: '/' 로 두면 됩니다.
export default defineConfig({
  plugins: [react()],
  base: process.env.GHPAGES_BASE || '/',
});
