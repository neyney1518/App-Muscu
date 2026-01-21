// Application de musculation - Logique principale
// Version Finale avec Fin de Séance, Drag&Drop, Graphiques & Rétrocompatibilité

// État global de l'application
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
    },
    // État pour le Drag & Drop
    dragState: {
        dragSrcEl: null
    }
};

// Icône par défaut
const MUSCLE_ICONS = {
    default: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`
};

// ========== INITIALISATION ==========

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
        } else if (viewId === 'seances-list-view') {
            renderSeancesList();
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
    
    // Structure HTML modifiée pour inclure le bouton de suppression
    card.innerHTML = `
        <div class="seance-content-wrapper">
            <div class="seance-icon">${icon}</div>
            <div class="seance-name">${seance.name}</div>
            <div class="seance-exercises-count">${exercisesCount} exercice${exercisesCount > 1 ? 's' : ''}</div>
        </div>
        <button class="card-delete-btn" title="Supprimer la séance">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    `;
    
    // Clic sur la partie principale -> Ouvrir
    card.querySelector('.seance-content-wrapper').addEventListener('click', () => openSeanceDetail(seance.id));
    
    // Clic sur poubelle -> Supprimer
    card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Empêcher l'ouverture de la séance
        deleteSeanceFromHome(seance.id);
    });
    
    return card;
}

function deleteSeanceFromHome(seanceId) {
    if (confirm('Voulez-vous vraiment supprimer cette séance et ses exercices ? L\'historique sera conservé.')) {
        Storage.deleteSeance(seanceId);
        renderSeancesList();
        showNotification('Séance supprimée', 'success');
    }
}

function openSeanceDetail(seanceId) {
    App.currentSeanceId = seanceId;
    const seance = Storage.getSeance(seanceId);
    
    // Création ou récupération de la session du jour (brouillon tant que pas validée)
    const session = Storage.getTodaySession(seanceId);
    App.currentSessionId = session.id;
    
    document.getElementById('seance-title').textContent = seance.name;
    
    renderExerciseCarousel(seance);
    
    // Mise à jour de l'état du bouton "Fin de séance"
    updateFinishButtonState(session);
    
    // Sélectionner le premier exercice s'il y en a
    if (seance.exercises && seance.exercises.length > 0) {
        selectExerciseInDetail(seance.exercises[0].id);
    } else {
        // Masquer le contenu détail si pas d'exercice
        document.getElementById('exercise-detail-content').classList.add('hidden');
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
        showNotification('Veuillez entrer un nom', 'error');
        return;
    }
    
    Storage.addSeance(name);
    closeSeanceModal();
    renderSeancesList();
    showNotification('Séance créée', 'success');
}

// ========== VUE DÉTAIL SÉANCE ==========

function initSeanceDetailView() {
    document.getElementById('back-to-list').addEventListener('click', () => {
        stopTimer();
        switchToView('seances-list-view');
        // Rafraîchir la liste au retour pour voir les changements potentiels
        renderSeancesList();
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
    
    // Commentaire
    document.getElementById('exercise-comment-detail').addEventListener('input', saveExerciseCommentDetail);
    
    // Menu options
    document.querySelector('.options-btn').addEventListener('click', showOptionsMenu);

    // NOUVEAU : Bouton Fin de séance
    document.getElementById('finish-session-btn').addEventListener('click', finishCurrentSession);
}

// --- LOGIQUE FIN DE SÉANCE ---

function updateFinishButtonState(session) {
    const btn = document.getElementById('finish-session-btn');
    
    if (session.completed) {
        // Si déjà terminée aujourd'hui
        btn.textContent = "Séance terminée (Mettre à jour)";
        btn.classList.add('completed-state');
    } else {
        // Si pas encore terminée
        btn.textContent = "Terminer la séance";
        btn.classList.remove('completed-state');
    }
}

function finishCurrentSession() {
    if (!App.currentSessionId) return;
    
    // Appel à Storage pour valider
    const session = Storage.completeSession(App.currentSessionId);
    
    if (session) {
        showNotification('Séance validée et enregistrée !', 'success');
        
        // Effet visuel immédiat
        const btn = document.getElementById('finish-session-btn');
        btn.innerHTML = '✔ Validé';
        btn.style.background = '#22c55e';
        btn.style.borderColor = '#22c55e';
        
        // Retour à la liste après un court délai
        setTimeout(() => {
            stopTimer();
            switchToView('seances-list-view');
            // Reset du bouton pour la prochaine fois
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.textContent = 'Terminer la séance';
        }, 800);
    }
}

// --- LOGIQUE CARROUSEL & DRAG'N'DROP ---

function renderExerciseCarousel(seance) {
    const container = document.getElementById('exercise-carousel-items');
    container.innerHTML = '';
    
    if (!seance.exercises || seance.exercises.length === 0) return;
    
    seance.exercises.forEach((exercise, index) => {
        const item = createCarouselItem(exercise, index);
        container.appendChild(item);
    });
}

function createCarouselItem(exercise, index) {
    const item = document.createElement('div');
    item.className = 'carousel-item';
    item.dataset.exerciseId = exercise.id;
    item.dataset.index = index; // Important pour le tri
    
    // Attributs pour le Drag & Drop
    item.draggable = true;
    
    const icon = MUSCLE_ICONS.default;
    
    item.innerHTML = `
        <div class="carousel-icon">
            <div class="carousel-icon-img">${icon}</div>
        </div>
        <div class="carousel-label">${exercise.name}</div>
    `;
    
    // Clic simple pour sélectionner
    item.addEventListener('click', () => selectExerciseInDetail(exercise.id));
    
    // Ajout des événements Drag & Drop
    addDragEvents(item);
    
    return item;
}

function addDragEvents(item) {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    // Note: Pour le mobile pur, le drag'n'drop natif HTML5 commence à être bien supporté.
    // Si besoin d'une librairie tactile spécifique, on pourrait l'ajouter plus tard,
    // mais restons sur du Vanilla JS léger.
}

function handleDragStart(e) {
    App.dragState.dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault(); // Nécessaire pour permettre le drop
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const dragEndEl = this;
    const dragSrcEl = App.dragState.dragSrcEl;
    
    if (dragSrcEl !== dragEndEl) {
        // 1. Récupérer les index
        const oldIndex = parseInt(dragSrcEl.dataset.index);
        const newIndex = parseInt(dragEndEl.dataset.index);
        
        // 2. Mettre à jour les données
        const seance = Storage.getSeance(App.currentSeanceId);
        const exercises = [...seance.exercises];
        
        // Déplacer l'élément dans le tableau
        const [movedItem] = exercises.splice(oldIndex, 1);
        exercises.splice(newIndex, 0, movedItem);
        
        // 3. Sauvegarder
        Storage.reorderExercises(App.currentSeanceId, exercises);
        
        // 4. Rafraîchir l'affichage
        renderExerciseCarousel({ ...seance, exercises });
    }
    
    dragSrcEl.classList.remove('dragging');
    return false;
}

function selectExerciseInDetail(exerciseId) {
    App.currentExerciseId = exerciseId;
    
    // Afficher le conteneur s'il était caché
    document.getElementById('exercise-detail-content').classList.remove('hidden');
    
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
        showNotification('Veuillez entrer un nom', 'error');
        return;
    }
    
    const exercise = Storage.addExercise(App.currentSeanceId, name, muscle);
    closeExerciseModal();
    
    const seance = Storage.getSeance(App.currentSeanceId);
    renderExerciseCarousel(seance);
    selectExerciseInDetail(exercise.id);
    showNotification('Exercice ajouté', 'success');
}

// ========== GESTION DES SÉRIES (AMÉLIORÉE) ==========

function renderSeriesTableDetail(series) {
    const tbody = document.getElementById('series-tbody-detail');
    tbody.innerHTML = '';
    
    if (series.length === 0) {
        series = [{}];
    }
    
    series.forEach((s, index) => {
        // --- LOGIQUE RÉTROCOMPATIBILITÉ REPOS ---
        // Si < 10, c'était probablement des minutes -> afficher en secondes
        // Si >= 10, c'est déjà des secondes
        let displayRepos = s.repos || '';
        if (s.repos && s.repos < 10) {
            displayRepos = s.repos * 60; 
        }

        const row = createSeriesRowDetail(index + 1, s, displayRepos);
        tbody.appendChild(row);
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
        input.addEventListener('change', saveSeriesDetail);
    });
    
    return tr;
}

function addSeriesInDetail() {
    const data = Storage.getExerciseData(App.currentSessionId, App.currentExerciseId);
    if (!data.series) data.series = [];
    
    // Pré-remplissage intelligent
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
    
    // Scroll auto
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
        showNotification('Aucune série sélectionnée', 'warning');
        return;
    }
    
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
        // On sauvegarde directement la valeur en secondes entrée par l'utilisateur
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
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }
    showNotification('Temps de repos terminé !', 'success');
}

// ========== HISTORIQUE DÉTAIL ==========

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
    
    const date = new Date(entry.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
    });
    
    let seriesHTML = '';
    entry.data.series.forEach((s, i) => {
        // Affichage conversion repos minutes -> secondes si besoin
        let reposAff = s.repos || 0;
        if (reposAff < 10 && reposAff > 0) reposAff *= 60;

        seriesHTML += `
            <div class="history-series-row">
                <span class="history-series-number">${i + 1}</span>
                <span class="history-series-value">${s.reps} x ${s.kg}kg</span>
                <span class="history-series-value">${reposAff}s</span>
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

// ========== MENU OPTIONS (Modifié avec déplacement) ==========

function showOptionsMenu() {
    // On vérifie si on peut bouger l'exercice (s'il n'est pas tout seul)
    const seance = Storage.getSeance(App.currentSeanceId);
    const exercises = seance.exercises;
    const currentIndex = exercises.findIndex(e => e.id === App.currentExerciseId);
    
    // On désactive les boutons si on est au bord
    const canMoveLeft = currentIndex > 0;
    const canMoveRight = currentIndex < exercises.length - 1;

    const menu = document.createElement('div');
    menu.className = 'options-menu';
    menu.innerHTML = `
        <div class="options-menu-content">
            <div class="menu-header" style="padding: 0 16px 10px; color: #666; font-size: 13px; text-align: center;">OPTIONS EXERCICE</div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <button class="option-item option-move-left" style="justify-content: center; ${!canMoveLeft ? 'opacity: 0.5; pointer-events: none;' : ''}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                    Gauche
                </button>
                <button class="option-item option-move-right" style="justify-content: center; ${!canMoveRight ? 'opacity: 0.5; pointer-events: none;' : ''}">
                    Droite
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>

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
        if (e.target.closest('.option-move-left')) {
            moveExercise(-1);
            closeOptionsMenu(menu);
        } else if (e.target.closest('.option-move-right')) {
            moveExercise(1);
            closeOptionsMenu(menu);
        } else if (e.target.closest('.option-delete-exercise')) {
            deleteCurrentExercise();
            closeOptionsMenu(menu);
        } else if (e.target.closest('.option-delete-seance')) {
            deleteCurrentSeance();
            closeOptionsMenu(menu);
        } else if (e.target.closest('.option-cancel')) {
            closeOptionsMenu(menu);
        }
    });
}

function closeOptionsMenu(menu) {
    menu.classList.remove('active');
    setTimeout(() => menu.remove(), 300);
}

// NOUVELLE FONCTION : Déplacer l'exercice
function moveExercise(direction) {
    const seance = Storage.getSeance(App.currentSeanceId);
    const exercises = [...seance.exercises]; // Copie pour manipuler
    const currentIndex = exercises.findIndex(e => e.id === App.currentExerciseId);
    
    if (currentIndex === -1) return;

    // Calcul du nouvel index
    const newIndex = currentIndex + direction;

    // Vérification des limites (même si géré visuellement, sécurité en plus)
    if (newIndex < 0 || newIndex >= exercises.length) return;

    // Échange (Swap)
    const temp = exercises[newIndex];
    exercises[newIndex] = exercises[currentIndex];
    exercises[currentIndex] = temp;

    // Sauvegarde et mise à jour
    Storage.reorderExercises(App.currentSeanceId, exercises);
    renderExerciseCarousel({ ...seance, exercises: exercises });
    
    // On garde la sélection sur l'exercice déplacé (facultatif mais plus sympa)
    // selectExerciseInDetail(App.currentExerciseId); // Déjà géré car l'ID ne change pas
    
    // Petit feedback visuel
    const container = document.getElementById('exercise-carousel-items');
    const newItem = container.children[newIndex];
    if (newItem) {
        newItem.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
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
        // S'il n'y a plus d'exercices, on cache le contenu
        document.getElementById('exercise-detail-content').classList.add('hidden');
    }
    
    showNotification('Exercice supprimé', 'success');
}

function deleteCurrentSeance() {
    if (!confirm('Supprimer cette séance définitivement ?')) return;
    
    Storage.deleteSeance(App.currentSeanceId);
    switchToView('seances-list-view');
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
    // Utilisation de la nouvelle fonction qui compte les séances terminées
    const totalSessions = Storage.getTotalSessionsCount();
    document.getElementById('total-sessions').textContent = totalSessions;
    renderCalendar();
    
    // Stats
    populateExerciseSelect();
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
    const currentVal = select.value;
    
    while (select.options.length > 1) {
        select.remove(1);
    }

    const allExercises = Storage.getAllExercisesFlat();
    allExercises.sort((a, b) => a.name.localeCompare(b.name));

    allExercises.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex.id;
        option.textContent = ex.name + (ex.muscleGroup ? ` (${ex.muscleGroup})` : '');
        select.appendChild(option);
    });

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

    const history = Storage.getGlobalExerciseHistory(exerciseId);
    
    // Trier par date croissante
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (history.length < 2) {
        container.innerHTML = '<div class="empty-chart-msg">Pas assez de données pour afficher une progression.</div>';
        summary.classList.add('hidden');
        return;
    }

    const dataPoints = history.map(h => {
        let value = 0;
        
        // On ne prend que les séries "valides" (poids et reps > 0)
        const validSeries = h.data.series.filter(s => s.reps > 0 && (s.kg !== undefined && s.kg >= 0));
        
        if (metric === 'weight') {
            // Poids max
            if (validSeries.length > 0) {
                value = Math.max(...validSeries.map(s => parseFloat(s.kg) || 0));
            }
        } else {
            // Volume (Tonnage)
            value = validSeries.reduce((acc, s) => acc + ((parseInt(s.reps)||0) * (parseFloat(s.kg)||0)), 0);
        }
        return { date: h.date, value: value };
    }).filter(p => p.value > 0);

    if (dataPoints.length === 0) {
        container.innerHTML = '<div class="empty-chart-msg">Aucune donnée valide trouvée.</div>';
        summary.classList.add('hidden');
        return;
    }

    const svg = generateSVGChart(dataPoints);
    container.innerHTML = svg;
    summary.classList.remove('hidden');

    updateStatsSummary(dataPoints, metric);
}

function generateSVGChart(data) {
    const width = 100;
    const height = 50;
    const padding = 5;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal;

    let points = "";
    
    data.forEach((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - (padding + ((d.value - minVal) / range) * (height - 2 * padding));
        points += `${x},${y} `;
    });

    // Génération des points cliquables (cercles)
    const circles = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - (padding + ((d.value - minVal) / range) * (height - 2 * padding));
        const dateStr = new Date(d.date).toLocaleDateString();
        
        // Cercle invisible plus grand pour zone de clic, + cercle visible
        return `
            <circle cx="${x}" cy="${y}" r="2.5" fill="transparent" stroke="none">
                <title>${dateStr} : ${d.value}</title>
            </circle>
            <circle cx="${x}" cy="${y}" r="1" fill="#fff" pointer-events="none" />
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg">
            <polyline fill="none" stroke="#ef4444" stroke-width="1.5" points="${points}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
            ${circles}
        </svg>
    `;
}

function updateStatsSummary(data, metric) {
    const last = data[data.length - 1].value;
    const max = Math.max(...data.map(d => d.value));
    
    const first = data[0].value;
    const prog = ((last - first) / first) * 100;
    const progSign = prog > 0 ? '+' : '';
    
    const unit = metric === 'weight' ? 'kg' : 't';

    document.getElementById('stat-max-val').textContent = `${max}`;
    document.getElementById('stat-last-val').textContent = `${last}`;
    
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

