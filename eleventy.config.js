const FONT_DIR = 'node_modules/@fontsource/atkinson-hyperlegible-next/files';
const FONTS = ['latin-400-normal', 'latin-700-normal'].map((v) => `atkinson-hyperlegible-next-${v}.woff2`);

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy('src/_headers');
  eleventyConfig.addPassthroughCopy('src/_routes.json');
  eleventyConfig.addPassthroughCopy('src/robots.txt');
  for (const font of FONTS) {
    eleventyConfig.addPassthroughCopy({ [`${FONT_DIR}/${font}`]: `assets/fonts/${font}` });
  }
  return { dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' } };
}
