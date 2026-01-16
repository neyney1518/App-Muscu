// Application de musculation - Logique principale modernisée et améliorée

// État global
const App = {
    currentSeanceId: null,
    currentExerciseId: null,
    currentSessionId: null,
    currentCalendarMonth: new Date(),
    timerInterval: null,
    timerStartTime: null,
    timerElapsed: 0,
    // État pour les graphiques
    statsState: {
        selectedExerciseId: null,
        metric: 'weight' // 'weight' ou 'volume'
    }
};

// Icônes de groupes musculaires (SVG inline)
const MUSCLE_ICONS = {
    default: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
    legs: `<svg width="36" height="36" viewBox="0 0 100 100" fill="#ef4444"><path d="M30,20 L35,20 L37,60 L40,90 L35,90 L32,60 Z M65,20 L70,20 L68,60 L65,90 L60,90 L63,60 Z M35,20 Q50,15 65,20"/></svg>`,
    arms: `<svg width="36" height="36" viewBox="0 0 100 100" fill="#ef4444"><path d="M50,30 Q45,35 40,45 L35,60 M50,30 Q55,35 60,45 L65,60 M50,25 L50,35"/></svg>`,
    chest: `<svg width="36" height="36" viewBox="0 0 100 100" fill="#ef4444"><path d="M30,30 Q50,40 70,30 L70,60 Q50,55 30,60 Z"/></svg>`,
    back: `<svg width="36" height="36" viewBox="0 0 100 100" fill="#ef4444"><path d="M50,20 L40,35 L35,55 L40,70 L50,75 L60,70 L65,55 L60,35 Z"/></svg>`
};

// ========== INITIALISATION ==========

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSeancesListView();
    initSeanceDetailView();
    initHistoriqueView();
    initPerformanceView(); // Nouvelle init
    renderSeancesList();
});

// ========== NAVIGATION ==========

function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn-modern');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;
            
            if (viewName === 'seances-list') {
                switchToView('seances-list-view');
            } else if (viewName === 'historique' || viewName === 'calendar') {
                switchToView('historique-view');
            }
            
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
        
        if (viewId === 'historique-view') {
            refreshHistoriqueView();
        }
    }
}

// ========== VUE LISTE SÉANCES ==========

function initSeancesListView() {
    document.getElementById('add-seance-header-btn').addEventListener('click', openSeanceModal);
    
    // Modal séance
    document.getElementById('cancel-seance-btn').addEventListener('click', closeSeanceModal);
    document.getElementById('save-seance-btn').addEventListener('click', saveNewSeance);
    
    // Entrée pour créer avec Enter
    document.getElementById('new-seance-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNewSeance();
    });
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
        const card = createSeanceCard(seance);
        grid.appendChild(card);
    });
}

function createSeanceCard(seance) {
    const card = document.createElement('div');
    card.className = 'seance-card';
    
    const icon = MUSCLE_ICONS.default;
    const exercisesCount = seance.exercises ? seance.exercises.length : 0;
    
    card.innerHTML = `
        <div class="seance-icon">${icon}</div>
        <div class="seance-name">${seance.name}</div>
        <div class="seance-exercises-count">${exercisesCount} exercice${exercisesCount > 1 ? 's' : ''}</div>
    `;
    
    card.addEventListener('click', () => openSeanceDetail(seance.id));
    
    return card;
}

function openSeanceDetail(seanceId) {
    App.currentSeanceId = seanceId;
    const seance = Storage.getSeance(seanceId);
    const session = Storage.getTodaySession(seanceId);
    App.currentSessionId = session.id;
    
    document.getElementById('seance-title').textContent = seance.name;
    
    renderExerciseCarousel(seance);
    
    if (seance.exercises && seance.exercises.length > 0) {
        selectExerciseInDetail(seance.exercises[0].id);
    }
    
    switchToView('seance-detail-view');
}

function openSeanceModal() {
    document.getElementById('seance-modal').classList.add('active');
    document.getElementById('new-seance-name').value = '';
    setTimeout(() => document.getElementById('new-seance-name').focus(), 100);
}

function closeSeanceModal() {
    document.getElementById('seance-modal').classList.remove('active');
}

