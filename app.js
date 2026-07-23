
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const names={reaction:'RÉACTION',cadence:'CADENCE',vehicle:'VÉHICULE',vcqb:'VCQB'};
let current='home',mode='reaction',audioCtx=null,stream=null,analyser=null,data=null,threshold=.08,lastHit=0,ignoreUntil=0,running=false,session=null,testTriggerArmed=false,voiceBusy=false;
function show(id,title=''){current=id;$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));$('#bottomNav').style.display=['exercise','setup','micro'].includes(id)?'none':'grid';$('#topbar').style.display=id==='exercise'?'none':'flex';$('#brand').classList.toggle('hidden',id!=='home');$('#backBtn').classList.toggle('hidden',id==='home');$('#gearBtn').classList.toggle('hidden',id!=='home');$('#pageTitle').textContent=title||''}
$$('.exercise-card').forEach(b=>b.onclick=()=>openSetup(b.dataset.mode));
function openSetup(m){mode=m;show('setup',names[m]);$('#setupSubtitle').textContent=m==='vehicle'?'SÉLECTIONNEZ VOTRE PARCOURS':'CONFIGUREZ VOTRE EXERCICE';let v='';if(m==='vehicle')v=`<div class="vehicle-map"><span class="label front">AVANT</span><span class="label rear">ARRIÈRE</span><span class="label alpha">PILIER<br>ALPHA <i>⌖</i></span><span class="label bravo"><i>⌖</i> PILIER<br>BRAVO</span><span class="label charlie">PILIER<br>CHARLIE <i>⌖</i></span><span class="label delta"><i>⌖</i> PILIER<br>DELTA</span></div>`;else v=`<div style="height:100%;background:url('assets/${m}.jpg') center/cover;filter:brightness(.75)"></div>`;$('#setupVisual').innerHTML=v;let opts=`<label>NIVEAU <select id="level"><option>STANDARD</option><option>AVANCÉ</option></select></label><label>NOMBRE DE SÉRIES <input id="rounds" type="number" value="3" min="1" max="20"></label>`;if(m==='cadence')opts+=`<label>NOMBRE DE BIPS <input id="shots" type="number" value="5" min="2" max="20"></label><label>INTERVALLE <input id="interval" type="number" value="1.78" min=".1" max="10" step=".01"></label>`;else{if(m==='vehicle')opts+=`<label>NOMBRE DE PILIERS <select><option>4</option></select></label>`;opts+=`<label>TIRS MINIMUM <input id="shotsMin" type="number" value="1" min="1" max="8"></label><label>TIRS MAXIMUM <input id="shotsMax" type="number" value="${m==='reaction'?3:4}" min="1" max="8"></label>`}$('#setupOptions').innerHTML=opts;testTriggerArmed=false;$('#triggerTestBox').style.display=m==='cadence'?'none':'block';$('#triggerTestBtn').className='test-trigger';$('#triggerTestStatus').textContent='Teste la détection avant de commencer'}
$('#backBtn').onclick=()=>show('home');$('#gearBtn').onclick=()=>show('settings','RÉGLAGES');$$('[data-nav]').forEach(b=>b.onclick=()=>{let x=b.dataset.nav;$$('#bottomNav button').forEach(n=>n.classList.toggle('active',n===b));show(x,x==='stats'?'STATISTIQUES':x==='settings'?'RÉGLAGES':'')});$('[data-open="micro"]').onclick=()=>show('micro','MICROPHONE');
async function ensureAudio(){if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();await audioCtx.resume()}}
function startBeep(){
  if(!audioCtx)return;
  const t=audioCtx.currentTime;
  const master=audioCtx.createGain();
  const compressor=audioCtx.createDynamicsCompressor();
  compressor.threshold.value=-18;
  compressor.knee.value=12;
  compressor.ratio.value=8;
  master.gain.setValueAtTime(0.0001,t);
  master.gain.exponentialRampToValueAtTime(1.0,t+.008);
  master.gain.setValueAtTime(1.0,t+.38);
  master.gain.exponentialRampToValueAtTime(0.0001,t+.58);
  master.connect(compressor);
  compressor.connect(audioCtx.destination);
  [980,1470].forEach((freq,i)=>{
    const o=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    o.type=i?'square':'sawtooth';
    o.frequency.setValueAtTime(freq,t);
    g.gain.value=i?.34:.72;
    o.connect(g);g.connect(master);
    o.start(t);o.stop(t+.60);
  });
}
async function ensureMic(){if(stream)return true;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});await ensureAudio();let src=audioCtx.createMediaStreamSource(stream);analyser=audioCtx.createAnalyser();analyser.fftSize=1024;data=new Float32Array(analyser.fftSize);src.connect(analyser);loop();return true}catch(e){alert("Autorise le microphone dans Safari.");return false}}
function loop(){if(analyser){analyser.getFloatTimeDomainData(data);let sum=0,peak=0;for(const v of data){sum+=v*v;peak=Math.max(peak,Math.abs(v))}let rms=Math.sqrt(sum/data.length),score=rms*.8+(peak-rms)*.5;if($('#meter')){let n=Math.min(8,Math.max(0,Math.round(rms*80)));$('#meter').innerHTML=Array.from({length:8},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}let now=performance.now();if(!voiceBusy&&now>ignoreUntil&&score>threshold&&now-lastHit>170){
  lastHit=now;
  if(testTriggerArmed) confirmTriggerTest();
  else if(running&&mode!=='cadence') hit(now);
}}requestAnimationFrame(loop)}
$('#sensitivity').oninput=e=>{$('#sensValue').textContent=e.target.value+'%';threshold=.16-(e.target.value/100)*.13}
$('#calibrateBtn').onclick=async()=>{if(await ensureMic()){$('#microStatus').textContent='Calibré ✓';localStorage.micro='1'}};
function renderDots(n,h=0){$('#dots').innerHTML=Array.from({length:n},(_,i)=>`<i class="dot ${i<h?'hit':''}"></i>`).join('')}
$('#startBtn').onclick=async()=>{await ensureAudio();if(mode!=='cadence' && !await ensureMic())return;let rounds=+$('#rounds').value,shots=+($('#shots')?.value||0),interval=+($('#interval')?.value||1.78),shotsMin=+($('#shotsMin')?.value||1),shotsMax=+($('#shotsMax')?.value||1);if(shotsMin>shotsMax){[shotsMin,shotsMax]=[shotsMax,shotsMin]}session={round:0,rounds,shots,shotsMin,shotsMax,interval,hits:0,timer:null};running=true;show('exercise');nextRound()}
function nextRound(){if(!running)return;if(session.round>=session.rounds)return finish();session.round++;session.hits=0;session.lastShotAt=0;$('#liveTime').classList.remove('visible');$('#liveTime').innerHTML='';if(mode!=='cadence')session.shots=session.shotsMin+Math.floor(Math.random()*(session.shotsMax-session.shotsMin+1));$('#exerciseMode').textContent=names[mode]+(mode==='vehicle'?' - STANDARD':'');$('#exerciseSeries').textContent=`SÉRIE ${session.round} / ${session.rounds}`;$('#readyText').style.display=mode==='reaction'?'block':'none';let cmd=mode==='vehicle'?['PILIER ALPHA','PILIER BRAVO','PILIER CHARLIE','PILIER DELTA'][Math.floor(Math.random()*4)]:mode==='vcqb'?['ANGLE GAUCHE','ANGLE DROIT','AXE CENTRAL'][Math.floor(Math.random()*3)]:mode==='reaction'?'BIP':'CADENCE';$('#commandText').textContent=cmd;$('#commandText').style.color=mode==='reaction'?'#eee':'var(--green)';$('#commandText').style.fontSize=mode==='reaction'?'80px':'34px';$('#shotText').textContent=mode==='cadence'?`${session.shots} BIP${session.shots>1?'S':''}`:`${session.shots} TIR${session.shots>1?'S':''}`;renderDots(session.shots);$('#statusText').textContent='EN ATTENTE DU DÉPART';session.timer=setTimeout(()=>mode==='cadence'?runCadence():go(),1200+Math.random()*2200)}
function go(){startBeep();ignoreUntil=performance.now()+650;session.start=performance.now();session.lastShotAt=session.start;$('#statusText').textContent='ENGAGE'}
function runCadence(){let n=0;$('#statusText').textContent='CADENCE';const fire=()=>{if(!running)return;n++;startBeep();renderDots(session.shots,n);if(n<session.shots)session.timer=setTimeout(fire,session.interval*1000);else session.timer=setTimeout(nextRound,900)};fire()}
function hit(now){
  if(!session.start||voiceBusy)return;
  session.hits++;
  const elapsed=(now-session.start)/1000;
  const split=(now-session.lastShotAt)/1000;
  session.lastShotAt=now;
  renderDots(session.shots,session.hits);
  showShotTime(elapsed,session.hits,split);
  const completed=session.hits>=session.shots;
  if(completed){
    $('#statusText').textContent='SÉRIE TERMINÉE';
    session.start=0;
  }else{
    $('#statusText').textContent=`TIR ${session.hits} / ${session.shots}`;
  }
  announceTime(elapsed,()=>{
    if(!running)return;
    ignoreUntil=performance.now()+260;
    if(completed) session.timer=setTimeout(nextRound,520);
  });
}
function finish(){running=false;clearTimeout(session.timer);let h=JSON.parse(localStorage.history||'[]');h.unshift({date:new Date().toISOString(),mode});localStorage.history=JSON.stringify(h.slice(0,50));show('stats','STATISTIQUES');renderStats(mode)}
$('#stopBtn').onclick=finish;
function renderStats(m='reaction'){let isCad=m==='cadence',color=isCad?'#ff9d00':'#9dff00';$('#statsBody').innerHTML=`<div class="hero-stat"><small>${isCad?'MEILLEUR TEMPS ENTRE 2 TIRS':'MEILLEUR TEMPS'}</small><div class="big-value" style="color:${color}">${isCad?'0.18':'0.62'} <small>s</small></div><div class="chart"><svg viewBox="0 0 300 85"><polyline points="0,52 42,32 78,55 112,61 145,45 184,23 226,33 270,8" fill="none" stroke="${color}" stroke-width="2"/><g fill="${color}">${[[0,52],[42,32],[78,55],[112,61],[145,45],[184,23],[226,33],[270,8]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('')}</g></svg></div></div><div class="stat-trio"><div><small>MOYENNE</small><b>${isCad?'.22':'.78'} s</b></div><div><small>${isCad?'SÉQUENCES':'ENTRAÎNEMENTS'}</small><b>${isCad?'36':'24'}</b></div><div><small>AMÉLIORATION</small><b class="positive">+${isCad?'8.7':'11.3'}%</b></div></div><div class="history"><h3>HISTORIQUE RÉCENT</h3>${[.62,.68,.74].map((v,i)=>`<div class="history-row"><span>${isCad?(v-.44).toFixed(2):v.toFixed(2)} s</span><div class="bar"><i style="width:${78-i*10}%"></i></div><small>12/05/2024 18:${42-i*7}</small></div>`).join('')}</div>`}
$$('[data-stat]').forEach(b=>b.onclick=()=>{$$('[data-stat]').forEach(x=>x.classList.toggle('active',x===b));renderStats(b.dataset.stat)});
if(localStorage.micro){$('#microStatus').textContent='Calibré ✓'}
renderStats();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');

function quitExercise(){
  if(!running){show('home');return}
  running=false;
  speechSynthesis?.cancel?.();voiceBusy=false;testTriggerArmed=false;
  if(session?.timer) clearTimeout(session.timer);
  session=null;
  show('home');
}
$('#quitExerciseBtn').onclick=quitExercise;


function formatSeconds(value){
  return value.toFixed(2).replace('.',',');
}
function showShotTime(elapsed,shotNumber,split){
  const box=$('#liveTime');
  box.innerHTML=`${formatSeconds(elapsed)} <small>s · TIR ${shotNumber}</small>`;
  box.classList.remove('visible');
  requestAnimationFrame(()=>box.classList.add('visible'));
}
function announceTime(seconds,onDone){
  if(!('speechSynthesis' in window)){onDone?.();return}
  voiceBusy=true;
  ignoreUntil=performance.now()+5000;
  speechSynthesis.cancel();
  const spoken=formatSeconds(seconds);
  const u=new SpeechSynthesisUtterance(`${spoken} seconde${seconds>=2?'s':''}`);
  u.lang='fr-FR';
  u.rate=1.12;
  u.pitch=.86;
  u.volume=1;
  const voices=speechSynthesis.getVoices();
  const preferred=voices.find(v=>v.lang?.startsWith('fr')&&/Thomas|Daniel|French|France/i.test(v.name))
    || voices.find(v=>v.lang?.startsWith('fr'));
  if(preferred)u.voice=preferred;
  const done=()=>{voiceBusy=false;onDone?.()};
  u.onend=done;
  u.onerror=done;
  speechSynthesis.speak(u);
}
function uiClickSound(){
  if(!audioCtx)return;
  const t=audioCtx.currentTime;
  const o=audioCtx.createOscillator();
  const g=audioCtx.createGain();
  o.type='triangle';
  o.frequency.setValueAtTime(290,t);
  o.frequency.exponentialRampToValueAtTime(170,t+.045);
  g.gain.setValueAtTime(.10,t);
  g.gain.exponentialRampToValueAtTime(.001,t+.055);
  o.connect(g);g.connect(audioCtx.destination);
  o.start(t);o.stop(t+.06);
}
document.addEventListener('pointerdown',async e=>{
  const b=e.target.closest('button');
  if(!b)return;
  await ensureAudio();
  uiClickSound();
  b.classList.add('is-pressing');
});
['pointerup','pointercancel','pointerleave'].forEach(type=>{
  document.addEventListener(type,e=>{
    const b=e.target.closest?.('button');
    if(b)setTimeout(()=>b.classList.remove('is-pressing'),70);
  },true);
});

async function armTriggerTest(){
  if(testTriggerArmed){
    testTriggerArmed=false;
    $('#testTriggerBtn').className='test-trigger';
    $('#triggerTestStatus').textContent='Essai annulé';
    return;
  }
  if(!await ensureMic())return;
  testTriggerArmed=true;
  voiceBusy=false;
  ignoreUntil=performance.now()+350;
  $('#testTriggerBtn').className='test-trigger armed';
  $('#testTriggerBtn').textContent='APPUIE SUR LA DÉTENTE';
  $('#triggerTestStatus').textContent='Écoute en cours…';
}
function confirmTriggerTest(){
  if(!testTriggerArmed)return;
  testTriggerArmed=false;
  $('#testTriggerBtn').className='test-trigger success';
  $('#testTriggerBtn').textContent='DÉTENTE DÉTECTÉE ✓';
  $('#triggerTestStatus').textContent='Le clic a bien été reconnu';
  setTimeout(()=>{
    $('#testTriggerBtn').className='test-trigger';
    $('#testTriggerBtn').textContent='ESSAYER LA DÉTENTE';
  },1500);
}
$('#testTriggerBtn').onclick=armTriggerTest;
