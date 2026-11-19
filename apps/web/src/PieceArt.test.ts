import {describe,it,expect} from 'vitest';
import {ambientBar} from './ambient';
import {robberSymbol,effectColor,themeFor} from './PieceArt';
import {COLLECTIONS} from './cosmetics';
describe('cosmetic art',()=>{
 it('provides seven recognizable robber markers and distinct theme colors',()=>{expect(new Set(COLLECTIONS.map(c=>robberSymbol(c.id+'-robber'))).size).toBe(7);expect(new Set(COLLECTIONS.map(c=>effectColor(c.id+'-effects'))).size).toBe(7);expect(themeFor('classic-city')).toBe('classic');});
 it('provides seven original ambient motifs and safe classic fallback',()=>{const motifs=COLLECTIONS.map(c=>ambientBar(c.id+'-music',0).notes.join(','));expect(new Set(motifs).size).toBe(7);expect(ambientBar('unknown',0)).toEqual(ambientBar('classic-music',0));expect(COLLECTIONS.every(c=>ambientBar(c.id+'-music',99).notes.length===8)).toBe(true);});
});