// Application de musculation - V1 Premium Optimized

const App = {
    currentSeanceId: null,
    currentExerciseId: null,
    currentSessionId: null,
    currentCalendarMonth: new Date(),
    timerInterval: null,
    timerStartTime: null,
    timerElapsed: 0,
    statsState: { selectedExerciseId: null, metric: 'weight' },
    dragState: { dragSrcEl: null }
};

const MUSCLE_ICONS = {
    default: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSeancesListView();
    initSeanceDetailView();
    initHistoriqueView();
    initPerformanceView();
    renderSeancesList();
});

// === NAVIGATION ===
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn-modern');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;
            if (viewName === 'seances-list') switchToView('seances-list-view');
            else if (viewName === 'historique' || viewName === 'calendar') switchToView('historique-view');
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function switchToView(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        if (viewId === 'historique-view') refreshHistoriqueView();
        else if (viewId === 'seances-list-view') renderSeancesList();
    }
}

// === LISTE SÉANCES ===
function initSeancesListView() {
    document.getElementById('add-seance-header-btn').addEventListener('click', openSeanceModal);
    document.getElementById('cancel-seance-btn').addEventListener('click', closeSeanceModal);
    document.getElementById('save-seance-btn').addEventListener('click', saveNewSeance);
    document.getElementById('new-seance-name').addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNewSeance(); });
    
    // Paramètres
    document.getElementById('settings-btn').addEventListener('click', () => document.getElementById('settings-modal').classList.add('active'));
    document.getElementById('close-settings-btn').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('active'));
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input').addEventListener('change', importDataFile);
}

function renderSeancesList() {
    const seances = Storage.getSeances();
    const grid = document.getElementById('seances-grid');
    const emptyMsg = document.getElementById('empty-seances');
    grid.innerHTML = '';
    
    if (seances.length === 0) { emptyMsg.classList.remove('hidden'); return; }
    emptyMsg.classList.add('hidden');
    
    seances.forEach(seance => {
        const card = document.createElement('div');
        card.className = 'seance-card';
        const count = seance.exercises ? seance.exercises.length : 0;
        card.innerHTML = `
            <div class="seance-content-wrapper">
                <div class="seance-icon">${MUSCLE_ICONS.default}</div>
                <div class="seance-name">${seance.name}</div>
                <div class="seance-exercises-count">${count} exercice${count>1?'s':''}</div>
            </div>
            <button class="card-delete-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        `;
        card.querySelector('.seance-content-wrapper').addEventListener('click', () => openSeanceDetail(seance.id));
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteSeanceFromHome(seance.id); });
        grid.appendChild(card);
    });
}

function deleteSeanceFromHome(id) {
    if (confirm('Supprimer cette séance ?')) {
        Storage.deleteSeance(id);
        renderSeancesList();
        showNotification('Séance supprimée', 'success');
    }
}

function openSeanceModal() { document.getElementById('seance-modal').classList.add('active'); setTimeout(() => document.getElementById('new-seance-name').focus(), 100); }
function closeSeanceModal() { document.getElementById('seance-modal').classList.remove('active'); }
function saveNewSeance() {
    const name = document.getElementById('new-seance-name').value.trim();
    if (!name) return;
    Storage.addSeance(name);
    closeSeanceModal();
    renderSeancesList();
}

// === DÉTAIL SÉANCE ===
function openSeanceDetail(seanceId) {
    App.currentSeanceId = seanceId;
    const seance = Storage.getSeance(seanceId);
    const session = Storage.getTodaySession(seanceId);
    App.currentSessionId = session.id;
    
    document.getElementById('seance-title').textContent = seance.name;
    renderExerciseCarousel(seance);
    updateFinishButton(session);
    
    if (seance.exercises && seance.exercises.length > 0) {
        selectExerciseInDetail(seance.exercises[0].id);
    } else {
        document.getElementById('exercise-detail-content').classList.add('hidden');
    }
    switchToView('seance-detail-view');
}

