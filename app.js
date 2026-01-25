// Application de musculation - Version Premium V1 (Corrigée)

const App = {
    currentSeanceId: null,
    currentExerciseId: null,
    currentSessionId: null,
    currentCalendarMonth: new Date(),
    timerInterval: null,
    timerStartTime: null,
    timerElapsed: 0,
    statsState: {
        selectedExerciseId: null,
        metric: 'weight'
    },
    dragState: {
        dragSrcEl: null
    }
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

// ========== NAVIGATION ==========

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
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        if (viewId === 'historique-view') refreshHistoriqueView();
        else if (viewId === 'seances-list-view') renderSeancesList();
    }
}

// ========== VUE LISTE SÉANCES ==========

function initSeancesListView() {
    document.getElementById('add-seance-header-btn').addEventListener('click', openSeanceModal);
    document.getElementById('cancel-seance-btn').addEventListener('click', closeSeanceModal);
    document.getElementById('save-seance-btn').addEventListener('click', saveNewSeance);
    document.getElementById('new-seance-name').addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNewSeance(); });

    // Paramètres (Import/Export)
    document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input').addEventListener('change', importDataFile);
}

function renderSeancesList() {
    const seances = Storage.getSeances();
    const grid = document.getElementById('seances-grid');
    const emptyMsg = document.getElementById('empty-seances');
    grid.innerHTML = '';
    
    if (seances.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');
    seances.forEach(seance => {
        grid.appendChild(createSeanceCard(seance));
    });
}

function createSeanceCard(seance) {
    const card = document.createElement('div');
    card.className = 'seance-card';
    const exercisesCount = seance.exercises ? seance.exercises.length : 0;
    
    card.innerHTML = `
        <div class="seance-content-wrapper">
            <div class="seance-icon">${MUSCLE_ICONS.default}</div>
            <div class="seance-name">${seance.name}</div>
            <div class="seance-exercises-count">${exercisesCount} exercice${exercisesCount > 1 ? 's' : ''}</div>
        </div>
        <button class="card-delete-btn" title="Supprimer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
    `;
    
    card.querySelector('.seance-content-wrapper').addEventListener('click', () => openSeanceDetail(seance.id));
    card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSeanceFromHome(seance.id);
    });
    return card;
}

function deleteSeanceFromHome(seanceId) {
    if (confirm('Supprimer cette séance ? L\'historique sera conservé.')) {
        Storage.deleteSeance(seanceId);
        renderSeancesList();
        showNotification('Séance supprimée', 'success');
    }
}

function openSeanceModal() {
    document.getElementById('seance-modal').classList.add('active');
    document.getElementById('new-seance-name').value = '';
    setTimeout(() => document.getElementById('new-seance-name').focus(), 100);
}

function closeSeanceModal() { document.getElementById('seance-modal').classList.remove('active'); }

function saveNewSeance() {
    const name = document.getElementById('new-seance-name').value.trim();
    if (!name) return;
    Storage.addSeance(name);
    closeSeanceModal();
    renderSeancesList();
    showNotification('Séance créée', 'success');
}

// ========== VUE DÉTAIL ==========

function openSeanceDetail(seanceId) {
    App.currentSeanceId = seanceId;
    const seance = Storage.getSeance(seanceId);
    const session = Storage.getTodaySession(seanceId);
    App.currentSessionId = session.id;
    
    document.getElementById('seance-title').textContent = seance.name;
    renderExerciseCarousel(seance);
    updateFinishButtonState(session);
    
    if (seance.exercises && seance.exercises.length > 0) {
        selectExerciseInDetail(seance.exercises[0].id);
    } else {
        document.getElementById('exercise-detail-content').classList.add('hidden');
    }
    switchToView('seance-detail-view');
}

