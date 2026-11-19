import {useState} from 'react';
import {avatarIcon,progression,editProfile,equipProfile,type LocalProfile} from './progression';
import {ChallengePanel} from './ChallengePanel';
import {Wardrobe} from './Wardrobe';
import type {Result} from './persistence';
export function ProfileScreen({profile,results,onSave,onBack}:{profile:LocalProfile;results:Result[];onSave:(p:LocalProfile)=>void;onBack:()=>void}){
 const p=progression(results,profile.id),[name,setName]=useState(profile.name),[avatar,setAvatar]=useState(profile.avatar),[error,setError]=useState('');
 const save=()=>{try{onSave(editProfile(profile,{name,avatar},results,Date.now()));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not save profile');}};
 return <section className="panel profile-screen"><div className="save-heading"><button onClick={onBack}>← Main menu</button><h2>👤 Local profile</h2></div>
 <div className="profile-hero"><span className="profile-avatar">{avatarIcon(profile.avatar,p.level)}</span><div><h2>{profile.name}</h2><strong>{p.rank} · Level {p.level}</strong><p>{p.xp.toLocaleString()} total XP</p></div></div>
 <div className="xp-track" role="progressbar" aria-label="Experience to next level" aria-valuenow={p.levelXP} aria-valuemin={0} aria-valuemax={p.nextXP}><span style={{width:(p.levelXP/p.nextXP*100)+'%'}}/></div><p className="muted">{p.levelXP} / {p.nextXP} XP · Next level {p.level+1}</p>
 <div className="save-stats"><div><strong>{p.played}</strong><small>Solo games</small></div><div><strong>{p.wins}</strong><small>Victories</small></div><div><strong>{p.losses}</strong><small>Defeats</small></div></div>
 <ChallengePanel results={results} profileId={profile.id}/>
 <h2>🎨 Customize your avatar</h2><label className="profile-name">Display name <input maxLength={24} value={name} onChange={e=>setName(e.target.value)}/></label>
 <div className="cosmetic-grid">{p.avatars.map(a=><button key={a.id} disabled={!a.unlocked} aria-pressed={avatar===a.id} onClick={()=>setAvatar(a.id)}><span>{a.icon}</span><strong>{a.name}</strong><small>{a.unlocked?'Unlocked':'🔒 Level '+a.level}</small></button>)}</div>
 <button onClick={save}>Save profile</button>{error&&<p role="alert">{error}</p>}
 <Wardrobe loadout={profile.loadout} progress={p} onEquip={id=>onSave(equipProfile(profile,id,results,Date.now()))}/>
 <h2>🏅 Achievements · {p.achievements.filter(a=>a.unlocked).length}/{p.achievements.length}</h2><div className="achievement-list">{p.achievements.map(a=><article key={a.id} className={a.unlocked?'earned':''}><span>{a.icon}</span><div><strong>{a.name}</strong><p>{a.description}</p></div><small>{a.unlocked?'✓':'🔒'} {a.xp} XP</small></article>)}</div>
 <p className="muted">100 XP per completed solo game; wins grant a difficulty bonus. Achievements grant XP once. Older matches without difficulty receive completion XP only. Profile and rewards are local and cosmetic; online accounts and sync are planned separately.</p></section>;
}
