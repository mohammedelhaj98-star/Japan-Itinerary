// Feature video, scene 4: photos filed by day and stop, then Relive. Paced to Mo's voiceover lines.
import base, { uploads } from './ch21.mjs';
export default {
  ...base, name: 'f4-photos', meta: null,
  async script({ tap, hold, wait, pg, mark }) {
    mark('photo-1'); await hold(2.4, "Everyone's photos, in one place.");
    mark('photo-2');
    await tap('#fab', { step: 1, caption: 'Upload', lead: 0.5, after: 0.5, opens: true });
    pg.once('filechooser', (fc) => fc.setFiles(uploads().map((f) => f.out)).catch(() => {}));
    await tap('.up-pick', { step: 2, caption: 'Filed by day and stop', lead: 0.5, after: 0.3 });
    if (!(await pg.$('.uprow'))) await pg.setInputFiles('#upfiles', uploads().map((f) => f.out));
    await pg.waitForFunction(() => document.querySelectorAll('.uprow.done').length >= 2, null, { timeout: 30000 });
    await wait(1.3);
    mark('photo-3');
    await tap('#sheet [data-sheetx]', { lead: 0.3, after: 0.4, opens: true });
    await tap('[data-relive="d07"]', { step: 3, caption: 'Relive the day', lead: 0.6, after: 0.2, opens: true });
    await hold(3.4, 'The whole day, stop by stop.');
  },
};
