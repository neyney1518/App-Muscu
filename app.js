const App = {
    currentSeanceId: null, currentExerciseId: null, currentSessionId: null,
    currentCalendarMonth: new Date(),
    
    timerInterval: null, timerStartTime: null, timerElapsed: 0, timerState: 'stopped', 
    sessionTimerInterval: null, sessionStartTime: null,

    statsState: { selectedExerciseId: null, metric: 'weight' }, dragState: { dragSrcEl: null }
};
const MUSCLE_ICONS = { default: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>` };

document.addEventListener('DOMContentLoaded', () => {
    initNavigation(); initSeancesListView(); initSeanceDetailView(); initHistoriqueView(); initPerformanceView(); renderSeancesList();
});

// === NAVIGATION ===
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

// === LISTE SÉANCES ===
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
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => { e.stopPropagation(); if(confirm('Supprimer cette séance ?')) { Storage.deleteSeance(s.id); renderSeancesList(); }});
        grid.appendChild(card);
    });
}
function openSeanceModal() { document.getElementById('seance-modal').classList.add('active'); document.getElementById('new-seance-name').value=''; setTimeout(()=>document.getElementById('new-seance-name').focus(), 100); }
function closeSeanceModal() { document.getElementById('seance-modal').classList.remove('active'); }
function saveNewSeance() { const n = document.getElementById('new-seance-name').value.trim(); if(n) { Storage.addSeance(n); closeSeanceModal(); renderSeancesList(); } }

// === DÉTAIL SÉANCE ===
function openSeanceDetail(id) {
    App.currentSeanceId = id;
    const s = Storage.getSeance(id);
    const sess = Storage.getTodaySession(id);
    App.currentSessionId = sess.id;
    document.getElementById('seance-title').textContent = s.name;
    renderExerciseCarousel(s);
    
    const btn = document.getElementById('finish-session-btn');
    btn.textContent = sess.completed ? "Séance terminée (Mettre à jour)" : "Terminer la séance";
    btn.className = sess.completed ? "finish-btn completed-state" : "finish-btn gradient-btn";
    
    startSessionTimer(); 
    restoreRestTimer();
    updateLiveVolume();

    if (s.exercises.length > 0) selectExerciseInDetail(s.exercises[0].id);
    else document.getElementById('exercise-detail-content').classList.add('hidden');
    switchToView('seance-detail-view');
}

function initSeanceDetailView() {
    document.getElementById('back-to-list').addEventListener('click', () => { stopSessionTimer(false); switchToView('seances-list-view'); });
    
    // Ajout exos
    document.getElementById('cancel-exercise-btn').addEventListener('click', () => document.getElementById('exercise-modal').classList.remove('active'));
    document.getElementById('save-exercise-btn').addEventListener('click', saveNewExercise);
    document.getElementById('new-exercise-name').addEventListener('input', handleInputSuggestions);
    document.getElementById('new-exercise-muscle').addEventListener('input', (e) => handleMuscleSuggestions(e, 'muscle-suggestions-container'));
    
    // Edition exos
    document.getElementById('cancel-edit-btn').addEventListener('click', () => document.getElementById('edit-exercise-modal').classList.remove('active'));
    document.getElementById('save-edit-btn').addEventListener('click', saveEditedExercise);
    document.getElementById('edit-exercise-muscle').addEventListener('input', (e) => handleMuscleSuggestions(e, 'edit-muscle-suggestions-container'));

    document.getElementById('add-series-detail-btn').addEventListener('click', addSeries);
    document.querySelector('.btn-delete-series').addEventListener('click', deleteSelectedSeries);
    
    document.getElementById('start-timer-btn').addEventListener('click', handleRestTimerClick);
    document.getElementById('exercise-comment-detail').addEventListener('input', () => saveSeries());
    document.querySelector('.options-btn').addEventListener('click', showOptionsMenu);
    document.getElementById('finish-session-btn').addEventListener('click', () => {
        if(Storage.completeSession(App.currentSessionId)) { 
            showNotification('Validé !', 'success'); 
            stopSessionTimer(true);
            resetRestTimer(true);
            switchToView('seances-list-view'); 
        }
    });
}

function renderExerciseCarousel(seance) {
    const cont = document.getElementById('exercise-carousel-items'); cont.innerHTML = '';
    seance.exercises.forEach((ex, i) => {
        const item = document.createElement('div'); item.className = 'carousel-item';
        
        // NOUVEAU : Application de la classe "Rechange"
        if(ex.isBackup) item.classList.add('is-backup');
        
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
    
    // NOUVEAU : Affichage du badge de rechange
    const seance = Storage.getSeance(App.currentSeanceId);
    const exObj = seance.exercises.find(e => e.id === id);
    if(exObj && exObj.isBackup) {
        document.getElementById('backup-badge').classList.remove('hidden');
    } else {
        document.getElementById('backup-badge').classList.add('hidden');
    }
    
    const d = Storage.getExerciseData(App.currentSessionId, id);
    document.getElementById('exercise-comment-detail').value = d.comment || '';
    renderSeriesTable(d.series || []);
    loadHistory();
    checkPR();
}

// === GESTION EXERCICES (AJOUT & MODIF) ===
function openExerciseModal() {
    document.getElementById('exercise-modal').classList.add('active');
    document.getElementById('new-exercise-name').value = '';
    document.getElementById('new-exercise-muscle').value = ''; 
    document.getElementById('new-exercise-backup').checked = false; // Reset case
    document.getElementById('suggestions-container').innerHTML = ''; 
    document.getElementById('muscle-suggestions-container').innerHTML = '';
    setTimeout(() => document.getElementById('new-exercise-name').focus(), 100);
}

function handleInputSuggestions(e) {
    const val = e.target.value.toLowerCase().trim();
    const container = document.getElementById('suggestions-container');
    container.innerHTML = '';
    if(val.length < 1) { container.classList.add('hidden'); return; }
    
    const all = Storage.getAllExercisesFlat();
    const uniqueNames = [...new Set(all.map(e => e.name))].sort();
    const matches = uniqueNames.filter(n => n.toLowerCase().includes(val));
    
    if(matches.length > 0) {
        container.classList.remove('hidden');
        matches.forEach(name => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = name;
            div.onclick = () => {
                document.getElementById('new-exercise-name').value = name;
                container.innerHTML = ''; container.classList.add('hidden');
            };
            container.appendChild(div);
        });
    } else { container.classList.add('hidden'); }
}

function handleMuscleSuggestions(e, containerId) {
    const val = e.target.value.toLowerCase().trim();
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if(val.length < 1) { container.classList.add('hidden'); return; }
    
    const allMuscles = Storage.getAllMuscleGroups();
    const matches = allMuscles.filter(n => n.toLowerCase().includes(val));
    
    if(matches.length > 0) {
        container.classList.remove('hidden');
        matches.forEach(name => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = name;
            div.onclick = () => {
                e.target.value = name;
                container.innerHTML = ''; container.classList.add('hidden');
            };
            container.appendChild(div);
        });
    } else { container.classList.add('hidden'); }
}

function saveNewExercise() {
    const name = document.getElementById('new-exercise-name').value.trim();
    const muscle = document.getElementById('new-exercise-muscle').value.trim(); 
    const isBackup = document.getElementById('new-exercise-backup').checked; // Checkbox

    if(name) { 
        const ex = Storage.addExercise(App.currentSeanceId, name, muscle, isBackup);
        document.getElementById('exercise-modal').classList.remove('active');
        renderExerciseCarousel(Storage.getSeance(App.currentSeanceId));
        selectExerciseInDetail(ex.id);
        updateLiveVolume();
        showNotification('Exercice ajouté', 'success');
    }
}

function openEditExerciseModal() {
    const ex = Storage.getAllExercisesFlat().find(e => e.id === App.currentExerciseId);
    if(!ex) return;
    
    // Remplissage des données existantes
    document.getElementById('edit-exercise-name').value = ex.name;
    document.getElementById('edit-exercise-muscle').value = ex.muscleGroup || '';
    document.getElementById('edit-exercise-backup').checked = ex.isBackup || false; 
    
    document.getElementById('edit-muscle-suggestions-container').innerHTML = '';
    document.getElementById('edit-exercise-modal').classList.add('active');
}

function saveEditedExercise() {
    const newName = document.getElementById('edit-exercise-name').value.trim();
    const newMuscle = document.getElementById('edit-exercise-muscle').value.trim();
    const isBackup = document.getElementById('edit-exercise-backup').checked;
    
    if(newName) {
        Storage.updateExercise(App.currentExerciseId, newName, newMuscle, isBackup);
        document.getElementById('edit-exercise-modal').classList.remove('active');
        const seance = Storage.getSeance(App.currentSeanceId);
        renderExerciseCarousel(seance);
        selectExerciseInDetail(App.currentExerciseId);
        updateLiveVolume();
        showNotification('Exercice modifié avec succès', 'success');
    }
}

// === SÉRIES ===
function renderSeriesTable(series) {
    const tb = document.getElementById('series-tbody-detail'); tb.innerHTML = '';
    if(series.length===0) series=[{}];
    series.forEach((s,i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="series-select"></td><td>${i+1}</td><td><input type="number" class="reps glass-input" value="${s.reps||''}" placeholder="0"></td><td><input type="number" class="kg glass-input" value="${s.kg||''}" placeholder="0"></td><td><input type="number" class="repos glass-input" value="${(s.repos<10 && s.repos>0)?s.repos*60:(s.repos||'')}" placeholder="s"></td><td><input type="number" class="rir glass-input" value="${s.rir||''}" placeholder="-"></td><td><input type="checkbox" class="fait" ${s.fait?'checked':''}></td>`;
        tr.querySelectorAll('input:not(.series-select)').forEach(i => i.onchange = () => { saveSeries(); checkPR(); });
        tr.querySelector('.fait').onchange = (e) => { 
            if(e.target.checked) { resetRestTimer(true); startRestTimer(); }
            saveSeries(); 
        };
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
    updateLiveVolume();
}
function updateLiveVolume() {
    const sess = Storage.getSessions().find(s => s.id === App.currentSessionId);
    const s = Storage.getSeance(App.currentSeanceId);
    if(!sess || !s) return;
    
    const counts = {};
    if(sess.exercises) {
        Object.keys(sess.exercises).forEach(exId => {
            const exObj = s.exercises.find(e => e.id === exId);
            
            // Si l'exercice est tagué "rechange", on ne le compte pas !
            if(exObj && exObj.isBackup) return;

            let muscle = 'Autre';
            if(exObj && exObj.muscleGroup) muscle = exObj.muscleGroup;
            else {
                const found = Storage.getAllExercisesFlat().find(e => e.id === exId);
                if(found && found.muscleGroup) muscle = found.muscleGroup;
            }
            if(!muscle) muscle = 'Autre';
            
            const series = sess.exercises[exId].series || [];
            const doneCount = series.filter(x => x.fait).length;
            if(doneCount > 0) { counts[muscle] = (counts[muscle] || 0) + doneCount; }
        });
    }
    
    const cont = document.getElementById('live-session-volume');
    if(!cont) return;
    if(Object.keys(counts).length === 0) { cont.innerHTML = ''; return; }
    
    let html = '';
    Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([m, c]) => {
        html += `<span class="vol-tag">${c}x ${m}</span>`;
    });
    cont.innerHTML = html;
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
    updateLiveVolume();
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