function initSeanceDetailView() {
    document.getElementById('back-to-list').addEventListener('click', () => { stopTimer(); switchToView('seances-list-view'); renderSeancesList(); });
    document.getElementById('add-exercise-carousel-btn').addEventListener('click', openExerciseModal);
    document.getElementById('cancel-exercise-btn').addEventListener('click', closeExerciseModal);
    document.getElementById('save-exercise-btn').addEventListener('click', saveNewExercise);
    document.getElementById('new-exercise-name').addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNewExercise(); });
    
    document.getElementById('add-series-detail-btn').addEventListener('click', addSeriesInDetail);
    document.querySelector('.btn-delete-series').addEventListener('click', deleteSelectedSeries);
    document.getElementById('start-timer-btn').addEventListener('click', toggleTimer);
    document.getElementById('exercise-comment-detail').addEventListener('input', saveExerciseCommentDetail);
    document.querySelector('.options-btn').addEventListener('click', showOptionsMenu);
    document.getElementById('finish-session-btn').addEventListener('click', finishCurrentSession);
}

function updateFinishButtonState(session) {
    const btn = document.getElementById('finish-session-btn');
    if (session.completed) {
        btn.textContent = "Séance terminée (Mettre à jour)";
        btn.classList.add('completed-state');
    } else {
        btn.textContent = "Terminer la séance";
        btn.classList.remove('completed-state');
    }
}

function finishCurrentSession() {
    if (!App.currentSessionId) return;
    const session = Storage.completeSession(App.currentSessionId);
    if (session) {
        showNotification('Séance validée !', 'success');
        const btn = document.getElementById('finish-session-btn');
        btn.innerHTML = '✔ Validé';
        btn.style.background = '#22c55e';
        btn.style.borderColor = '#22c55e';
        setTimeout(() => {
            stopTimer();
            switchToView('seances-list-view');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.textContent = 'Terminer la séance';
        }, 800);
    }
}

// ========== EXERCICES & DRAG'N'DROP ==========

function renderExerciseCarousel(seance) {
    const container = document.getElementById('exercise-carousel-items');
    container.innerHTML = '';
    if (!seance.exercises || seance.exercises.length === 0) return;
    
    seance.exercises.forEach((exercise, index) => {
        container.appendChild(createCarouselItem(exercise, index));
    });
}

function createCarouselItem(exercise, index) {
    const item = document.createElement('div');
    item.className = 'carousel-item';
    item.dataset.exerciseId = exercise.id;
    item.dataset.index = index;
    item.draggable = true;
    
    item.innerHTML = `
        <div class="carousel-icon"><div class="carousel-icon-img">${MUSCLE_ICONS.default}</div></div>
        <div class="carousel-label">${exercise.name}</div>
    `;
    item.addEventListener('click', () => selectExerciseInDetail(exercise.id));
    
    // Drag & Drop
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    
    return item;
}

function handleDragStart(e) {
    App.dragState.dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const dragEndEl = this;
    const dragSrcEl = App.dragState.dragSrcEl;
    
    if (dragSrcEl !== dragEndEl) {
        const oldIndex = parseInt(dragSrcEl.dataset.index);
        const newIndex = parseInt(dragEndEl.dataset.index);
        const seance = Storage.getSeance(App.currentSeanceId);
        const exercises = [...seance.exercises];
        const [movedItem] = exercises.splice(oldIndex, 1);
        exercises.splice(newIndex, 0, movedItem);
        Storage.reorderExercises(App.currentSeanceId, exercises);
        renderExerciseCarousel({ ...seance, exercises });
    }
    dragSrcEl.classList.remove('dragging');
    return false;
}

function selectExerciseInDetail(exerciseId) {
    App.currentExerciseId = exerciseId;
    document.getElementById('exercise-detail-content').classList.remove('hidden');
    const items = document.querySelectorAll('.carousel-item');
    items.forEach(item => {
        if (item.dataset.exerciseId === exerciseId) item.classList.add('active');
        else item.classList.remove('active');
    });
    loadExerciseDetailData();
}

function loadExerciseDetailData() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    document.getElementById('exercise-comment-detail').value = data.comment || '';
    renderSeriesTableDetail(data.series || []);
    loadExerciseHistoryDetail(); // C'est ici que ça plantait !
    checkPRVisuals();
}

function saveExerciseCommentDetail() {
    const comment = document.getElementById('exercise-comment-detail').value;
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    data.comment = comment;
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, data);
}

