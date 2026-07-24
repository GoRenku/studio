// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://gorenku.com',
  server: {
    port: 4321,
  },
  image: {
    // Screenshots are captured at 2x (2880px wide); allow high-quality derivatives.
    responsiveStyles: true,
  },
});