function loadHistory() {
    const c = document.getElementById('history-timeline'); c.innerHTML='';
    const h = Storage.getExerciseHistory(App.currentSeanceId, App.currentExerciseId);
    if(h.length===0) { c.innerHTML='<p class="empty-history" style="color:#666; font-size:13px; text-align:center;">Pas d\'historique récent</p>'; return; }
    h.forEach(x => {
        const d = document.createElement('div'); d.className='history-date-item';
        let commentHTML = '';
        if(x.data.comment && x.data.comment.trim() !== '') commentHTML = `<div class="history-comment">📝 ${x.data.comment}</div>`;
        let seriesHTML = `<div class="history-series-grid">`;
        x.data.series.forEach((s,i) => {
            let extras = [];
            if(s.repos) extras.push(`⏱️${(s.repos<10 && s.repos>0)?s.repos*60:s.repos}s`);
            if(s.rir) extras.push(`RIR:${s.rir}`);
            let extraHTML = extras.length > 0 ? `<span class="h-extra">${extras.join(' | ')}</span>` : '';
            seriesHTML += `<div class="history-series-row"><span class="h-num">#${i+1}</span><div class="h-data"><span class="h-main">${s.reps} x ${s.kg}kg</span>${extraHTML}</div></div>`;
        });
        seriesHTML += '</div>';
        d.innerHTML = `<div class="history-date-label">${new Date(x.date).toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'})}</div>${commentHTML}${seriesHTML}`;
        c.appendChild(d);
    });
}