function initSeanceDetailView() {
    document.getElementById('back-to-list').addEventListener('click', () => { stopTimer(); switchToView('seances-list-view'); renderSeancesList(); });
    document.getElementById('cancel-exercise-btn').addEventListener('click', () => document.getElementById('exercise-modal').classList.remove('active'));
    document.getElementById('save-exercise-btn').addEventListener('click', saveNewExercise);
    document.getElementById('add-series-detail-btn').addEventListener('click', addSeries);
    document.querySelector('.btn-delete-series').addEventListener('click', deleteSelectedSeries);
    document.getElementById('start-timer-btn').addEventListener('click', toggleTimer);
    document.getElementById('exercise-comment-detail').addEventListener('input', saveComment);
    document.querySelector('.options-btn').addEventListener('click', showOptionsMenu);
    document.getElementById('finish-session-btn').addEventListener('click', finishSession);
}

function renderExerciseCarousel(seance) {
    const container = document.getElementById('exercise-carousel-items');
    container.innerHTML = '';
    
    if (seance.exercises) {
        seance.exercises.forEach((ex, idx) => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.innerHTML = `<div class="carousel-icon"><div class="carousel-icon-img">${MUSCLE_ICONS.default}</div></div><div class="carousel-label">${ex.name}</div>`;
            item.dataset.id = ex.id;
            item.addEventListener('click', () => selectExerciseInDetail(ex.id));
            if (ex.id === App.currentExerciseId) item.classList.add('active');
            container.appendChild(item);
        });
    }
    
    // Bouton AJOUTER à la fin
    const addBtn = document.createElement('div');
    addBtn.className = 'carousel-item';
    addBtn.innerHTML = `<div class="carousel-add-btn">+</div><div class="carousel-label">Ajouter</div>`;
    addBtn.addEventListener('click', openExerciseModal);
    container.appendChild(addBtn);
}

function selectExerciseInDetail(exId) {
    App.currentExerciseId = exId;
    document.getElementById('exercise-detail-content').classList.remove('hidden');
    
    // Mise à jour visuelle carrousel
    document.querySelectorAll('.carousel-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === exId);
    });
    
    loadExerciseDetailData();
}

function loadExerciseDetailData() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    document.getElementById('exercise-comment-detail').value = data.comment || '';
    renderSeriesTable(data.series || []);
    loadExerciseHistoryDetail();
    checkPRVisuals();
}

function openExerciseModal() {
    document.getElementById('exercise-modal').classList.add('active');
    document.getElementById('new-exercise-name').value = '';
    
    // Autocomplétion
    const list = document.getElementById('exercises-list');
    list.innerHTML = '';
    const all = Storage.getAllExercisesFlat();
    // Supprimer doublons de noms pour la liste
    const unique = [...new Set(all.map(e => e.name))].sort();
    unique.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        list.appendChild(opt);
    });
    setTimeout(() => document.getElementById('new-exercise-name').focus(), 100);
}

function saveNewExercise() {
    const name = document.getElementById('new-exercise-name').value.trim();
    const muscle = document.getElementById('new-exercise-muscle').value.trim();
    if (!name) return;
    const ex = Storage.addExercise(App.currentSeanceId, name, muscle);
    document.getElementById('exercise-modal').classList.remove('active');
    renderExerciseCarousel(Storage.getSeance(App.currentSeanceId));
    selectExerciseInDetail(ex.id);
}

// === SÉRIES ===
function renderSeriesTable(series) {
    const tbody = document.getElementById('series-tbody-detail');
    tbody.innerHTML = '';
    if (!series.length) series = [{}];
    series.forEach((s, i) => tbody.appendChild(createSeriesRow(i+1, s)));
}

