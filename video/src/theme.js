// The site's own tokens (DESIGN.md), so the video and the app look like one thing.
export const C = {
  ink: '#141412', ink2: '#4b4a45', ink3: '#6b6962', paper: '#f6f4ef', card: '#ffffff',
  red: '#e23b2e', redInk: '#c62d22', green: '#2f9e57', blue: '#1e6bff',
};
export const FONT = {
  display: "'Instrument Serif', 'Times New Roman', serif",
  body: "'Zen Kaku', 'Hiragino Sans', system-ui, sans-serif",
  jp: "'Zen Old Mincho', serif",
};
export const FPS = 60;
export const W = 1080, H = 1920;
// where the phone screen sits on the canvas
export const PHONE = { w: 660, top: 312, radius: 58 };
export const fontCss = (url) => `
@font-face { font-family:'Zen Kaku'; font-weight:400; src:url(${url('fonts/zen-kaku-gothic-new-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family:'Zen Kaku'; font-weight:500; src:url(${url('fonts/zen-kaku-gothic-new-latin-500-normal.woff2')}) format('woff2'); }
@font-face { font-family:'Zen Kaku'; font-weight:700; src:url(${url('fonts/zen-kaku-gothic-new-latin-700-normal.woff2')}) format('woff2'); }
@font-face { font-family:'Instrument Serif'; font-weight:400; src:url(${url('fonts/instrument-serif-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family:'Instrument Serif'; font-style:italic; font-weight:400; src:url(${url('fonts/instrument-serif-latin-400-italic.woff2')}) format('woff2'); }
@font-face { font-family:'Zen Old Mincho'; font-weight:700; src:url(${url('fonts/zen-old-mincho-700-subset.woff2')}) format('woff2'); }`;