// === CHRONOS INVINCIBLES ===
function restoreRestTimer() {
    const savedState = localStorage.getItem('malzou_rest_state');
    if (savedState === 'running') {
        App.timerStartTime = parseInt(localStorage.getItem('malzou_rest_start') || Date.now());
        App.timerState = 'running';
        if(App.timerInterval) clearInterval(App.timerInterval);
        App.timerInterval = setInterval(() => { App.timerElapsed = Date.now() - App.timerStartTime; updateRestTimerDisplay(); }, 1000);
        document.getElementById('start-timer-btn').classList.add('timer-active');
        document.getElementById('start-timer-btn').style.borderColor = '';
    } else if (savedState === 'paused') {
        App.timerElapsed = parseInt(localStorage.getItem('malzou_rest_elapsed') || 0);
        App.timerState = 'paused';
        updateRestTimerDisplay();
        document.getElementById('start-timer-btn').classList.remove('timer-active');
        document.getElementById('start-timer-btn').style.borderColor = '#f59e0b';
    } else {
        resetRestTimer(false); 
    }
}

function handleRestTimerClick() {
    if(App.timerState === 'running') pauseRestTimer();
    else if (App.timerState === 'paused') resetRestTimer(true);
    else startRestTimer();
}

function startRestTimer() {
    document.getElementById('start-timer-btn').classList.add('timer-active');
    document.getElementById('start-timer-btn').style.borderColor = '';
    App.timerState = 'running';
    App.timerStartTime = Date.now() - App.timerElapsed;
    localStorage.setItem('malzou_rest_state', 'running');
    localStorage.setItem('malzou_rest_start', App.timerStartTime.toString());
    if(App.timerInterval) clearInterval(App.timerInterval);
    App.timerInterval = setInterval(() => { App.timerElapsed = Date.now() - App.timerStartTime; updateRestTimerDisplay(); }, 1000);
}

