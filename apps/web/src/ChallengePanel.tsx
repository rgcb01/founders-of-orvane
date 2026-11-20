import {useEffect,useState} from 'react';
import {currentChallenges} from './challenges';
import {soloResults,progression,rewardSummary} from './progression';
import type {Result} from './persistence';
export function ChallengePanel({results,profileId}:{results:Result[];profileId:string}){
 const [now,setNow]=useState(Date.now);useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(t);},[]);
 const solo=soloResults(results,profileId),p=progression(solo,profileId),m=p.metrics;
 const goals=currentChallenges(solo,now);
 return <section className="challenge-panel"><h2>🎯 Challenges</h2><p className="muted">Daily and weekly goals reset at midnight UTC (weeks begin Monday). Credit is based on completed solo matches; earned XP stays forever.</p>
 {(['daily','weekly'] as const).map(period=><div key={period}><h3>{period==='daily'?'Daily':'Weekly'}</h3>{goals.filter(g=>g.goal.period===period).map(g=><article className="challenge-item" key={g.id}><div><strong>{g.complete?'✓ ':''}{g.goal.title}</strong><small>{Math.min(g.progress,g.goal.target)} / {g.goal.target} · {g.goal.xp} XP</small></div><progress value={Math.min(g.progress,g.goal.target)} max={g.goal.target}/></article>)}</div>)}
 <h2>📊 Career statistics</h2><div className="career-stats">{[['🌾 Produced',m.produced],['⚓ Trades',m.trades],['🛤️ Roads built',m.roads],['🏠 Settlements built',m.settlements],['🏰 City upgrades',m.cities],['🛤️ Best route',m.longestRoad],['⚔️ Largest army matches',m.armies],['👑 Best win streak',p.bestStreak],['🎯 Challenge XP',p.challengeExperience]].map(([label,value])=><div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div><p className="muted">Detailed actions tracked in {m.tracked} completed matches. Older games may not include action counts.</p></section>;
}
export function MatchRewards({results,profileId,matchId}:{results:Result[];profileId:string;matchId:string}){
 const r=rewardSummary(results,profileId,matchId);if(!r)return null;
 return <section className="match-rewards"><h3>🎁 Match rewards</h3><div className="reward-hero"><strong className="reward-total">+{r.xp} XP</strong><div className="reward-meter" aria-hidden="true"><span/></div></div><p>Match {r.matchXP} · Achievements {r.achievementXP} · Challenges {r.challengeXP}</p>{r.toLevel>r.fromLevel&&<p className="reward-level">Level up · {r.fromLevel} → {r.toLevel}</p>}
 {r.earned.map(a=><p key={a.id}>{a.icon} {a.name} · +{a.xp} XP</p>)}
 {r.rewards.length+r.avatars.length>0&&<details open><summary>{r.rewards.length+r.avatars.length} new cosmetics & avatars</summary><div className="reward-items">{[...r.rewards,...r.avatars].map(c=><span key={c.id}>{c.icon} {c.name}</span>)}</div></details>}
 {r.metrics&&<p className="muted">🌾 {r.metrics.produced} produced · ⚓ {r.metrics.trades+r.metrics.bankTrades} trades · 🛤️ {r.metrics.roads} roads · 🏰 {r.metrics.cities} cities</p>}
 <small>Recorded once per match. Reviewing this result does not award XP again.</small></section>;
}
