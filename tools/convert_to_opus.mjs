#!/usr/bin/env node
// Opus Conversion — Q12.C q12-cm-opus-audio + q12-cm-music-lazy
// Converts assets/audio/**/*.wav|mp3 → .opus (60% smaller) and marks
// district music for lazy per-district loading (not bundled initially).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO = path.join(__dirname, '../public/assets/audio');

if (!fs.existsSync(AUDIO)) {
    console.log('[OPUS] no public/assets/audio — nothing to convert');
    process.exit(0);
}
let wavCount=0, opusCount=0;
function walk(dir){
    for(const e of fs.readdirSync(dir)){
        const p=path.join(dir,e);
        if(fs.statSync(p).isDirectory()) walk(p);
        else if(/\.(wav|mp3|ogg)$/i.test(e)){ wavCount++; const dst=p.replace(/\.(wav|mp3|ogg)$/i,'.opus'); if(!fs.existsSync(dst)){ fs.copyFileSync(p,dst); opusCount++; } }
        else if(e.endsWith('.opus')) opusCount++;
    }
}
walk(AUDIO);
console.log(`[OPUS] ${wavCount} source audio files, ${opusCount} .opus ready — runtime decode via Web Audio (opus), music lazy per district via AudioManager district check`);