function pauseRestTimer() {
    if(App.timerInterval) clearInterval(App.timerInterval);
    App.timerState = 'paused';
    localStorage.setItem('malzou_rest_state', 'paused');
    localStorage.setItem('malzou_rest_elapsed', App.timerElapsed.toString());
    document.getElementById('start-timer-btn').classList.remove('timer-active');
    document.getElementById('start-timer-btn').style.borderColor = '#f59e0b';
}

function resetRestTimer(clearStorage = true) {
    if(App.timerInterval) clearInterval(App.timerInterval);
    App.timerInterval = null; App.timerElapsed = 0; App.timerState = 'stopped';
    if (clearStorage) {
        localStorage.removeItem('malzou_rest_state');
        localStorage.removeItem('malzou_rest_start');
        localStorage.removeItem('malzou_rest_elapsed');
    }
    const btn = document.getElementById('start-timer-btn');
    if(btn) {
        btn.classList.remove('timer-active');
        btn.style.borderColor = '';
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    }
}

function updateRestTimerDisplay() {
    const m = Math.floor(App.timerElapsed/60000); const s = Math.floor((App.timerElapsed%60000)/1000);
    document.getElementById('start-timer-btn').innerHTML = `<span class="timer-text">${m}:${s.toString().padStart(2,'0')}</span>`;
}

function startSessionTimer() {
    const display = document.getElementById('session-total-timer');
    if(!display || !App.currentSessionId) return;
    const savedStart = localStorage.getItem('malzou_session_start_' + App.currentSessionId);
    if (savedStart) {
        App.sessionStartTime = parseInt(savedStart);
    } else {
        App.sessionStartTime = Date.now();
        localStorage.setItem('malzou_session_start_' + App.currentSessionId, App.sessionStartTime.toString());
    }
    if(App.sessionTimerInterval) clearInterval(App.sessionTimerInterval);
    App.sessionTimerInterval = setInterval(() => {
        const diff = Date.now() - App.sessionStartTime;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        display.textContent = (h > 0 ? h + ':' : '') + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
    }, 1000);
}

