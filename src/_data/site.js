// Site-wide data for 11ty templates and server-rendered Functions pages.
// A JS module rather than JSON: Cloudflare Pages bundles Functions with an esbuild that rejects JSON import attributes.
export default {
  name: 'zoteamo',
  tagline: 'A shared reading list for your reading group',
  description:
    'Paste a link, DOI or ISBN and get a proper APA, MLA or Chicago citation. Share one link to edit and another to read. No accounts.',
  source: 'https://github.com/tfscharff/zoteamo',
};
