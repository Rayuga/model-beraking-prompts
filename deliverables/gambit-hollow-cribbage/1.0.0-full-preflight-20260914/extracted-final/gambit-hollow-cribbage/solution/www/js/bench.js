const codes=value=>value.trim().toUpperCase().split(/[\s,]+/).filter(Boolean);
$('hand-score-form').addEventListener('submit',async e=>{
  e.preventDefault();const body={hand:codes($('score-hand').value),cut:$('score-cut').value.trim().toUpperCase(),crib:$('score-crib').checked};
  const r=await api('POST','/api/score',body);
  $('hand-score-result').textContent=r.ok?`${r.data.total} points · ${Object.entries(r.data.breakdown).map(([k,v])=>`${k}: ${v}`).join(' · ')}`:r.data.error;
  $('hand-score-cards').innerHTML=r.ok?[...body.hand,body.cut].map(c=>cardSVG(c,{w:48})).join(''):'';
});
$('play-score-form').addEventListener('submit',async e=>{
  e.preventDefault();const r=await api('POST','/api/play/score',{pile:codes($('score-pile').value),card:$('score-card').value.trim().toUpperCase()});
  $('play-score-result').textContent=r.ok?`Count ${r.data.total} · ${r.data.points} points · ${r.data.why.join('; ')||'No scoring combination'}`:r.data.error;
});
async function savedGames(){const r=await api('GET','/api/games');if(!r.ok)return;$('saved-games').replaceChildren(new Option('Choose a game',''),...r.data.games.map(g=>new Option(`${g.id} · hand ${g.hand_no} · ${g.scores.a}–${g.scores.b}`,g.id)));}
$('refresh-games').onclick=savedGames;
$('open-game').onclick=async()=>{const id=$('saved-games').value;if(!id)return;remember(id);selected=[];await refresh();};
$('fixed-practice').onclick=async()=>{
  const r=await api('POST','/api/games',{practice:$('practice-deal').value,start_scores:{a:Number($('start-a').value),b:Number($('start-b').value)}});
  if(!r.ok){say(r.data.error);return;}$('seatb').checked=false;sessionStorage.setItem('gambit-seat','a');remember(r.data.id);selected=[];say('Practice deal ready. Discard two cards from each seat.');paint(r.data);await savedGames();
};
(async()=>{const r=await api('GET','/api/practice');if(r.ok)$('practice-deal').replaceChildren(...Object.entries(r.data).map(([id,p])=>new Option(p.name,id)));await savedGames();})();