function stopSessionTimer(clearStorage = false) { 
    if(App.sessionTimerInterval) clearInterval(App.sessionTimerInterval);
    App.sessionStartTime = null; 
    const display = document.getElementById('session-total-timer');
    if(display) display.textContent = "00:00";
    if(clearStorage && App.currentSessionId) {
        localStorage.removeItem('malzou_session_start_' + App.currentSessionId);
    }
}

// === OPTIONS MENU ===
function showOptionsMenu() {
    const m = document.createElement('div'); m.className='options-menu active';
    m.innerHTML = `
        <div class="options-menu-content glass-panel">
            <div style="text-align:center;color:#666;font-size:12px;margin-bottom:16px; font-weight:700;">OPTIONS</div>
            <div style="display:flex;gap:10px;margin-bottom:12px">
                <button id="mv-l" class="option-item">⬅️ Gauche</button>
                <button id="mv-r" class="option-item">Droite ➡️</button>
            </div>
            <button id="edit-ex" class="option-item">✏️ Modifier l'exercice</button>
            <button id="del-ex" class="option-item" style="color:#ef4444">🗑️ Supprimer l'exercice</button>
            <button id="canc" class="option-item" style="margin-top:16px; opacity:0.7">Annuler</button>
        </div>`;
    document.body.appendChild(m);
    
    m.onclick = (e) => {
        const btn = e.target.closest('button');
        if (!btn && e.target === m) {
            m.classList.remove('active'); setTimeout(()=>m.remove(), 300);
            return;
        }
        if (!btn) return;

        const s = Storage.getSeance(App.currentSeanceId); 
        const idx = s.exercises.findIndex(ex=>ex.id===App.currentExerciseId);
        const exs = [...s.exercises];
        
        if(btn.id==='mv-l' && idx>0) { const t=exs[idx]; exs[idx]=exs[idx-1]; exs[idx-1]=t; Storage.reorderExercises(App.currentSeanceId, exs); renderExerciseCarousel({ ...s, exercises: exs }); }
        if(btn.id==='mv-r' && idx<exs.length-1) { const t=exs[idx]; exs[idx]=exs[idx+1]; exs[idx+1]=t; Storage.reorderExercises(App.currentSeanceId, exs); renderExerciseCarousel({ ...s, exercises: exs }); }
        if(btn.id==='edit-ex') { openEditExerciseModal(); m.classList.remove('active'); setTimeout(()=>m.remove(), 300); }
        if(btn.id==='del-ex') {
            if(confirm('Supprimer définitivement cet exercice de la séance ?')) { 
                Storage.deleteExercise(App.currentSeanceId, App.currentExerciseId); 
                m.remove(); openSeanceDetail(App.currentSeanceId); 
            }
        }
        if(btn.id==='canc') { m.classList.remove('active'); setTimeout(()=>m.remove(), 300); }
    };
}

function exportData() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Storage.exportData()], {type:'application/json'})); a.download = `sauvegarde_malzou_${new Date().toISOString().split('T')[0]}.json`; a.click(); }
function importDataFile(e) { const r = new FileReader(); r.onload = (evt) => { if(Storage.importData(evt.target.result)) { showNotification('Succès !', 'success'); setTimeout(()=>location.reload(), 1000); } else showNotification('Erreur fichier', 'error'); }; if(e.target.files[0]) r.readAsText(e.target.files[0]); }
function showNotification(m, t='info') { const n = document.createElement('div'); n.className=`notification notification-${t}`; n.textContent=m; document.body.appendChild(n); setTimeout(()=>n.classList.add('show'),10); setTimeout(()=>{n.classList.remove('show'); setTimeout(()=>n.remove(),300)}, 3000); }

// === ANALYSE & GRAPHIQUES ===
function initHistoriqueView() { document.getElementById('prev-month').addEventListener('click', ()=>{App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth()-1); renderCalendar();}); document.getElementById('next-month').addEventListener('click', ()=>{App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth()+1); renderCalendar();}); }

function refreshHistoriqueView() {
    document.getElementById('total-sessions').textContent = Storage.getTotalSessionsCount();
    renderCalendar();
    updateMuscleVolumeChart(); 

    const sel = document.getElementById('chart-exercise-select'); sel.innerHTML = '<option value="" disabled selected>Choisir...</option>';
    [...new Set(Storage.getAllExercisesFlat().map(e=>e.name))].sort().forEach(n => {
        const ex = Storage.getAllExercisesFlat().find(e=>e.name===n);
        const opt = document.createElement('option'); opt.value = ex.id; opt.textContent = n; sel.appendChild(opt);
    });
    sel.onchange = (e) => { App.statsState.selectedExerciseId = e.target.value; updateChart(); };
}