function createSeriesRow(num, data) {
    const tr = document.createElement('tr');
    // Conversion minutes -> secondes si < 10 pour l'affichage
    let repos = data.repos || '';
    if (repos && repos < 10) repos = repos * 60;
    
    tr.innerHTML = `
        <td><input type="checkbox" class="series-select"></td>
        <td>${num}</td>
        <td><input type="number" class="series-reps" value="${data.reps||''}" placeholder="0"></td>
        <td><input type="number" class="series-kg" value="${data.kg||''}" step="0.5" placeholder="0"></td>
        <td><input type="number" class="series-repos" value="${repos}" placeholder="s"></td>
        <td><input type="number" class="series-rir" value="${data.rir||''}" placeholder="-"></td>
        <td><input type="checkbox" class="series-fait" ${data.fait?'checked':''}></td>
    `;
    
    tr.querySelectorAll('input:not(.series-select)').forEach(inpt => {
        inpt.addEventListener('change', () => { saveSeries(); checkPRVisuals(); });
    });
    
    // Auto-Timer
    const chk = tr.querySelector('.series-fait');
    chk.addEventListener('change', () => { if (chk.checked) startTimer(); });
    
    return tr;
}

function saveSeries() {
    const series = [];
    document.querySelectorAll('#series-tbody-detail tr').forEach(tr => {
        series.push({
            reps: parseInt(tr.querySelector('.series-reps').value)||0,
            kg: parseFloat(tr.querySelector('.series-kg').value)||0,
            repos: parseInt(tr.querySelector('.series-repos').value)||0,
            rir: parseInt(tr.querySelector('.series-rir').value)||0,
            fait: tr.querySelector('.series-fait').checked
        });
    });
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, {
        comment: document.getElementById('exercise-comment-detail').value,
        series: series
    });
}

function addSeries() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    let newS = {};
    if (data.series && data.series.length > 0) {
        const last = data.series[data.series.length-1];
        newS = { ...last, fait: false };
    }
    if (!data.series) data.series = [];
    data.series.push(newS);
    renderSeriesTable(data.series);
    saveSeries();
}

function deleteSelectedSeries() {
    const rows = document.querySelectorAll('#series-tbody-detail tr');
    let keep = [];
    rows.forEach((tr, i) => {
        if (!tr.querySelector('.series-select').checked) {
            // On doit récupérer les données brutes stockées, pas juste l'index
            // Simplification: on recharge et filtre
            const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
            if (data.series[i]) keep.push(data.series[i]);
        }
    });
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, {
        comment: document.getElementById('exercise-comment-detail').value,
        series: keep
    });
    renderSeriesTable(keep);
}

function saveComment() { saveSeries(); }

function checkPRVisuals() {
    const badge = document.getElementById('pr-badge');
    let isPR = false;
    document.querySelectorAll('#series-tbody-detail tr').forEach(tr => {
        const kg = parseFloat(tr.querySelector('.series-kg').value)||0;
        if (kg > 0 && Storage.checkIsPR(App.currentExerciseId, kg)) {
            isPR = true;
            tr.querySelector('.series-kg').style.color = '#FFD700';
            tr.querySelector('.series-kg').style.fontWeight = 'bold';
        } else {
            tr.querySelector('.series-kg').style.color = '';
            tr.querySelector('.series-kg').style.fontWeight = '';
        }
    });
    isPR ? badge.classList.remove('hidden') : badge.classList.add('hidden');
}

// === HISTORIQUE (LA FONCTION QUI MANQUAIT) ===
function loadExerciseHistoryDetail() {
    const cont = document.getElementById('history-timeline');
    if (!cont) return;
    const history = Storage.getExerciseHistory(App.currentSeanceId, App.currentExerciseId);
    
    if (history.length === 0) {
        cont.innerHTML = '<p class="empty-history">Aucun historique validé</p>';
        return;
    }
    cont.innerHTML = '';
    history.forEach(h => {
        const div = document.createElement('div');
        div.className = 'history-date-item';
        const date = new Date(h.date).toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'});
        
        let html = `<div class="history-date-label">${date}</div><div class="history-series-grid">`;
        h.data.series.forEach((s, i) => {
            let repos = s.repos||0;
            if (repos<10 && repos>0) repos*=60;
            html += `<div class="history-series-row">
                <span class="history-series-number">${i+1}</span>
                <span class="history-series-value">${s.reps}x${s.kg}</span>
                <span class="history-series-value">${repos}s</span>
            </div>`;
        });
        html += '</div>';
        div.innerHTML = html;
        cont.appendChild(div);
    });
}

