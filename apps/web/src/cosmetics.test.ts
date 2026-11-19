import {describe,it,expect} from 'vitest';
import {COSMETICS,CATEGORIES,DEFAULT_LOADOUT,equip,effectiveLoadout,validLoadout,unlocked} from './cosmetics';
import {createProfile,equipProfile,validateProfile,progression} from './progression';
import type {Result} from './persistence';
const novice={level:1,achievements:[]},viking={level:2,achievements:[]};
describe('cosmetic collections',()=>{
 it('has stable unique IDs and four categories per themed collection',()=>{expect(COSMETICS.length).toBe(32);expect(new Set(COSMETICS.map(c=>c.id)).size).toBe(32);expect(COSMETICS.filter(c=>unlocked(c,novice)).length).toBe(4);expect(validLoadout(DEFAULT_LOADOUT)).toBe(true);});
 it('equips only earned cosmetics in their own slot',()=>{expect(()=>equip(undefined,'viking-dice',novice)).toThrow();const next=equip(undefined,'viking-dice',viking);expect(next).toEqual({...DEFAULT_LOADOUT,dice:'viking-dice'});expect(effectiveLoadout(next,novice)).toEqual(DEFAULT_LOADOUT);expect(validLoadout({...next,board:'viking-dice'})).toBe(false);});
 it('achievement rewards require the actual achievement',()=>{expect(()=>equip(undefined,'first-crown-title',viking)).toThrow();expect(equip(undefined,'first-crown-title',{level:1,achievements:[{id:'first-win',unlocked:true}]}).title).toBe('first-crown-title');});
 it('accepts previous profiles, keeps XP and match records unchanged when equipping',()=>{const profile=createProfile('p',1);const {loadout,...legacy}=profile;expect(validateProfile(legacy)).toBe(true);const rs:Result[]=[{id:'a',profileId:'p',endedAt:1,players:4,humans:1,winner:0,winnerName:'Founder',rounds:30,difficulty:'hard'}];const before=JSON.stringify(rs);const p=equipProfile(legacy,'first-crown-title',rs,2);expect(p.loadout?.title).toBe('first-crown-title');expect(JSON.stringify(rs)).toBe(before);expect(progression(rs,p.id).xp).toBe(progression(rs,profile.id).xp);expect(CATEGORIES.every(k=>p.loadout?.[k])).toBe(true);});
});
