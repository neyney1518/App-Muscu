const App = {
    currentSeanceId: null, currentExerciseId: null, currentSessionId: null,
    currentCalendarMonth: new Date(), timerInterval: null, timerStartTime: null, timerElapsed: 0,
    statsState: { selectedExerciseId: null, metric: 'weight' }, dragState: { dragSrcEl: null }
};
const MUSCLE_ICONS = { default: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>` };

document.addEventListener('DOMContentLoaded', () => {
    initNavigation(); initSeancesListView(); initSeanceDetailView(); initHistoriqueView(); initPerformanceView(); renderSeancesList();
});

function initNavigation() {
    document.querySelectorAll('.nav-btn-modern').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.view === 'seances-list') switchToView('seances-list-view');
            else switchToView('historique-view');
            document.querySelectorAll('.nav-btn-modern').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}
function switchToView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'historique-view') refreshHistoriqueView();
    if (id === 'seances-list-view') renderSeancesList();
}

// LISTE
function initSeancesListView() {
    document.getElementById('add-seance-header-btn').addEventListener('click', openSeanceModal);
    document.getElementById('cancel-seance-btn').addEventListener('click', closeSeanceModal);
    document.getElementById('save-seance-btn').addEventListener('click', saveNewSeance);
    document.getElementById('settings-btn').addEventListener('click', () => document.getElementById('settings-modal').classList.add('active'));
    document.getElementById('close-settings-btn').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('active'));
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input').addEventListener('change', importDataFile);
}
function renderSeancesList() {
    const grid = document.getElementById('seances-grid'); grid.innerHTML = '';
    const seances = Storage.getSeances();
    if (seances.length === 0) { document.getElementById('empty-seances').classList.remove('hidden'); return; }
    document.getElementById('empty-seances').classList.add('hidden');
    seances.forEach(s => {
        const card = document.createElement('div'); card.className = 'seance-card';
        card.innerHTML = `<div class="seance-content-wrapper"><div class="seance-icon">${MUSCLE_ICONS.default}</div><div class="seance-name">${s.name}</div><div class="seance-exercises-count">${s.exercises.length} exos</div></div><button class="card-delete-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
        card.querySelector('.seance-content-wrapper').addEventListener('click', () => openSeanceDetail(s.id));
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => { e.stopPropagation(); if(confirm('Supprimer ?')) { Storage.deleteSeance(s.id); renderSeancesList(); }});
        grid.appendChild(card);
    });
}
function openSeanceModal() { document.getElementById('seance-modal').classList.add('active'); document.getElementById('new-seance-name').value = ''; setTimeout(()=>document.getElementById('new-seance-name').focus(), 100); }
function closeSeanceModal() { document.getElementById('seance-modal').classList.remove('active'); }
function saveNewSeance() { const n = document.getElementById('new-seance-name').value.trim(); if(n) { Storage.addSeance(n); closeSeanceModal(); renderSeancesList(); } }

// DETAIL
function openSeanceDetail(id) {
    App.currentSeanceId = id;
    const s = Storage.getSeance(id);
    const sess = Storage.getTodaySession(id);
    App.currentSessionId = sess.id;
    document.getElementById('seance-title').textContent = s.name;
    renderExerciseCarousel(s);
    const btn = document.getElementById('finish-session-btn');
    btn.textContent = sess.completed ? "Séance terminée (Mettre à jour)" : "Terminer la séance";
    btn.className = sess.completed ? "finish-btn completed-state" : "finish-btn";
    
    if (s.exercises.length > 0) selectExerciseInDetail(s.exercises[0].id);
    else document.getElementById('exercise-detail-content').classList.add('hidden');
    switchToView('seance-detail-view');
}
function initSeanceDetailView() {
    document.getElementById('back-to-list').addEventListener('click', () => switchToView('seances-list-view'));
    document.getElementById('cancel-exercise-btn').addEventListener('click', () => document.getElementById('exercise-modal').classList.remove('active'));
    document.getElementById('save-exercise-btn').addEventListener('click', saveNewExercise);
    document.getElementById('add-series-detail-btn').addEventListener('click', addSeries);
    document.querySelector('.btn-delete-series').addEventListener('click', deleteSelectedSeries);
    document.getElementById('start-timer-btn').addEventListener('click', toggleTimer);
    document.getElementById('exercise-comment-detail').addEventListener('input', () => saveSeries());
    document.querySelector('.options-btn').addEventListener('click', showOptionsMenu);
    document.getElementById('finish-session-btn').addEventListener('click', () => {
        if(Storage.completeSession(App.currentSessionId)) { showNotification('Validé !', 'success'); switchToView('seances-list-view'); }
    });
}