// === FIN SÉANCE ===
function updateFinishButton(session) {
    const btn = document.getElementById('finish-session-btn');
    if (session.completed) {
        btn.textContent = "Séance terminée (Mettre à jour)";
        btn.classList.add('completed-state');
    } else {
        btn.textContent = "Terminer la séance";
        btn.classList.remove('completed-state');
    }
}

function finishSession() {
    if (App.currentSessionId) {
        Storage.completeSession(App.currentSessionId);
        showNotification('Séance validée !', 'success');
        const btn = document.getElementById('finish-session-btn');
        btn.style.background = '#22c55e';
        setTimeout(() => { switchToView('seances-list-view'); btn.style.background=''; }, 800);
    }
}

// === OPTIONS (DÉPLACEMENT) ===
function showOptionsMenu() {
    const seance = Storage.getSeance(App.currentSeanceId);
    const idx = seance.exercises.findIndex(e => e.id === App.currentExerciseId);
    const canL = idx > 0;
    const canR = idx < seance.exercises.length - 1;
    
    const menu = document.createElement('div');
    menu.className = 'options-menu';
    menu.innerHTML = `
        <div class="options-menu-content">
            <div style="text-align:center;color:#666;font-size:12px;margin-bottom:10px">DÉPLACER</div>
            <div style="display:flex;gap:10px;margin-bottom:10px">
                <button class="option-item move-l" style="justify-content:center;${!canL?'opacity:0.3':''}">⬅️ Gauche</button>
                <button class="option-item move-r" style="justify-content:center;${!canR?'opacity:0.3':''}">Droite ➡️</button>
            </div>
            <button class="option-item del-ex" style="color:#ef4444">Supprimer exercice</button>
            <button class="option-item del-seance" style="color:#ef4444">Supprimer séance</button>
            <button class="option-item cancel">Annuler</button>
        </div>
    `;
    document.body.appendChild(menu);
    setTimeout(()=>menu.classList.add('active'),10);
    
    menu.addEventListener('click', (e) => {
        if (e.target.classList.contains('move-l') && canL) moveEx(-1);
        if (e.target.classList.contains('move-r') && canR) moveEx(1);
        if (e.target.classList.contains('del-ex')) deleteCurrentEx();
        if (e.target.classList.contains('del-seance')) deleteCurrentSeance();
        if (e.target.classList.contains('cancel') || e.target === menu) {
            menu.classList.remove('active'); setTimeout(()=>menu.remove(),300);
        }
    });
    
    function moveEx(dir) {
        const exs = [...seance.exercises];
        const tmp = exs[idx];
        exs[idx] = exs[idx+dir];
        exs[idx+dir] = tmp;
        Storage.reorderExercises(App.currentSeanceId, exs);
        renderExerciseCarousel({ ...seance, exercises: exs });
        menu.click(); // Close
    }
}

function deleteCurrentEx() {
    if(confirm('Supprimer ?')) {
        Storage.deleteExercise(App.currentSeanceId, App.currentExerciseId);
        openSeanceDetail(App.currentSeanceId);
    }
}
function deleteCurrentSeance() {
    if(confirm('Supprimer séance ?')) {
        Storage.deleteSeance(App.currentSeanceId);
        switchToView('seances-list-view');
        renderSeancesList();
    }
}

