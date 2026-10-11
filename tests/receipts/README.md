Receipt photos with known answers, for checking `/api/scan` (Workers AI, Llama 4 Scout) after changing its prompt.
Six are made-up but realistic (konbini, ramen, Don Quijote, taxi, a handwritten-style 領収書, a supermarket), photographed-looking
(tilt, shadow, blur, noise); `real_hama.png` is a real Hama Sushi receipt; `photo_taxfree.png` is a 免税 receipt.
Last result (Oct 2026): every total right, three runs in a row. Watch for: お預り (cash given) read as the total (the server
checks total = cash given − change), and short years (26年 → 2026). A longer prompt once made it worse, so re-run this after any change.