function saveNewSeance() {
    const name = document.getElementById('new-seance-name').value.trim();
    
    if (!name) {
        showNotification('Veuillez entrer un nom pour la séance', 'error');
        return;
    }
    
    Storage.addSeance(name);
    closeSeanceModal();
    renderSeancesList();
    showNotification('Séance créée avec succès', 'success');
}

// ========== VUE DÉTAIL SÉANCE ==========

function initSeanceDetailView() {
    document.getElementById('back-to-list').addEventListener('click', () => {
        stopTimer();
        switchToView('seances-list-view');
        updateNavigation('seances-list');
    });
    
    document.getElementById('add-exercise-carousel-btn').addEventListener('click', openExerciseModal);
    
    // Modal exercice
    document.getElementById('cancel-exercise-btn').addEventListener('click', closeExerciseModal);
    document.getElementById('save-exercise-btn').addEventListener('click', saveNewExercise);
    
    document.getElementById('new-exercise-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNewExercise();
    });
    
    // Boutons d'action
    document.getElementById('add-series-detail-btn').addEventListener('click', addSeriesInDetail);
    document.querySelector('.btn-delete-series').addEventListener('click', deleteSelectedSeries);
    
    // Minuteur
    document.getElementById('start-timer-btn').addEventListener('click', toggleTimer);
    
    // Commentaire avec sauvegarde auto
    document.getElementById('exercise-comment-detail').addEventListener('input', saveExerciseCommentDetail);
    
    // NOTE: Bouton "Voir la fiche" supprimé
    
    // Menu options
    document.querySelector('.options-btn').addEventListener('click', showOptionsMenu);
}