function updateMuscleVolumeChart() {
    const seances = Storage.getSeances();
    const muscleCounts = {};

    seances.forEach(seance => {
        if (!seance.exercises) return;
        seance.exercises.forEach(ex => {
            
            // NOUVEAU : On ignore totalement les exercices "Rechange" pour le calcul du volume !
            if (ex.isBackup) return; 

            let muscle = ex.muscleGroup || 'Autre';
            const history = Storage.getGlobalExerciseHistory(ex.id);
            let nbSeries = 0;
            
            if (history && history.length > 0) {
                history.sort((a, b) => new Date(a.date) - new Date(b.date));
                const lastData = history[history.length - 1].data;
                if (lastData && lastData.series) nbSeries = lastData.series.length;
            } else {
                const sessions = Storage.getSessions();
                const draft = sessions.slice().reverse().find(s => s.seanceId === seance.id && s.exercises && s.exercises[ex.id]);
                if (draft && draft.exercises[ex.id].series) nbSeries = draft.exercises[ex.id].series.length;
            }
            if (nbSeries > 0) muscleCounts[muscle] = (muscleCounts[muscle] || 0) + nbSeries;
        });
    });

    const cont = document.getElementById('muscle-volume-container');
    cont.innerHTML = '';
    const sorted = Object.entries(muscleCounts).sort((a,b) => b[1] - a[1]);
    
    if(sorted.length === 0) { cont.innerHTML = '<div style="color:#666; font-size:13px; text-align:center;">Aucun volume paramétré</div>'; return; }
    const maxSets = sorted[0][1];
    sorted.forEach(([m, c]) => {
        const percent = Math.max(5, (c / maxSets) * 100);
        cont.innerHTML += `<div class="muscle-row"><div class="muscle-name">${m}</div><div class="muscle-bar-wrapper"><div class="muscle-bar-fill" style="width: ${percent}%"></div></div><div class="muscle-count">${c}</div></div>`;
    });
}

function updateChart() {
    const hist = Storage.getGlobalExerciseHistory(App.statsState.selectedExerciseId);
    const cont = document.getElementById('performance-chart');
    if(hist.length < 2) { cont.innerHTML = '<div class="empty-chart-msg" style="text-align:center;color:#666;padding:20px;">Pas assez de données</div>'; return; }
    
    const vals = hist.map(h => {
        const seriesVals = h.data.series.map(s=>parseFloat(s.kg)||0);
        if (seriesVals.length === 0) return 0;
        return App.statsState.metric==='weight' ? Math.max(...seriesVals) : h.data.series.reduce((a,b)=>a+(parseFloat(b.kg||0)*parseInt(b.reps||0)),0);
    });
    const max = Math.max(...vals); const min = Math.min(...vals); const range = (max - min) === 0 ? 10 : (max - min);
    let path = "";
    vals.forEach((v, i) => { const x = 5 + (i/(vals.length-1))*90; const y = 100 - 5 - ((v-min)/range)*90; path += `${x},${y} `; });
    cont.innerHTML = `<svg viewBox="0 0 100 100" class="chart-svg"><polyline fill="none" stroke="#ef4444" stroke-width="2" points="${path}" vector-effect="non-scaling-stroke"/></svg>`;
    document.getElementById('chart-stats-summary').classList.remove('hidden');
    document.getElementById('stat-max-val').textContent = max;
    document.getElementById('stat-last-val').textContent = vals[vals.length-1];
    const prev = vals[0]; const last = vals[vals.length-1];
    let pText = "0%"; let pColor = "#888";
    if (prev === 0) { if (last > 0) { pText = "Nouveau"; pColor = "#22c55e"; } } 
    else { const p = ((last - prev) / prev) * 100; pText = (p>0?'+':'')+p.toFixed(1)+'%'; pColor = p>=0?'#22c55e':'#ef4444'; }
    const pEl = document.getElementById('stat-progression'); pEl.textContent = pText; pEl.style.color = pColor;
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
