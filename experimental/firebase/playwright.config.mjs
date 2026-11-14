import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'browser.spec.mjs',workers:1,retries:0,timeout:45000,use:{baseURL:'http://127.0.0.1:5173',browserName:'chromium',headless:true},webServer:{command:'npm run serve -- --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:false,timeout:60000}});