function openExerciseModal() {
    if (!App.currentSeanceId) return;
    document.getElementById('exercise-modal').classList.add('active');
    document.getElementById('new-exercise-name').value = '';
    document.getElementById('new-exercise-muscle').value = '';
    
    // Autocomplétion
    const dataList = document.getElementById('exercises-list');
    dataList.innerHTML = '';
    const allExercises = Storage.getAllExercisesFlat();
    allExercises.sort((a, b) => a.name.localeCompare(b.name));
    allExercises.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex.name;
        dataList.appendChild(option);
    });

    setTimeout(() => document.getElementById('new-exercise-name').focus(), 100);
}

function closeExerciseModal() { document.getElementById('exercise-modal').classList.remove('active'); }

function saveNewExercise() {
    const name = document.getElementById('new-exercise-name').value.trim();
    const muscle = document.getElementById('new-exercise-muscle').value.trim();
    if (!name) return;
    const exercise = Storage.addExercise(App.currentSeanceId, name, muscle);
    closeExerciseModal();
    const seance = Storage.getSeance(App.currentSeanceId);
    renderExerciseCarousel(seance);
    selectExerciseInDetail(exercise.id);
    showNotification('Exercice ajouté', 'success');
}

// ========== SÉRIES ==========

function renderSeriesTableDetail(series) {
    const tbody = document.getElementById('series-tbody-detail');
    tbody.innerHTML = '';
    if (series.length === 0) series = [{}];
    
    series.forEach((s, index) => {
        let displayRepos = s.repos || '';
        if (s.repos && s.repos < 10) displayRepos = s.repos * 60;
        tbody.appendChild(createSeriesRowDetail(index + 1, s, displayRepos));
    });
}