function updateNavigation(viewName) {
    const navButtons = document.querySelectorAll('.nav-btn-modern');
    navButtons.forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function renderExerciseCarousel(seance) {
    const container = document.getElementById('exercise-carousel-items');
    container.innerHTML = '';
    
    if (!seance.exercises || seance.exercises.length === 0) return;
    
    seance.exercises.forEach(exercise => {
        const item = createCarouselItem(exercise);
        container.appendChild(item);
    });
}

function createCarouselItem(exercise) {
    const item = document.createElement('div');
    item.className = 'carousel-item';
    item.dataset.exerciseId = exercise.id;
    
    const icon = MUSCLE_ICONS.default;
    
    item.innerHTML = `
        <div class="carousel-icon">
            <div class="carousel-icon-img">${icon}</div>
        </div>
        <div class="carousel-label">${exercise.name}</div>
    `;
    
    item.addEventListener('click', () => selectExerciseInDetail(exercise.id));
    
    return item;
}

function selectExerciseInDetail(exerciseId) {
    App.currentExerciseId = exerciseId;
    
    const items = document.querySelectorAll('.carousel-item');
    items.forEach(item => {
        if (item.dataset.exerciseId === exerciseId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    loadExerciseDetailData();
}

function loadExerciseDetailData() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    
    document.getElementById('exercise-comment-detail').value = data.comment || '';
    renderSeriesTableDetail(data.series || []);
    loadExerciseHistoryDetail();
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
    setTimeout(() => document.getElementById('new-exercise-name').focus(), 100);
}

function closeExerciseModal() {
    document.getElementById('exercise-modal').classList.remove('active');
}

function saveNewExercise() {
    const name = document.getElementById('new-exercise-name').value.trim();
    const muscle = document.getElementById('new-exercise-muscle').value.trim();
    
    if (!name) {
        showNotification('Veuillez entrer un nom pour l\'exercice', 'error');
        return;
    }
    
    const exercise = Storage.addExercise(App.currentSeanceId, name, muscle);
    closeExerciseModal();
    
    const seance = Storage.getSeance(App.currentSeanceId);
    renderExerciseCarousel(seance);
    selectExerciseInDetail(exercise.id);
    showNotification('Exercice ajouté avec succès', 'success');
}

// ========== GESTION DES SÉRIES ==========

function renderSeriesTableDetail(series) {
    const tbody = document.getElementById('series-tbody-detail');
    tbody.innerHTML = '';
    
    if (series.length === 0) {
        series = [{}];
    }
    
    series.forEach((s, index) => {
        const row = createSeriesRowDetail(index + 1, s);
        tbody.appendChild(row);
    });
}

function createSeriesRowDetail(num, data = {}) {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td><input type="checkbox" class="series-select"></td>
        <td>${num}</td>
        <td><input type="number" class="series-reps" value="${data.reps || ''}" min="0" placeholder="0"></td>
        <td><input type="number" class="series-kg" value="${data.kg || ''}" min="0" step="0.5" placeholder="0"></td>
        <td><input type="number" class="series-repos" value="${data.repos || ''}" min="0" placeholder="0"></td>
        <td><input type="number" class="series-rir" value="${data.rir || ''}" min="0" max="10" placeholder="0"></td>
        <td><input type="checkbox" class="series-fait" ${data.fait ? 'checked' : ''}></td>
    `;
    
    const inputs = tr.querySelectorAll('input:not(.series-select)');
    inputs.forEach(input => {
        input.addEventListener('change', saveSeriesDetail);
    });
    
    return tr;
}

function addSeriesInDetail() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    if (!data.series) data.series = [];
    
    // Pré-remplissage avec les valeurs de la série précédente
    let newSerie = {};
    if (data.series.length > 0) {
        const lastSerie = data.series[data.series.length - 1];
        newSerie = {
            reps: lastSerie.reps || 0,
            kg: lastSerie.kg || 0,
            repos: lastSerie.repos || 0,
            rir: lastSerie.rir || 0,
            fait: false
        };
    }
    
    data.series.push(newSerie);
    renderSeriesTableDetail(data.series);
    saveSeriesDetail();
    
    // Scroll vers la nouvelle série
    setTimeout(() => {
        const tbody = document.getElementById('series-tbody-detail');
        const lastRow = tbody.lastElementChild;
        if (lastRow) {
            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lastRow.classList.add('highlight-row');
            setTimeout(() => lastRow.classList.remove('highlight-row'), 1000);
        }
    }, 100);
}

function deleteSelectedSeries() {
    const rows = document.querySelectorAll('#series-tbody-detail tr');
    const selectedIndexes = [];
    
    rows.forEach((row, index) => {
        if (row.querySelector('.series-select').checked) {
            selectedIndexes.push(index);
        }
    });
    
    if (selectedIndexes.length === 0) {
        showNotification('Sélectionnez au moins une série à supprimer', 'warning');
        return;
    }
    
    if (!confirm(`Supprimer ${selectedIndexes.length} série(s) ?`)) {
        return;
    }
    
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    data.series = data.series.filter((_, index) => !selectedIndexes.includes(index));
    
    Storage.saveExerciseData(App.currentSessionId, App.currentExerciseId, data);
    renderSeriesTableDetail(data.series);
    showNotification(`${selectedIndexes.length} série(s) supprimée(s)`, 'success');
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

// ========== MINUTEUR ==========

function toggleTimer() {
    if (App.timerInterval) {
        stopTimer();
    } else {
        startTimer();
    }
}

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
        
        const btn = document.getElementById('start-timer-btn');
        btn.classList.remove('timer-active');
        
        if (App.timerElapsed > 0) {
            notifyTimerEnd();
        }
        
        App.timerElapsed = 0;
        updateTimerDisplay();
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(App.timerElapsed / 60000);
    const seconds = Math.floor((App.timerElapsed % 60000) / 1000);
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const btn = document.getElementById('start-timer-btn');
    btn.setAttribute('title', display);
    
    // Affichage dans le bouton si actif
    if (App.timerInterval) {
        btn.innerHTML = `<span class="timer-text">${display}</span>`;
    } else {
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
        `;
    }
}

function notifyTimerEnd() {
    // Vibration si disponible
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }
    
    // Notification
    showNotification('Temps de repos terminé !', 'success');
}

// ========== HISTORIQUE DÉTAIL ==========

function loadExerciseHistoryDetail() {
    const history = Storage.getExerciseHistory(App.currentSeanceId, App.currentExerciseId);
    const container = document.getElementById('history-timeline');
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-history">Aucun historique pour cet exercice</p>';
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
    
    const date = new Date(entry.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    let seriesHTML = '';
    entry.data.series.forEach((s, i) => {
        seriesHTML += `
            <div class="history-series-row">
                <span class="history-series-number">${i + 1}</span>
                <span class="history-series-value">${s.reps} reps</span>
                <span class="history-series-value">${s.kg} kg</span>
                <span class="history-series-value">${s.repos}s</span>
                ${s.rir !== undefined ? `<span class="history-series-value">RIR ${s.rir}</span>` : ''}
            </div>
        `;
    });
    
    div.innerHTML = `
        <div class="history-date-label">${date}</div>
        <div class="history-series-grid">${seriesHTML}</div>
    `;
    
    return div;
}

// ========== MENU OPTIONS ==========

function showOptionsMenu() {
    const menu = document.createElement('div');
    menu.className = 'options-menu';
    menu.innerHTML = `
        <div class="options-menu-content">
            <button class="option-item option-delete-exercise">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Supprimer l'exercice
            </button>
            <button class="option-item option-delete-seance">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Supprimer la séance
            </button>
            <button class="option-item option-cancel">Annuler</button>
        </div>
    `;
    
    document.body.appendChild(menu);
    setTimeout(() => menu.classList.add('active'), 10);
    
    menu.addEventListener('click', (e) => {
        if (e.target.closest('.option-delete-exercise')) {
            deleteCurrentExercise();
        } else if (e.target.closest('.option-delete-seance')) {
            deleteCurrentSeance();
        }
        closeOptionsMenu(menu);
    });
}

function closeOptionsMenu(menu) {
    menu.classList.remove('active');
    setTimeout(() => menu.remove(), 300);
}

function deleteCurrentExercise() {
    if (!confirm('Supprimer cet exercice définitivement ?')) return;
    
    Storage.deleteExercise(App.currentSeanceId, App.currentExerciseId);
    
    const seance = Storage.getSeance(App.currentSeanceId);
    renderExerciseCarousel(seance);
    
    if (seance.exercises && seance.exercises.length > 0) {
        selectExerciseInDetail(seance.exercises[0].id);
    } else {
        // Plus d'exercices
        document.getElementById('exercise-carousel-items').innerHTML = '';
        // On pourrait vider les champs ici
    }
    
    showNotification('Exercice supprimé', 'success');
}

function deleteCurrentSeance() {
    if (!confirm('Supprimer cette séance définitivement ?')) return;
    
    Storage.deleteSeance(App.currentSeanceId);
    switchToView('seances-list-view');
    updateNavigation('seances-list');
    renderSeancesList();
    showNotification('Séance supprimée', 'success');
}

// ========== VUE HISTORIQUE ==========

function initHistoriqueView() {
    document.getElementById('prev-month').addEventListener('click', () => {
        App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        App.currentCalendarMonth.setMonth(App.currentCalendarMonth.getMonth() + 1);
        renderCalendar();
    });
    
    renderCalendar();
}

function refreshHistoriqueView() {
    const totalSessions = Storage.getTotalSessionsCount();
    document.getElementById('total-sessions').textContent = totalSessions;
    renderCalendar();
    
    // Rafraîchir les options d'exercices si de nouveaux ont été créés
    populateExerciseSelect();
    
    // Si un exercice est déjà sélectionné, mettre à jour le graph
    if (App.statsState.selectedExerciseId) {
        updatePerformanceChart();
    }
}

function renderCalendar() {
    const year = App.currentCalendarMonth.getFullYear();
    const month = App.currentCalendarMonth.getMonth();
    
    const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('current-month').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    
    const sessionDates = Storage.getSessionDates();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = lastDay.getDate();
    
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    dayNames.forEach(name => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = name;
        calendar.appendChild(header);
    });
    
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = day;
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (dateStr === today) {
            dayDiv.classList.add('today');
        }
        
        if (sessionDates.includes(dateStr)) {
            dayDiv.classList.add('has-session');
        }
        
        calendar.appendChild(dayDiv);
    }
}

