(function(){
  if(window.__fantastaPowerV3)return;
  window.__fantastaPowerV3=true;
  if(!state.bidEvents)state.bidEvents=[];

  const css=document.createElement('link');css.rel='stylesheet';css.href='./enhance.css';document.head.appendChild(css);
  const signalHelp=byId('signalHelp');
  if(signalHelp&&!byId('faLiveLeader')){
    const leader=document.createElement('div');leader.id='faLiveLeader';leader.className='fa-live-leader';leader.innerHTML='<span>Leader asta</span><b>—</b>';signalHelp.after(leader);
    const trail=document.createElement('div');trail.id='faBidTrail';trail.className='fa-bid-trail';leader.after(trail);
  }
  const actions=document.querySelector('.row-actions'),mine=byId('mineBtn');
  if(actions&&mine&&!byId('faLogBidBtn')){
    const log=document.createElement('button');log.type='button';log.className='btn primary';log.id='faLogBidBtn';log.textContent='↗ Registra rilancio';actions.insertBefore(log,mine);
    const undo=document.createElement('button');undo.type='button';undo.className='btn';undo.id='faUndoBidBtn';undo.textContent='↩ Annulla rilancio';actions.insertBefore(undo,mine);
  }
  const bidderLabel=byId('bidder')?.parentElement?.querySelector('small');if(bidderLabel)bidderLabel.textContent='Chi ha effettuato il controrilancio?';
  const listTable=byId('playersTable'),listCard=listTable&&listTable.closest('.card.full');
  if(listCard&&!byId('faPowerGrid')){
    const card=document.createElement('div');card.className='card full';
    card.innerHTML='<h2>⚔️ Potenza d’acquisto sul giocatore selezionato</h2><div class="note" style="margin-bottom:8px">Il punteggio combina capienza matematica, crediti residui, necessità nel ruolo e comportamento di rilancio. Serve a capire chi può insidiarti e dove puoi esercitare pressione tattica.</div><div id="faPowerGrid" class="fa-power-grid"><div class="fa-empty">Seleziona un giocatore.</div></div>';
    listCard.before(card);
  }

  function bids(name){return(state.bidEvents||[]).filter(x=>x.player===name).sort((a,b)=>a.ts-b.ts)}
  function lastBid(name){const a=bids(name);return a.length?a[a.length-1]:null}
  function teamCap(t,p){if(!t||!p||slotsLeft(t,p.role)<=0)return 0;return maxAffordable(t)}
  function pairStats(teamName,playerName=null){
    const out={againstMe:0,byMeAgainst:0,total:0,onPlayer:0},grouped={};
    for(const e of(state.bidEvents||[])){(grouped[e.player]||(grouped[e.player]=[])).push(e);if(e.team===teamName){out.total++;if(!playerName||e.player===playerName)out.onPlayer++;}}
    for(const[pn,raw]of Object.entries(grouped)){
      if(playerName&&pn!==playerName)continue;
      const arr=raw.slice().sort((a,b)=>a.ts-b.ts);
      for(let i=1;i<arr.length;i++){
        const prev=arr[i-1],cur=arr[i];
        if(teamName!==state.config.mine&&cur.team===teamName&&prev.team===state.config.mine)out.againstMe++;
        if(teamName!==state.config.mine&&cur.team===state.config.mine&&prev.team===teamName)out.byMeAgainst++;
      }
    }
    return out;
  }
  function power(t,p,bid){
    const cap=teamCap(t,p);if(cap<=bid||cap<=0)return 0;
    const maxCap=Math.max(1,...state.teams.map(x=>teamCap(x,p))),st=pairStats(t.name,p.name);
    const capPart=50*(cap/maxCap);
    const creditPart=18*Math.max(0,Math.min(1,creditsLeft(t)/state.config.initialCredits));
    const needPart=17*Math.max(0,Math.min(1,slotsLeft(t,p.role)/Math.max(1,state.config.slots[p.role])));
    const behaviorPart=15*Math.min(1,(st.onPlayer+st.againstMe*.6)/3);
    return Math.round(Math.max(0,Math.min(100,capPart+creditPart+needPart+behaviorPart)));
  }
  function threat(t,p,bid){
    const cap=teamCap(t,p);if(slotsLeft(t,p.role)<=0)return{cls:'out',label:'RUOLO COMPLETO'};if(cap<=bid)return{cls:'out',label:'FUORI GIOCO'};if(t.name===state.config.mine)return{cls:'mine',label:'SPORTING MADONNA'};
    const score=power(t,p,bid),myMax=dynamicMax(p);if(cap>myMax&&score>=65)return{cls:'high',label:'PUÒ SUPERARTI'};if(score>=72)return{cls:'high',label:'MINACCIA ALTA'};if(score>=48)return{cls:'medium',label:'MINACCIA MEDIA'};return{cls:'low',label:'MINACCIA BASSA'};
  }
  function advice(t,p,bid){
    const cap=teamCap(t,p),last=lastBid(p.name),st=pairStats(t.name,p.name),all=pairStats(t.name),myMax=dynamicMax(p);
    if(slotsLeft(t,p.role)<=0)return'Non può più acquistare giocatori di ruolo '+p.role+'.';
    if(cap<=bid)return'Non può superare l’offerta corrente preservando 1 credito per ogni slot libero.';
    if(t.name===state.config.mine)return'Tetto strategico: <b>'+myMax+'</b>. Tetto matematico: <b>'+cap+'</b>. '+(bid<=myMax?'Sei ancora nella zona di rilancio prevista.':'Sei oltre il tetto strategico: inseguire ora deteriora il piano.');
    if(last&&last.team===t.name){
      const pressure=Math.max(bid,Math.min(myMax,Math.round(Math.min(cap,p.baseMax*(1+Math.max(-.10,Math.min(.25,inflation(p.role))))))));
      if(myMax<=bid)return'È leader a <b>'+bid+'</b>, ma il tuo tetto strategico è '+myMax+': non conviene provocare un altro rilancio.';
      if(pressure>bid)return'È leader a <b>'+bid+'</b>. Zona di pressione prudente: fino a circa <b>'+pressure+'</b>, ma solo se saresti disposto ad aggiudicarti il giocatore a quel prezzo.';
      return'È leader a '+bid+'. Hai poco margine tattico prima del tuo tetto strategico.';
    }
    if(st.againstMe>0)return'Ti ha controrilanciato <b>'+st.againstMe+'</b> '+(st.againstMe===1?'volta':'volte')+' su questo giocatore. Può arrivare matematicamente a <b>'+cap+'</b>.';
    if(all.againstMe>=2)return'Storicamente aggressiva contro di te: <b>'+all.againstMe+'</b> controrilanci registrati. Su questo giocatore ha un tetto matematico di '+cap+'.';
    if(myMax>bid&&cap>bid)return'Puoi insidiarla, ma il suo interesse reale è ancora incerto. Tetto matematico: '+cap+'.';
    return'Capienza su questo giocatore: <b>'+cap+'</b>. Nessun segnale forte di aggressività contro Sporting Madonna.';
  }
  function renderExtra(){
    if(!state.bidEvents)state.bidEvents=[];
    const p=playerByName(byId('auctionPlayer').value),bid=+byId('currentBid').value||0,leader=byId('faLiveLeader'),trail=byId('faBidTrail'),grid=byId('faPowerGrid');
    if(!leader||!trail||!grid)return;
    if(!p){leader.innerHTML='<span>Leader asta</span><b>—</b>';trail.innerHTML='';grid.innerHTML='<div class="fa-empty">Seleziona un giocatore per confrontare la potenza d’acquisto delle 10 squadre.</div>';return}
    const live=bids(p.name),last=live.length?live[live.length-1]:null;
    leader.innerHTML=last?'<span>Leader asta</span><b>'+esc(last.team)+' · '+last.price+'</b>':'<span>Leader asta</span><b>Nessun rilancio registrato</b>';
    trail.innerHTML=live.slice(-12).map(x=>'<span class="fa-bid-step '+(x.team===state.config.mine?'mine':'')+'">'+esc(x.team)+' '+x.price+'</span>').join('');
    const items=state.teams.map(t=>({t,cap:teamCap(t,p),score:power(t,p,bid),th:threat(t,p,bid),st:pairStats(t.name,p.name),all:pairStats(t.name)})).sort((a,b)=>b.score-a.score||b.cap-a.cap);
    grid.innerHTML=items.map(x=>'<div class="fa-power-card '+(x.t.name===state.config.mine?'mine':'')+'"><div class="fa-power-head"><div><div class="fa-power-title">'+esc(x.t.name)+(x.t.name===state.config.mine?' · TU':'')+'</div><span class="fa-threat '+x.th.cls+'">'+x.th.label+'</span></div><div class="fa-score">'+x.score+'/100</div></div><div class="fa-power-bar"><i style="width:'+x.score+'%"></i></div><div class="fa-power-meta"><div><small>Crediti</small><b>'+creditsLeft(x.t)+'</b></div><div><small>Slot '+p.role+'</small><b>'+slotsLeft(x.t,p.role)+'</b></div><div><small>Tetto matem.</small><b>'+x.cap+'</b></div><div><small>Margine</small><b>'+Math.max(0,x.cap-bid)+'</b></div></div><div class="fa-pattern">Su questo: '+x.st.onPlayer+' rilanci · contro di te: '+x.st.againstMe+' · storico contro di te: '+x.all.againstMe+'</div><div class="fa-tactic">'+advice(x.t,p,bid)+'</div></div>').join('');
  }
  function recordBid(){
    const p=playerByName(byId('auctionPlayer').value),price=+byId('currentBid').value||0,teamName=byId('bidder').value;if(!p){toast('Seleziona un calciatore valido.');return}if(soldEntry(p.name)){toast('Calciatore già assegnato.');return}
    const t=team(teamName);if(!t)return;if(price<1){toast('Inserisci un prezzo valido.');return}if(slotsLeft(t,p.role)<=0){toast(teamName+': nessuno slot '+p.role+' disponibile.');return}if(price>maxAffordable(t)){toast(teamName+' non può arrivare a '+price+' mantenendo la riserva minima.');return}
    const last=lastBid(p.name);if(last&&price<=last.price){toast('Il rilancio deve superare '+last.price+'.');return}if(last&&last.team===teamName){toast(teamName+' è già leader: seleziona chi effettua il controrilancio.');return}
    state.bidEvents.push({player:p.name,role:p.role,team:teamName,price,ts:Date.now()});saveState();renderExtra();toast('Rilancio registrato: '+teamName+' a '+price);
  }
  function undoBid(){
    const p=playerByName(byId('auctionPlayer').value);if(!p){toast('Seleziona un giocatore.');return}
    for(let i=state.bidEvents.length-1;i>=0;i--)if(state.bidEvents[i].player===p.name){const r=state.bidEvents.splice(i,1)[0],last=lastBid(p.name);byId('currentBid').value=last?last.price:1;saveState();renderAuction();toast('Annullato rilancio '+r.team+' a '+r.price);return}
    toast('Nessun rilancio registrato per questo giocatore.');
  }

  const oldRenderAuction=renderAuction;renderAuction=function(){oldRenderAuction();renderExtra()};
  const oldRenderAll=renderAll;renderAll=function(){if(!state.bidEvents)state.bidEvents=[];oldRenderAll();renderExtra()};
  const oldAssign=assign;assign=function(teamName){const p=playerByName(byId('auctionPlayer').value),price=+byId('currentBid').value||0;if(p&&!soldEntry(p.name)&&price>0){const last=lastBid(p.name);if(!last||last.team!==teamName||last.price!==price)state.bidEvents.push({player:p.name,role:p.role,team:teamName,price,ts:Date.now()})}oldAssign(teamName)};

  byId('faLogBidBtn')?.addEventListener('click',recordBid);byId('faUndoBidBtn')?.addEventListener('click',undoBid);byId('currentBid')?.addEventListener('input',renderExtra);saveState();renderExtra();
})();