function renderExerciseCarousel(seance) {
    const cont = document.getElementById('exercise-carousel-items'); cont.innerHTML = '';
    seance.exercises.forEach((ex, i) => {
        const item = document.createElement('div'); item.className = 'carousel-item';
        item.dataset.index = i; item.draggable = true;
        if(ex.id === App.currentExerciseId) item.classList.add('active');
        item.innerHTML = `<div class="carousel-icon"><div class="carousel-icon-img">${MUSCLE_ICONS.default}</div></div><div class="carousel-label">${ex.name}</div>`;
        item.onclick = () => selectExerciseInDetail(ex.id);
        item.ondragstart = (e) => { App.dragState.dragSrcEl = item; e.dataTransfer.effectAllowed='move'; item.classList.add('dragging'); };
        item.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; return false; };
        item.ondrop = (e) => { 
            e.stopPropagation(); item.classList.remove('dragging');
            if (App.dragState.dragSrcEl !== item) {
                const oldI = parseInt(App.dragState.dragSrcEl.dataset.index);
                const newI = parseInt(item.dataset.index);
                const exs = [...seance.exercises];
                const [moved] = exs.splice(oldI, 1);
                exs.splice(newI, 0, moved);
                Storage.reorderExercises(App.currentSeanceId, exs);
                renderExerciseCarousel({ ...seance, exercises: exs });
            }
            return false;
        };
        cont.appendChild(item);
    });
    const addDiv = document.createElement('div'); addDiv.className = 'carousel-item';
    addDiv.innerHTML = `<div class="carousel-add-btn">+</div><div class="carousel-label">Ajouter</div>`;
    addDiv.onclick = openExerciseModal;
    cont.appendChild(addDiv);
}

function selectExerciseInDetail(id) {
    App.currentExerciseId = id;
    document.getElementById('exercise-detail-content').classList.remove('hidden');
    document.querySelectorAll('.carousel-item').forEach(el => el.classList.toggle('active', el.dataset.index !== undefined && Storage.getSeance(App.currentSeanceId).exercises[el.dataset.index].id === id));
    
    const d = Storage.getExerciseData(App.currentSessionId, id);
    document.getElementById('exercise-comment-detail').value = d.comment || '';
    renderSeriesTable(d.series || []);
    loadHistory();
    checkPR();
}

function openExerciseModal() {
    document.getElementById('exercise-modal').classList.add('active');
    const input = document.getElementById('new-exercise-name'); input.value='';
    setTimeout(()=>input.focus(), 100);
    const list = document.getElementById('exercises-list'); list.innerHTML='';
    [...new Set(Storage.getAllExercisesFlat().map(e=>e.name))].sort().forEach(n => {
        const opt = document.createElement('option'); opt.value = n; list.appendChild(opt);
    });
}
function saveNewExercise() {
    const n = document.getElementById('new-exercise-name').value;
    if(n) { 
        const ex = Storage.addExercise(App.currentSeanceId, n, document.getElementById('new-exercise-muscle').value);
        document.getElementById('exercise-modal').classList.remove('active');
        renderExerciseCarousel(Storage.getSeance(App.currentSeanceId));
        selectExerciseInDetail(ex.id);
    }
}

