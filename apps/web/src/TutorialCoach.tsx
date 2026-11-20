import {MILESTONES,currentLesson,type TutorialProgress,type Lesson} from './tutorial';
const NAMES:Record<(typeof MILESTONES)[number],string>={settlement:'Place a settlement',road:'Place a road',begin:'Begin the match',roll:'Roll the dice',build:'Build during play',trade:'Complete a trade',cards:'Buy or play a card',robber:'Move the robber',victory:'Finish a match'};
export function TutorialCoach({progress,lesson,tip,onShow,onHide,onSkip}:{progress:TutorialProgress;lesson:Lesson|null;tip:string;onShow:()=>void;onHide:()=>void;onSkip:()=>void}){
 if(!lesson)return null;
 const done=progress.done.length,core=progress.done.filter(id=>['settlement','road','begin','roll'].includes(id)).length;
 return <aside className="tutorial-coach" aria-label="Interactive tutorial" aria-live="polite">
   <div className="coach-topline"><span>🧭 GUIDED PLAY</span><span>{done} / {MILESTONES.length}</span><button aria-label="Hide tutorial" onClick={onHide}>✕</button></div>
   <div className="coach-track" role="progressbar" aria-label="Tutorial actions completed" aria-valuenow={done} aria-valuemin={0} aria-valuemax={MILESTONES.length}><span style={{width:100*done/MILESTONES.length+'%'}}/></div>
   <h2>{lesson.icon} {lesson.title}</h2><p>{lesson.body}</p>
   <p className="coach-tip">{tip}</p>
   <div className="coach-actions"><button className="coach-show" onClick={onShow}>{lesson.action}</button><button onClick={onSkip}>Skip tutorial</button></div>
   <details className="coach-checklist"><summary>My progress · {core}/4 essentials</summary><ul>{MILESTONES.map(id=><li key={id} className={progress.done.includes(id)?'complete':''}>{progress.done.includes(id)?'✓':'○'} {NAMES[id]}</li>)}</ul><small>Only actions you actually complete count. Trading, cards, robber and victory are optional to learn now.</small></details>
 </aside>;
}
