(function(){
  if(window.__fantastaPowerV4)return;
  window.__fantastaPowerV4=true;

  function ensure(){if(!state.bidEvents)state.bidEvents=[]}
  ensure();

  if(!document.querySelector('link[data-fa-enhance]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='./enhance.css';css.dataset.faEnhance='1';document.head.appendChild(css);
  }

  const signalHelp=byId('signalHelp');
  if(signalHelp&&!byId('faLiveLeader')){
    const leader=document.createElement('div');leader.id='faLiveLeader';leader.className='fa-live-leader';leader.innerHTML='<span>Leader asta</span><b>—</b>';signalHelp.after(leader);
    const trail=document.createElement('div');trail.id='faBidTrail';trail.className='fa-bid-trail';leader.after(trail);
  }

  const actions=document.querySelector('.row-actions'),mine=byId('mineBtn');
  if(actions&&mine&&!byId('faLogBidBtn')){
    const log=document.createElement('button');log.type='button';log.className='btn primary';log.id='faLogBidBtn';log.textContent='↗ Registra rilancio';actions.insertBefore(log,mine);
    const undo=document.createElement('button');undo.type='button';undo.className='btn';undo.id='faUndoBidBtn';undo.textContent='↩ Annulla rilancio';actions.insertBefore(undo,mine);
    mine.classList.remove('primary');
  }

  const bidderLabel=byId('bidder')?.parentElement?.querySelector('small');
  if(bidderLabel)bidderLabel.textContent='Chi ha effettuato il controrilancio?';

  const listTable=byId('playersTable'),listCard=listTable&&listTable.closest('.card.full');
  if(listCard&&!byId('faPowerGrid')){
    const card=document.createElement('div');card.className='card full';
    card.innerHTML='<h2>⚔️ Potenza d’acquisto sul giocatore selezionato</h2><div class="note" style="margin-bottom:8px">Confronta stima strategica, tetto matematico, crediti, slot e comportamento di rilancio. La stima non rappresenta la volontà reale dell’avversario.</div><div id="faStrategySummary" class="fa-strategy-summary">Seleziona un giocatore.</div><div id="faPowerGrid" class="fa-power-grid"><div class="fa-empty">Seleziona un giocatore.</div></div>';
    listCard.before(card);
  }

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const totalRosterSlots=()=>Object.values(state.config.slots).reduce((a,b)=>a+b,0);
  const roleSpent=(t,r)=>t.roster.filter(x=>x.role===r).reduce((s,x)=>s+x.price,0);
  function bids(name){ensure();return state.bidEvents.filter(x=>x.player===name).sort((a,b)=>a.ts-b.ts)}
  function lastBid(name){const a=bids(name);return a.length?a[a.length-1]:null}
  function teamCap(t,p){if(!t||!p||slotsLeft(t,p.role)<=0)return 0;return maxAffordable(t)}

  function estMax(t,p){
    if(!t||!p||slotsLeft(t,p.role)<=0)return 0;
    if(t.name===state.config.mine)return dynamicMax(p);
    const cap=teamCap(t,p);if(cap<=0)return 0;
    const ri=clamp(inflation(p.role),-.15,.35),oi=clamp(inflation(),-.10,.20),inf=ri*.75+oi*.25;
    const slots=totalSlotsLeft(t),startSlots=Math.max(1,totalRosterSlots());
    const startFree=Math.max(1,(state.config.initialCredits-startSlots)/startSlots);
    const free=Math.max(0,(creditsLeft(t)-slots)/Math.max(1,slots));
    const liquidity=clamp(.82+.18*(free/startFree),.78,1.25);
    const target=Math.max(1,Math.round(state.config.initialCredits*(state.config.budgetPct[p.role]||0)/100));
    const budgetRatio=clamp((target-roleSpent(t,p.role))/target,-.5,1.5);
    const openRatio=state.config.slots[p.role]?slotsLeft(t,p.role)/state.config.slots[p.role]:0;
    const need=clamp(.86+.16*openRatio+.08*budgetRatio,.82,1.18);
    return Math.max(0,Math.min(cap,Math.round(p.baseMax*(1+inf)*liquidity*need)));
  }

  function pairStats(teamName,playerName=null){
    const out={againstMe:0,byMeAgainst:0,total:0,onPlayer:0,avgJump:0},grouped={};let jump=0,jumps=0;
    for(const e of(state.bidEvents||[])){(grouped[e.player]||(grouped[e.player]=[])).push(e);if(e.team===teamName){out.total++;if(!playerName||e.player===playerName)out.onPlayer++;}}
    for(const[pn,raw]of Object.entries(grouped)){
      if(playerName&&pn!==playerName)continue;
      const arr=raw.slice().sort((a,b)=>a.ts-b.ts);
      for(let i=1;i<arr.length;i++){
        const prev=arr[i-1],cur=arr[i];
        if(cur.team===teamName){jump+=Math.max(0,cur.price-prev.price);jumps++;}
        if(teamName!==state.config.mine&&cur.team===teamName&&prev.team===state.config.mine)out.againstMe++;
        if(teamName!==state.config.mine&&cur.team===state.config.mine&&prev.team===teamName)out.byMeAgainst++;
      }
    }
    out.avgJump=jumps?jump/jumps:0;return out;
  }

  function power(t,p,bid){
    const cap=teamCap(t,p),est=estMax(t,p);if(cap<=bid||cap<=0)return 0;
    const room=Math.max(0,est-bid),base=Math.max(1,p.baseMax),roomPart=54*(clamp(room/base,0,1.2)/1.2);
    const slots=Math.max(1,totalSlotsLeft(t)),startSlots=Math.max(1,totalRosterSlots()),startFree=Math.max(1,(state.config.initialCredits-startSlots)/startSlots),free=Math.max(0,(creditsLeft(t)-slots)/slots);
    const liquidityPart=24*(clamp(free/startFree,0,1.5)/1.5),needPart=14*clamp(slotsLeft(t,p.role)/Math.max(1,state.config.slots[p.role]),0,1),st=pairStats(t.name,p.name),behaviorPart=8*Math.min(1,(st.onPlayer+st.againstMe*.75)/3);
    return Math.round(clamp(roomPart+liquidityPart+needPart+behaviorPart,0,100));
  }

  function threat(t,p,bid){
    const cap=teamCap(t,p),est=estMax(t,p);if(slotsLeft(t,p.role)<=0)return{cls:'out',label:'RUOLO COMPLETO'};if(cap<=bid)return{cls:'out',label:'FUORI GIOCO'};if(t.name===state.config.mine)return{cls:'mine',label:'SPORTING MADONNA'};
    const score=power(t,p,bid),myMax=dynamicMax(p);if(est>myMax&&score>=60)return{cls:'high',label:'PUÒ SUPERARTI'};if(score>=70)return{cls:'high',label:'MINACCIA ALTA'};if(score>=42)return{cls:'medium',label:'MINACCIA MEDIA'};return{cls:'low',label:'MINACCIA BASSA'};
  }

  function pressureLimit(t,p){return Math.max(0,Math.min(dynamicMax(p),p.base600,estMax(t,p)-1))}

  function advice(t,p,bid){
    const cap=teamCap(t,p),est=estMax(t,p),last=lastBid(p.name),st=pairStats(t.name,p.name),all=pairStats(t.name),myMax=dynamicMax(p);
    if(slotsLeft(t,p.role)<=0)return'Non può più acquistare giocatori di ruolo '+p.role+'.';
    if(cap<=bid)return'Non può superare l’offerta corrente preservando 1 credito per ogni slot libero.';
    if(t.name===state.config.mine)return'Tetto strategico: <b>'+myMax+'</b>. Tetto matematico: <b>'+cap+'</b>. '+(bid<=myMax?'Sei ancora nella zona di rilancio prevista.':'Sei oltre il tetto strategico: inseguire ora deteriora il piano.');
    if(last&&last.team===t.name){const press=pressureLimit(t,p);if(myMax<=bid)return'È leader a <b>'+bid+'</b>, ma il tuo tetto è '+myMax+': lascialo spendere.';if(press>bid)return'È leader a <b>'+bid+'</b>. Pressione prudente fino a circa <b>'+press+'</b>, ma solo se accetteresti di aggiudicarti il giocatore a quel prezzo.';return'È leader a '+bid+'. Hai poco margine tattico prima del tuo tetto.';}
    if(st.againstMe>0)return'Ti ha controrilanciato <b>'+st.againstMe+'</b> '+(st.againstMe===1?'volta':'volte')+' su questo giocatore. Stima max: <b>'+est+'</b>.';
    if(all.againstMe>=2)return'Storicamente aggressiva contro di te: <b>'+all.againstMe+'</b> controrilanci registrati. Stima max su questo giocatore: '+est+'.';
    if(est>bid)return'Può ancora entrare. Stima max <b>'+est+'</b>, tetto matematico '+cap+'. Puoi selezionarla come rilanciante per registrare rapidamente un suo ingresso.';
    return'Ha capienza matematica, ma il prezzo è già oltre la fascia stimata.';
  }

  function renderExtra(){
    ensure();
    const p=playerByName(byId('auctionPlayer').value),bid=+byId('currentBid').value||0,leader=byId('faLiveLeader'),trail=byId('faBidTrail'),grid=byId('faPowerGrid'),summary=byId('faStrategySummary');
    if(!leader||!trail||!grid||!summary)return;
    if(!p){leader.innerHTML='<span>Leader asta</span><b>—</b>';trail.innerHTML='';summary.textContent='Seleziona un giocatore per confrontare le squadre.';grid.innerHTML='<div class="fa-empty">Seleziona un giocatore per confrontare la potenza d’acquisto delle 10 squadre.</div>';return}
    const live=bids(p.name),last=live.length?live[live.length-1]:null,myMax=dynamicMax(p);
    leader.innerHTML=last?'<span>Leader asta</span><b>'+esc(last.team)+' · '+last.price+'</b>':'<span>Leader asta</span><b>Nessun rilancio registrato</b>';
    trail.innerHTML=live.slice(-14).map((x,i)=>'<span class="fa-bid-step '+(x.team===state.config.mine?'mine':'')+(i>0&&live[live.length-Math.min(14,live.length)+i-1]?.team!==x.team?' counter':'')+'">'+esc(x.team)+' '+x.price+'</span>').join('');
    const items=state.teams.map(t=>({t,cap:teamCap(t,p),est:estMax(t,p),score:power(t,p,bid),th:threat(t,p,bid),st:pairStats(t.name,p.name),all:pairStats(t.name)})).sort((a,b)=>(b.t.name===state.config.mine)-(a.t.name===state.config.mine)||b.score-a.score||b.est-a.est);
    const rivals=items.filter(x=>x.t.name!==state.config.mine&&x.score>0),top=rivals[0];
    if(last&&last.team!==state.config.mine){const opp=team(last.team),est=estMax(opp,p),press=pressureLimit(opp,p);summary.innerHTML=bid<myMax?'<b>Rilancio subito da '+esc(last.team)+'.</b> Prezzo '+bid+'. Tuo max <b>'+myMax+'</b>, stima avversaria <b>'+est+'</b>. '+(press>bid?'Zona di pressione prudente fino a <b>'+press+'</b>, con rischio reale di aggiudicartelo.':'Sei vicino al limite: meglio evitare rilanci di pressione.'):'<b>'+esc(last.team)+' è in testa a '+bid+'.</b> Il prezzo ha raggiunto/superato il tuo max ('+myMax+'): lascialo spendere.';}
    else if(last&&last.team===state.config.mine)summary.innerHTML=top?'<b>Sei in testa a '+bid+'.</b> Minaccia principale: <b>'+esc(top.t.name)+'</b> ('+top.score+'/100, stima max '+top.est+'). Tuo max: <b>'+myMax+'</b>.':'<b>Sei in testa a '+bid+'.</b> Nessuna minaccia significativa secondo i dati disponibili.';
    else summary.innerHTML=top?'Nessun rilancio registrato. Minaccia teorica principale: <b>'+esc(top.t.name)+'</b> ('+top.score+'/100, stima max '+top.est+'). Tuo max: <b>'+myMax+'</b>.':'Nessun rilancio registrato.';
    grid.innerHTML=items.map(x=>'<div class="fa-power-card '+(x.t.name===state.config.mine?'mine':'')+' '+(last?.team===x.t.name?'leader':'')+'"><div class="fa-power-head"><div><div class="fa-power-title">'+esc(x.t.name)+(x.t.name===state.config.mine?' · TU':'')+(last?.team===x.t.name?' · IN TESTA':'')+'</div><span class="fa-threat '+x.th.cls+'">'+x.th.label+'</span></div><div class="fa-score">'+x.score+'/100</div></div><div class="fa-power-bar"><i style="width:'+x.score+'%"></i></div><div class="fa-power-meta"><div><small>Crediti</small><b>'+creditsLeft(x.t)+'</b></div><div><small>Slot '+p.role+'</small><b>'+slotsLeft(x.t,p.role)+'</b></div><div><small>Stima max</small><b>'+x.est+'</b></div><div><small>Tetto matem.</small><b>'+x.cap+'</b></div></div><div class="fa-pattern">Su questo: '+x.st.onPlayer+' rilanci · contro di te: '+x.st.againstMe+' · tuoi contro loro: '+x.st.byMeAgainst+' · storico contro di te: '+x.all.againstMe+'</div><div class="fa-tactic">'+advice(x.t,p,bid)+'</div>'+(x.t.name!==state.config.mine&&x.cap>bid?'<button type="button" class="smallbtn fa-pick-team" data-fa-team="'+esc(x.t.name)+'">Seleziona come rilanciante</button>':'')+'</div>').join('');
  }

  function syncPlayer(){
    const p=playerByName(byId('auctionPlayer').value);if(!p){renderExtra();return}const last=lastBid(p.name);if(last){byId('currentBid').value=last.price;byId('bidder').value=last.team}else byId('currentBid').value=1;renderAuction();
  }

  function recordBid(){
    const p=playerByName(byId('auctionPlayer').value),price=+byId('currentBid').value||0,teamName=byId('bidder').value;if(!p){toast('Seleziona un calciatore valido.');return}if(soldEntry(p.name)){toast('Calciatore già assegnato.');return}
    const t=team(teamName);if(!t)return;if(price<1){toast('Inserisci un prezzo valido.');return}if(slotsLeft(t,p.role)<=0){toast(teamName+': nessuno slot '+p.role+' disponibile.');return}if(price>maxAffordable(t)){toast(teamName+' non può arrivare a '+price+' mantenendo la riserva minima.');return}
    const last=lastBid(p.name);if(last&&price<=last.price){toast('Il rilancio deve superare '+last.price+'.');return}if(last&&last.team===teamName){toast(teamName+' è già leader: seleziona chi effettua il controrilancio.');return}
    state.bidEvents.push({player:p.name,role:p.role,team:teamName,price,ts:Date.now()});saveState();renderExtra();toast((last?'Controrilancio':'Prima offerta')+': '+teamName+' a '+price);
  }

  function undoBid(){
    const p=playerByName(byId('auctionPlayer').value);if(!p){toast('Seleziona un giocatore.');return}
    for(let i=state.bidEvents.length-1;i>=0;i--)if(state.bidEvents[i].player===p.name){const r=state.bidEvents.splice(i,1)[0],last=lastBid(p.name);byId('currentBid').value=last?last.price:1;if(last)byId('bidder').value=last.team;saveState();renderAuction();toast('Annullato rilancio '+r.team+' a '+r.price);return}
    toast('Nessun rilancio registrato per questo giocatore.');
  }

  const oldRenderAuction=renderAuction;renderAuction=function(){oldRenderAuction();renderExtra()};
  const oldRenderAll=renderAll;renderAll=function(){ensure();oldRenderAll();renderExtra()};
  const oldAssign=assign;assign=function(teamName){const p=playerByName(byId('auctionPlayer').value),price=+byId('currentBid').value||0,before=state.history.length;oldAssign(teamName);if(p&&state.history.length>before){const last=lastBid(p.name);if(!last||last.team!==teamName||last.price!==price){state.bidEvents.push({player:p.name,role:p.role,team:teamName,price,ts:Date.now(),final:true});saveState()}}};

  byId('faLogBidBtn')?.addEventListener('click',recordBid);
  byId('faUndoBidBtn')?.addEventListener('click',undoBid);
  byId('currentBid')?.addEventListener('input',renderExtra);
  byId('bidder')?.addEventListener('change',renderExtra);
  byId('auctionPlayer')?.addEventListener('change',syncPlayer);
  byId('auctionPlayer')?.addEventListener('input',renderExtra);
  byId('minusBid')?.addEventListener('click',()=>setTimeout(renderExtra,0));
  byId('plusBid')?.addEventListener('click',()=>setTimeout(renderExtra,0));
  document.addEventListener('click',e=>{const pick=e.target.closest?.('[data-fa-team]');if(pick){byId('bidder').value=pick.dataset.faTeam;renderExtra();byId('currentBid')?.focus()}if(e.target.closest?.('[data-auction]')||e.target.closest?.('[data-favpick]'))setTimeout(syncPlayer,0)});

  saveState();renderExtra();
})();