// SÉRIES
function renderSeriesTable(series) {
    const tb = document.getElementById('series-tbody-detail'); tb.innerHTML = '';
    if(series.length===0) series=[{}];
    series.forEach((s,i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="series-select"></td><td>${i+1}</td><td><input type="number" class="reps" value="${s.reps||''}" placeholder="0"></td><td><input type="number" class="kg" value="${s.kg||''}" placeholder="0"></td><td><input type="number" class="repos" value="${(s.repos<10 && s.repos>0)?s.repos*60:(s.repos||'')}" placeholder="s"></td><td><input type="number" class="rir" value="${s.rir||''}" placeholder="-"></td><td><input type="checkbox" class="fait" ${s.fait?'checked':''}></td>`;
        tr.querySelectorAll('input:not(.series-select)').forEach(i => i.onchange = () => { saveSeries(); checkPR(); });
        tr.querySelector('.fait').onchange = (e) => { if(e.target.checked) startTimer(); saveSeries(); };
        tb.appendChild(tr);
    });
}
function saveSeries() {
    const s = [];
    document.querySelectorAll('#series-tbody-detail tr').forEach(tr => {
        s.push({
            reps: parseInt(tr.querySelector('.reps').value)||0, kg: parseFloat(tr.querySelector('.kg').value)||0,
            repos: parseInt(tr.querySelector('.repos').value)||0, rir: parseInt(tr.querySelector('.rir').value)||0,
            fait: tr.querySelector('.fait').checked
        });
    });
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, { comment: document.getElementById('exercise-comment-detail').value, series: s });
}
function addSeries() { 
    const d = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    const last = (d.series && d.series.length) ? d.series[d.series.length-1] : {};
    if(!d.series) d.series=[]; d.series.push({...last, fait:false});
    renderSeriesTable(d.series); saveSeries();
}
function deleteSelectedSeries() {
    const tb = document.getElementById('series-tbody-detail');
    const keep = [];
    const d = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    tb.querySelectorAll('tr').forEach((tr, i) => { if(!tr.querySelector('.series-select').checked && d.series[i]) keep.push(d.series[i]); });
    d.series = keep;
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, d); renderSeriesTable(keep);
}
function checkPR() {
    let isPR = false;
    document.querySelectorAll('#series-tbody-detail tr').forEach(tr => {
        const kg = parseFloat(tr.querySelector('.kg').value);
        if(kg > 0 && Storage.checkIsPR(App.currentExerciseId, kg)) { isPR = true; tr.querySelector('.kg').style.color='#FFD700'; }
        else tr.querySelector('.kg').style.color='';
    });
    document.getElementById('pr-badge').className = isPR ? 'pr-badge' : 'pr-badge hidden';
}

// HISTORIQUE
function loadHistory() {
    const c = document.getElementById('history-timeline'); c.innerHTML='';
    const h = Storage.getExerciseHistory(App.currentSeanceId, App.currentExerciseId);
    if(h.length===0) { c.innerHTML='<p class="empty-history">Pas d\'historique</p>'; return; }
    h.forEach(x => {
        const d = document.createElement('div'); d.className='history-date-item';
        let html = `<div class="history-date-label">${new Date(x.date).toLocaleDateString('fr-FR')}</div><div class="history-series-grid">`;
        x.data.series.forEach((s,i) => html+=`<div class="history-series-row"><span>${i+1}</span><span>${s.reps}x${s.kg}kg</span></div>`);
        d.innerHTML = html+'</div>'; c.appendChild(d);
    });
}

// TIMER & OPTIONS
function toggleTimer() { App.timerInterval ? stopTimer() : startTimer(); }
function startTimer() { document.getElementById('start-timer-btn').classList.add('timer-active'); App.timerStartTime = Date.now() - App.timerElapsed; App.timerInterval = setInterval(() => { App.timerElapsed = Date.now() - App.timerStartTime; const m=Math.floor(App.timerElapsed/60000), s=Math.floor((App.timerElapsed%60000)/1000); document.getElementById('start-timer-btn').innerHTML = `<span class="timer-text">${m}:${s.toString().padStart(2,'0')}</span>`; }, 1000); }
function stopTimer() { clearInterval(App.timerInterval); App.timerInterval=null; document.getElementById('start-timer-btn').classList.remove('timer-active'); document.getElementById('start-timer-btn').innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`; App.timerElapsed=0; }

function showOptionsMenu() {
    const m = document.createElement('div'); m.className='options-menu active';
    m.innerHTML = `<div class="options-menu-content"><div style="text-align:center;color:#666;font-size:12px;margin-bottom:10px">DÉPLACER</div><div style="display:flex;gap:10px;margin-bottom:10px"><button id="mv-l" class="option-item">⬅️ Gauche</button><button id="mv-r" class="option-item">Droite ➡️</button></div><button id="del-ex" class="option-item" style="color:#ef4444">Supprimer</button><button id="canc" class="option-item">Annuler</button></div>`;
    document.body.appendChild(m);
    m.onclick = (e) => {
        const s = Storage.getSeance(App.currentSeanceId); const idx = s.exercises.findIndex(e=>e.id===App.currentExerciseId);
        const exs = [...s.exercises];
        if(e.target.id==='mv-l' && idx>0) { const t=exs[idx]; exs[idx]=exs[idx-1]; exs[idx-1]=t; Storage.reorderExercises(App.currentSeanceId, exs); renderExerciseCarousel({ ...s, exercises: exs }); }
        if(e.target.id==='mv-r' && idx<exs.length-1) { const t=exs[idx]; exs[idx]=exs[idx+1]; exs[idx+1]=t; Storage.reorderExercises(App.currentSeanceId, exs); renderExerciseCarousel({ ...s, exercises: exs }); }
        if(e.target.id==='del-ex' && confirm('Supprimer ?')) { Storage.deleteExercise(App.currentSeanceId, App.currentExerciseId); openSeanceDetail(App.currentSeanceId); }
        if(e.target.tagName==='BUTTON' || e.target===m) m.remove();
    };
}

// IMPORT/EXPORT
function exportData() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Storage.exportData()], {type:'application/json'})); a.download = `sauvegarde_malzou_${new Date().toISOString().split('T')[0]}.json`; a.click(); }
function importDataFile(e) { const r = new FileReader(); r.onload = (evt) => { if(Storage.importData(evt.target.result)) { showNotification('Succès !', 'success'); setTimeout(()=>location.reload(), 1000); } else showNotification('Erreur fichier', 'error'); }; if(e.target.files[0]) r.readAsText(e.target.files[0]); }

