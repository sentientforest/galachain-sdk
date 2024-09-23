/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
// @ts-expect-error 
import dts from 'vite-plugin-dts'
import { fileURLToPath } from 'url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
// import resolve from "@rollup/plugin-node-resolve";

// https://nx.dev/recipes/vite/configure-vite
// https://vitejs.dev/config/
export default defineConfig({
  root: "chain-ui",
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // treat all tags with a dash as custom elements
          isCustomElement: (tag) => tag.includes('-')
        }
      }
    }),
    // nxViteTsPaths({debug: true}),
    dts(),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss({
        content: [
          'tailwind.config.js',
          'index.html',
          'src/components/**/*.{js,vue,ts}',
          'src/elements/**/*.{js,vue,vs}',
          'src/theme/primevue/**/*.js',
          'chain-ui/tailwind.config.js',
          'chain-ui/index.html',
          'chain-ui/src/components/**/*.{js,vue,ts}',
          'chain-ui/src/elements/**/*.{js,vue,vs}',
          'chain-ui/src/theme/primevue/**/*.js',
          // './node_modules/@gala-chain/ui/**/*.{vue,js,ts,jsx,tsx}'
        ],
      }),
      autoprefixer(),
    ]
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@gala-chain/connect': fileURLToPath(
        new URL('../chain-connect/src/index.ts', import.meta.url)
      ),
      '@gala-chain/api': fileURLToPath(new URL('../chain-api/src/index.ts', import.meta.url))
    }
  },
  build: {
    outDir: 'packages/galachain-ui-vue/dist',
    minify: true,
    lib: {
      entry: path.resolve(__dirname, 'src/vue-package.ts'),
      formats: ['es', 'umd'],
      name: '@gala-chain/ui',
      fileName: (format) => `gala-chain-ui.${format}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      },
      // plugins: [
      //   resolve({
      //     moduleDirectories: [
      //       fileURLToPath(new URL("node_modules/", import.meta.url)),
      //       fileURLToPath(new URL("../node_modules/", import.meta.url))
      //     ]
      //   })
      // ]
    }
  }
})