// ========== VUE PERFORMANCE (STATS) ==========

function initPerformanceView() {
    const select = document.getElementById('chart-exercise-select');
    select.addEventListener('change', (e) => {
        App.statsState.selectedExerciseId = e.target.value;
        updatePerformanceChart();
    });

    const toggles = document.querySelectorAll('.chart-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggles.forEach(t => t.classList.remove('active'));
            toggle.classList.add('active');
            App.statsState.metric = toggle.dataset.metric;
            updatePerformanceChart();
        });
    });
}

function populateExerciseSelect() {
    const select = document.getElementById('chart-exercise-select');
    // Sauvegarder la sélection actuelle
    const currentVal = select.value;
    
    // Vider sauf la première option
    while (select.options.length > 1) {
        select.remove(1);
    }

    const allExercises = Storage.getAllExercisesFlat();
    
    // Trier par nom
    allExercises.sort((a, b) => a.name.localeCompare(b.name));

    // Grouper par groupe musculaire si besoin, ici liste simple
    allExercises.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex.id; // On utilise l'ID de l'exercice (attention, si même nom mais ID diff, ça apparaît 2 fois. Pour le MVP c'est OK)
        option.textContent = ex.name + (ex.muscleGroup ? ` (${ex.muscleGroup})` : '');
        select.appendChild(option);
    });

    // Restaurer si possible
    if (currentVal) {
        select.value = currentVal;
    }
}