function showNotification(m, t='info') { const n = document.createElement('div'); n.className=`notification notification-${t}`; n.textContent=m; document.body.appendChild(n); setTimeout(()=>n.classList.add('show'),10); setTimeout(()=>{n.classList.remove('show'); setTimeout(()=>n.remove(),300)}, 3000); }

// STATS
function initHistoriqueView() { document.getElementById('prev-month').addEventListener('click', ()=>{App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth()-1); renderCalendar();}); document.getElementById('next-month').addEventListener('click', ()=>{App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth()+1); renderCalendar();}); }
function refreshHistoriqueView() {
    document.getElementById('total-sessions').textContent = Storage.getTotalSessionsCount();
    renderCalendar();
    const sel = document.getElementById('chart-exercise-select'); sel.innerHTML = '<option value="" disabled selected>Choisir...</option>';
    [...new Set(Storage.getAllExercisesFlat().map(e=>e.name))].sort().forEach(n => {
        const ex = Storage.getAllExercisesFlat().find(e=>e.name===n);
        const opt = document.createElement('option'); opt.value = ex.id; opt.textContent = n; sel.appendChild(opt);
    });
    sel.onchange = (e) => { App.statsState.selectedExerciseId = e.target.value; updateChart(); };
}
function updateChart() {
    const hist = Storage.getGlobalExerciseHistory(App.statsState.selectedExerciseId);
    const cont = document.getElementById('performance-chart');
    if(hist.length < 2) { cont.innerHTML = '<div class="empty-chart-msg" style="text-align:center;color:#666;padding:20px;">Pas assez de données</div>'; return; }
    
    const vals = hist.map(h => {
        const valid = h.data.series.filter(s=>s.kg>0);
        return App.statsState.metric==='weight' ? Math.max(...valid.map(s=>parseFloat(s.kg)||0)) : valid.reduce((a,b)=>a+(parseFloat(b.kg)*parseInt(b.reps)),0);
    });
    const max = Math.max(...vals); const min = Math.min(...vals)*0.9;
    let path = "";
    vals.forEach((v, i) => {
        const x = 5 + (i/(vals.length-1))*90;
        const y = 100 - 5 - ((v-min)/(max-min || 1))*90;
        path += `${x},${y} `;
    });
    cont.innerHTML = `<svg viewBox="0 0 100 100" class="chart-svg"><polyline fill="none" stroke="#ef4444" stroke-width="2" points="${path}" vector-effect="non-scaling-stroke"/></svg>`;
    
    document.getElementById('chart-stats-summary').classList.remove('hidden');
    document.getElementById('stat-max-val').textContent = max;
    document.getElementById('stat-last-val').textContent = vals[vals.length-1];
    const p = ((vals[vals.length-1]-vals[0])/vals[0])*100;
    const pEl = document.getElementById('stat-progression');
    pEl.textContent = (p>0?'+':'')+p.toFixed(1)+'%';
    pEl.style.color = p>=0?'#22c55e':'#ef4444';
}

function renderCalendar() {
    const m = App.currentCalendarMonth;
    document.getElementById('current-month').textContent = m.toLocaleDateString('fr-FR', {month:'long', year:'numeric'});
    const dates = Storage.getSessionDates();
    const cal = document.getElementById('calendar'); cal.innerHTML = '';
    ['L','M','M','J','V','S','D'].forEach(d => cal.innerHTML += `<div class="calendar-day-header">${d}</div>`);
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const days = new Date(m.getFullYear(), m.getMonth()+1, 0).getDate();
    let start = first.getDay() - 1; if(start === -1) start = 6;
    for(let i=0; i<start; i++) cal.innerHTML += `<div class="calendar-day"></div>`;
    const today = new Date().toISOString().split('T')[0];
    for(let i=1; i<=days; i++) {
        const dStr = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const cls = `calendar-day ${dates.includes(dStr)?'has-session':''} ${dStr===today?'today':''}`;
        cal.innerHTML += `<div class="${cls}">${i}</div>`;
    }
}

function initPerformanceView() {
    document.querySelectorAll('.chart-toggle').forEach(t => t.addEventListener('click', ()=>{
        document.querySelectorAll('.chart-toggle').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        App.statsState.metric = t.dataset.metric;
        updateChart();
    }));
}