// === MINUTEUR ===
function toggleTimer() { App.timerInterval ? stopTimer() : startTimer(); }
function startTimer() {
    document.getElementById('start-timer-btn').classList.add('timer-active');
    App.timerStartTime = Date.now() - App.timerElapsed;
    App.timerInterval = setInterval(() => {
        App.timerElapsed = Date.now() - App.timerStartTime;
        const min = Math.floor(App.timerElapsed/60000);
        const sec = Math.floor((App.timerElapsed%60000)/1000);
        document.getElementById('start-timer-btn').innerHTML = `<span class="timer-text">${min}:${sec.toString().padStart(2,'0')}</span>`;
    }, 1000);
}
function stopTimer() {
    if(App.timerInterval) {
        clearInterval(App.timerInterval); App.timerInterval = null;
        document.getElementById('start-timer-btn').classList.remove('timer-active');
        document.getElementById('start-timer-btn').innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        if(App.timerElapsed > 0) showNotification('Repos terminé', 'success');
        App.timerElapsed = 0;
    }
}

// === IMPORT/EXPORT ===
function exportData() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Storage.exportData()], {type:'application/json'}));
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}
function importDataFile(e) {
    const r = new FileReader();
    r.onload = (evt) => {
        if(Storage.importData(evt.target.result)) { showNotification('Succès !', 'success'); setTimeout(()=>location.reload(), 1000); }
        else showNotification('Erreur fichier', 'error');
    };
    if(e.target.files[0]) r.readAsText(e.target.files[0]);
}

// === VUE HISTORIQUE & STATS ===
function initHistoriqueView() {
    document.getElementById('prev-month').addEventListener('click', ()=>{App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth()-1); renderCalendar();});
    document.getElementById('next-month').addEventListener('click', ()=>{App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth()+1); renderCalendar();});
}
function refreshHistoriqueView() {
    document.getElementById('total-sessions').textContent = Storage.getTotalSessionsCount();
    renderCalendar();
    
    // Stats
    const sel = document.getElementById('chart-exercise-select');
    sel.innerHTML = '<option value="" disabled selected>Choisir...</option>';
    const all = Storage.getAllExercisesFlat();
    [...new Set(all.map(e=>e.name))].sort().forEach(n => {
        const ex = all.find(e=>e.name===n);
        const opt = document.createElement('option'); opt.value = ex.id; opt.textContent = n; sel.appendChild(opt);
    });
    
    sel.onchange = (e) => {
        App.statsState.selectedExerciseId = e.target.value;
        updateChart();
    };
}
function updateChart() {
    const hist = Storage.getGlobalExerciseHistory(App.statsState.selectedExerciseId);
    const cont = document.getElementById('performance-chart');
    if(hist.length < 2) { cont.innerHTML = '<div class="empty-chart-msg">Pas assez de données</div>'; return; }
    
    // Génération SVG simple
    const vals = hist.map(h => Math.max(...h.data.series.map(s=>parseFloat(s.kg)||0)));
    const max = Math.max(...vals); const min = Math.min(...vals)*0.9;
    let path = "";
    vals.forEach((v, i) => {
        const x = 5 + (i/(vals.length-1))*90;
        const y = 50 - 5 - ((v-min)/(max-min || 1))*40;
        path += `${x},${y} `;
    });
    cont.innerHTML = `<svg viewBox="0 0 100 50" class="chart-svg"><polyline fill="none" stroke="#ef4444" stroke-width="2" points="${path}"/></svg>`;
    
    // Stats textuelles
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
    const cal = document.getElementById('calendar');
    cal.innerHTML = '';
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

// === PERFORMANCE & INIT ===
function initPerformanceView() {
    document.querySelectorAll('.chart-toggle').forEach(t => t.addEventListener('click', ()=>{
        document.querySelectorAll('.chart-toggle').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        App.statsState.metric = t.dataset.metric;
        updateChart();
    }));
}

function showNotification(msg, type='info') {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(()=>n.classList.add('show'),10);
    setTimeout(()=>{n.classList.remove('show'); setTimeout(()=>n.remove(),300)}, 3000);
}