function updatePerformanceChart() {
    const exerciseId = App.statsState.selectedExerciseId;
    const metric = App.statsState.metric;
    const container = document.getElementById('performance-chart');
    const summary = document.getElementById('chart-stats-summary');

    if (!exerciseId) return;

    // Récupérer les données globales (toutes sessions confondues)
    // Comme Storage.getExerciseHistory est lié à une seanceId, on doit scanner toutes les sessions
    const history = Storage.getGlobalExerciseHistory(exerciseId);
    
    if (history.length < 2) {
        container.innerHTML = '<div class="empty-chart-msg">Pas assez de données pour afficher une progression.</div>';
        summary.classList.add('hidden');
        return;
    }

    // Préparer les données pour le graph
    // Trier par date croissante pour le graph
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    const dataPoints = history.map(h => {
        let value = 0;
        if (metric === 'weight') {
            // Poids max soulevé ce jour là sur une série valide
            value = Math.max(...h.data.series.filter(s => s.kg).map(s => parseFloat(s.kg) || 0), 0);
        } else {
            // Tonnage : somme (reps * kg)
            value = h.data.series.reduce((acc, s) => acc + ((parseInt(s.reps)||0) * (parseFloat(s.kg)||0)), 0);
        }
        return { date: h.date, value: value };
    }).filter(p => p.value > 0); // Exclure les sessions vides

    if (dataPoints.length === 0) {
        container.innerHTML = '<div class="empty-chart-msg">Aucune donnée valide trouvée.</div>';
        summary.classList.add('hidden');
        return;
    }

    // Générer le SVG
    const svg = generateSVGChart(dataPoints);
    container.innerHTML = svg;
    summary.classList.remove('hidden');

    // Mettre à jour les stats textuelles
    updateStatsSummary(dataPoints, metric);
}

function generateSVGChart(data) {
    const width = 100; // viewbox units
    const height = 50; // viewbox units
    const padding = 5;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values) * 0.9; // un peu de marge
    const maxVal = Math.max(...values) * 1.1;
    
    const range = maxVal - minVal;

    // Création des points
    let points = "";
    
    data.forEach((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        // Inverser Y car SVG coords (0 en haut)
        const y = height - (padding + ((d.value - minVal) / range) * (height - 2 * padding));
        points += `${x},${y} `;
    });

    const strokeColor = '#ef4444';
    
    return `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
            <polyline fill="none" stroke="${strokeColor}" stroke-width="2" points="${points}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
            ${data.map((d, i) => {
                const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
                const y = height - (padding + ((d.value - minVal) / range) * (height - 2 * padding));
                return `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff" />`;
            }).join('')}
        </svg>
    `;
}

function updateStatsSummary(data, metric) {
    const last = data[data.length - 1].value;
    const max = Math.max(...data.map(d => d.value));
    
    // Calcul progression vs première séance
    const first = data[0].value;
    const prog = ((last - first) / first) * 100;
    const progSign = prog > 0 ? '+' : '';
    
    const unit = metric === 'weight' ? 'kg' : 'kg'; // Volume est aussi en kg (tonnage)

    document.getElementById('stat-max-val').textContent = `${max} ${unit}`;
    document.getElementById('stat-last-val').textContent = `${last} ${unit}`;
    
    const progEl = document.getElementById('stat-progression');
    progEl.textContent = `${progSign}${prog.toFixed(1)}%`;
    progEl.style.color = prog >= 0 ? '#22c55e' : '#ef4444';
}

// ========== NOTIFICATIONS ==========

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}