function createSeriesRowDetail(num, data = {}, displayRepos) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="checkbox" class="series-select"></td>
        <td>${num}</td>
        <td><input type="number" class="series-reps" value="${data.reps || ''}" min="0" placeholder="0"></td>
        <td><input type="number" class="series-kg" value="${data.kg || ''}" min="0" step="0.5" placeholder="0"></td>
        <td><input type="number" class="series-repos" value="${displayRepos !== undefined ? displayRepos : ''}" min="0" placeholder="s"></td>
        <td><input type="number" class="series-rir" value="${data.rir || ''}" min="0" max="10" placeholder="-"></td>
        <td><input type="checkbox" class="series-fait" ${data.fait ? 'checked' : ''}></td>
    `;
    
    const inputs = tr.querySelectorAll('input:not(.series-select)');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            saveSeriesDetail();
            checkPRVisuals();
        });
    });

    // Auto-Timer
    const checkbox = tr.querySelector('.series-fait');
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) startTimer();
    });
    
    return tr;
}

function checkPRVisuals() {
    const rows = document.querySelectorAll('#series-tbody-detail tr');
    let isRecord = false;
    rows.forEach(row => {
        const kg = parseFloat(row.querySelector('.series-kg').value) || 0;
        const reps = parseInt(row.querySelector('.series-reps').value) || 0;
        if (kg > 0 && reps > 0) {
            if (Storage.checkIsPR(App.currentExerciseId, kg, reps)) {
                isRecord = true;
                row.querySelector('.series-kg').style.color = '#FFD700'; 
                row.querySelector('.series-kg').style.fontWeight = 'bold';
            } else {
                row.querySelector('.series-kg').style.color = ''; 
                row.querySelector('.series-kg').style.fontWeight = '';
            }
        }
    });
    const badge = document.getElementById('pr-badge');
    isRecord ? badge.classList.remove('hidden') : badge.classList.add('hidden');
}

function addSeriesInDetail() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    if (!data.series) data.series = [];
    let newSerie = {};
    if (data.series.length > 0) {
        const lastSerie = data.series[data.series.length - 1];
        newSerie = { reps: lastSerie.reps, kg: lastSerie.kg, repos: lastSerie.repos, rir: lastSerie.rir, fait: false };
    }
    data.series.push(newSerie);
    renderSeriesTableDetail(data.series);
    saveSeriesDetail();
}

function deleteSelectedSeries() {
    const rows = document.querySelectorAll('#series-tbody-detail tr');
    const selectedIndexes = [];
    rows.forEach((row, index) => {
        if (row.querySelector('.series-select').checked) selectedIndexes.push(index);
    });
    if (selectedIndexes.length === 0) return;
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    data.series = data.series.filter((_, index) => !selectedIndexes.includes(index));
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, data);
    renderSeriesTableDetail(data.series);
}

function saveSeriesDetail() {
    const rows = document.querySelectorAll('#series-tbody-detail tr');
    const series = [];
    rows.forEach(row => {
        const reps = parseInt(row.querySelector('.series-reps').value) || 0;
        const kg = parseFloat(row.querySelector('.series-kg').value) || 0;
        const repos = parseInt(row.querySelector('.series-repos').value) || 0;
        const rir = parseInt(row.querySelector('.series-rir').value) || 0;
        const fait = row.querySelector('.series-fait').checked;
        series.push({ reps, kg, repos, rir, fait });
    });
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    data.series = series;
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, data);
}

// ========== MINUTEUR & OPTIONS ==========

function toggleTimer() { App.timerInterval ? stopTimer() : startTimer(); }
function startTimer() {
    const btn = document.getElementById('start-timer-btn');
    btn.classList.add('timer-active');
    App.timerStartTime = Date.now() - App.timerElapsed;
    App.timerInterval = setInterval(() => {
        App.timerElapsed = Date.now() - App.timerStartTime;
        updateTimerDisplay();
    }, 1000);
}
function stopTimer() {
    if (App.timerInterval) {
        clearInterval(App.timerInterval);
        App.timerInterval = null;
        document.getElementById('start-timer-btn').classList.remove('timer-active');
        if (App.timerElapsed > 0) notifyTimerEnd();
        App.timerElapsed = 0;
        updateTimerDisplay();
    }
}
function updateTimerDisplay() {
    const minutes = Math.floor(App.timerElapsed / 60000);
    const seconds = Math.floor((App.timerElapsed % 60000) / 1000);
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const btn = document.getElementById('start-timer-btn');
    btn.innerHTML = App.timerInterval ? `<span class="timer-text">${display}</span>` : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}
function notifyTimerEnd() {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    showNotification('Repos terminé !', 'success');
}

function showOptionsMenu() {
    const seance = Storage.getSeance(App.currentSeanceId);
    const exercises = seance.exercises;
    const currentIndex = exercises.findIndex(e => e.id === App.currentExerciseId);
    const canMoveLeft = currentIndex > 0;
    const canMoveRight = currentIndex < exercises.length - 1;

    const menu = document.createElement('div');
    menu.className = 'options-menu';
    menu.innerHTML = `
        <div class="options-menu-content">
            <div style="padding: 0 16px 10px; color: #666; font-size: 13px; text-align: center;">OPTIONS</div>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <button class="option-item option-move-left" style="justify-content: center; ${!canMoveLeft ? 'opacity: 0.5; pointer-events: none;' : ''}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg> Gauche
                </button>
                <button class="option-item option-move-right" style="justify-content: center; ${!canMoveRight ? 'opacity: 0.5; pointer-events: none;' : ''}">
                    Droite <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>
            <button class="option-item option-delete-exercise"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Supprimer exercice</button>
            <button class="option-item option-delete-seance"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg> Supprimer séance</button>
            <button class="option-item option-cancel">Annuler</button>
        </div>
    `;
    document.body.appendChild(menu);
    setTimeout(() => menu.classList.add('active'), 10);
    
    menu.addEventListener('click', (e) => {
        if (e.target.closest('.option-move-left')) { moveExercise(-1); closeOptionsMenu(menu); }
        else if (e.target.closest('.option-move-right')) { moveExercise(1); closeOptionsMenu(menu); }
        else if (e.target.closest('.option-delete-exercise')) { deleteCurrentExercise(); closeOptionsMenu(menu); }
        else if (e.target.closest('.option-delete-seance')) { deleteCurrentSeance(); closeOptionsMenu(menu); }
        else if (e.target.closest('.option-cancel')) closeOptionsMenu(menu);
    });
}
function closeOptionsMenu(menu) { menu.classList.remove('active'); setTimeout(() => menu.remove(), 300); }

function moveExercise(direction) {
    const seance = Storage.getSeance(App.currentSeanceId);
    const exercises = [...seance.exercises];
    const currentIndex = exercises.findIndex(e => e.id === App.currentExerciseId);
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    
    const temp = exercises[newIndex];
    exercises[newIndex] = exercises[currentIndex];
    exercises[currentIndex] = temp;
    
    Storage.reorderExercises(App.currentSeanceId, exercises);
    renderExerciseCarousel({ ...seance, exercises });
    const container = document.getElementById('exercise-carousel-items');
    if (container.children[newIndex]) container.children[newIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
}

function deleteCurrentExercise() {
    if (!confirm('Supprimer cet exercice ?')) return;
    Storage.deleteExercise(App.currentSeanceId, App.currentExerciseId);
    const seance = Storage.getSeance(App.currentSeanceId);
    renderExerciseCarousel(seance);
    if (seance.exercises.length > 0) selectExerciseInDetail(seance.exercises[0].id);
    else document.getElementById('exercise-detail-content').classList.add('hidden');
    showNotification('Exercice supprimé', 'success');
}
function deleteCurrentSeance() {
    if (!confirm('Supprimer cette séance ?')) return;
    Storage.deleteSeance(App.currentSeanceId);
    switchToView('seances-list-view');
    renderSeancesList();
    showNotification('Séance supprimée', 'success');
}

// ========== HISTORIQUE DÉTAIL (C'EST LA FONCTION MANQUANTE RAJOUTÉE) ==========

function loadExerciseHistoryDetail() {
    const history = Storage.getExerciseHistory(App.currentSeanceId, App.currentExerciseId);
    const container = document.getElementById('history-timeline');
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-history">Aucun historique validé pour cet exercice</p>';
        return;
    }
    
    container.innerHTML = '';
    
    history.forEach(entry => {
        const item = createHistoryItemDetail(entry);
        container.appendChild(item);
    });
}

function createHistoryItemDetail(entry) {
    const div = document.createElement('div');
    div.className = 'history-date-item';
    const date = new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    const totalVolume = entry.data.series.reduce((acc, s) => acc + ((s.reps||0) * (s.kg||0)), 0);
    const maxWeight = Math.max(...entry.data.series.map(s => parseFloat(s.kg)||0));
    
    let seriesHTML = '';
    entry.data.series.forEach((s, i) => {
        let reposAff = s.repos || 0;
        if (reposAff < 10 && reposAff > 0) reposAff *= 60;
        seriesHTML += `<div class="history-series-row"><span class="history-series-number">${i + 1}</span><span class="history-series-value">${s.reps} x ${s.kg}kg</span><span class="history-series-value">${reposAff}s</span></div>`;
    });
    
    div.innerHTML = `
        <div class="history-date-label" style="display:flex; justify-content:space-between;"><span>${date}</span><span style="font-size:11px; color:#666;">Vol: ${totalVolume}kg | Max: ${maxWeight}kg</span></div>
        <div class="history-series-grid">${seriesHTML}</div>
    `;
    return div;
}

// ========== HISTORIQUE VUE ==========

function initHistoriqueView() {
    document.getElementById('prev-month').addEventListener('click', () => { App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month').addEventListener('click', () => { App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth() + 1); renderCalendar(); });
    renderCalendar();
}
function refreshHistoriqueView() {
    document.getElementById('total-sessions').textContent = Storage.getTotalSessionsCount();
    renderCalendar();
    populateExerciseSelect();
    if (App.statsState.selectedExerciseId) updatePerformanceChart();
}
function renderCalendar() {
    const year = App.currentCalendarMonth.getFullYear();
    const month = App.currentCalendarMonth.getMonth();
    document.getElementById('current-month').textContent = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const sessionDates = Storage.getSessionDates();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = lastDay.getDate();
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(n => calendar.appendChild(Object.assign(document.createElement('div'), {className:'calendar-day-header', textContent:n})));
    for (let i=0; i<startDay; i++) calendar.appendChild(Object.assign(document.createElement('div'), {className:'calendar-day other-month'}));
    const today = new Date().toISOString().split('T')[0];
    for (let day=1; day<=daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr === today) dayDiv.classList.add('today');
        if (sessionDates.includes(dateStr)) dayDiv.classList.add('has-session');
        calendar.appendChild(dayDiv);
    }
}

// ========== STATS & PARAMÈTRES ==========

function initPerformanceView() {
    document.getElementById('chart-exercise-select').addEventListener('change', (e) => { App.statsState.selectedExerciseId = e.target.value; updatePerformanceChart(); });
    document.querySelectorAll('.chart-toggle').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.chart-toggle').forEach(b => b.classList.remove('active'));
        t.classList.add('active');
        App.statsState.metric = t.dataset.metric;
        updatePerformanceChart();
    }));
}
function populateExerciseSelect() {
    const select = document.getElementById('chart-exercise-select');
    while(select.options.length > 1) select.remove(1);
    const all = Storage.getAllExercisesFlat().sort((a,b) => a.name.localeCompare(b.name));
    all.forEach(ex => { const o = document.createElement('option'); o.value = ex.id; o.textContent = ex.name + (ex.muscleGroup ? ` (${ex.muscleGroup})` : ''); select.appendChild(o); });
}
function updatePerformanceChart() {
    const exId = App.statsState.selectedExerciseId;
    if (!exId) return;
    const history = Storage.getGlobalExerciseHistory(exId).sort((a,b) => new Date(a.date) - new Date(b.date));
    const container = document.getElementById('performance-chart');
    const summary = document.getElementById('chart-stats-summary');
    if (history.length < 2) { container.innerHTML = '<div class="empty-chart-msg">Pas assez de données</div>'; summary.classList.add('hidden'); return; }
    
    const points = history.map(h => {
        const valid = h.data.series.filter(s => s.kg > 0);
        let val = 0;
        if (App.statsState.metric === 'weight') val = Math.max(...valid.map(s => parseFloat(s.kg)||0));
        else val = valid.reduce((acc,s) => acc + ((parseInt(s.reps)||0) * (parseFloat(s.kg)||0)), 0);
        return { date: h.date, value: val };
    }).filter(p => p.value > 0);

    container.innerHTML = generateSVGChart(points);
    summary.classList.remove('hidden');
    updateStatsSummary(points, App.statsState.metric);
}
function generateSVGChart(data) {
    const w=100, h=50, p=5;
    const vals = data.map(d=>d.value);
    const min = Math.min(...vals)*0.9, max = Math.max(...vals)*1.1, range = max-min;
    let path = "";
    data.forEach((d,i) => {
        const x = p + (i/(data.length-1))*(w-2*p);
        const y = h - (p + ((d.value-min)/range)*(h-2*p));
        path += `${x},${y} `;
    });
    const circles = data.map((d,i) => {
        const x = p + (i/(data.length-1))*(w-2*p);
        const y = h - (p + ((d.value-min)/range)*(h-2*p));
        return `<circle cx="${x}" cy="${y}" r="2.5" fill="transparent"><title>${d.value}</title></circle><circle cx="${x}" cy="${y}" r="1" fill="#fff" pointer-events="none"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg"><polyline fill="none" stroke="#ef4444" stroke-width="1.5" points="${path}" vector-effect="non-scaling-stroke"/><g>${circles}</g></svg>`;
}
function updateStatsSummary(data, metric) {
    const last = data[data.length-1].value;
    const max = Math.max(...data.map(d=>d.value));
    const prog = ((last - data[0].value)/data[0].value)*100;
    document.getElementById('stat-max-val').textContent = max;
    document.getElementById('stat-last-val').textContent = last;
    const pEl = document.getElementById('stat-progression');
    pEl.textContent = (prog>0?'+':'')+prog.toFixed(1)+'%';
    pEl.style.color = prog>=0?'#22c55e':'#ef4444';
}

function openSettingsModal() { document.getElementById('settings-modal').classList.add('active'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.remove('active'); }
function exportData() {
    const json = Storage.exportData();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], {type:'application/json'}));
    a.download = `backup_musculation_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotification('Sauvegarde téléchargée !', 'success');
}
function importDataFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        if (Storage.importData(e.target.result)) { showNotification('Restauré !', 'success'); setTimeout(() => location.reload(), 1500); }
        else showNotification('Erreur fichier', 'error');
    };
    reader.readAsText(file);
    closeSettingsModal();
}

function showNotification(msg, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}
