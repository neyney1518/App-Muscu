const Storage = {
    KEYS: {
        SEANCES: 'musculation_seances',
        SESSIONS: 'musculation_sessions'
    },

    // --- GESTION DES MODÈLES DE SÉANCES ---

    getSeances() {
        return JSON.parse(localStorage.getItem(this.KEYS.SEANCES) || '[]');
    },

    saveSeances(seances) {
        localStorage.setItem(this.KEYS.SEANCES, JSON.stringify(seances));
    },

    addSeance(name) {
        const seances = this.getSeances();
        const newSeance = {
            id: Date.now().toString(),
            name: name,
            exercises: [],
            createdAt: new Date().toISOString()
        };
        seances.push(newSeance);
        this.saveSeances(seances);
        return newSeance;
    },

    getSeance(seanceId) {
        return this.getSeances().find(s => s.id === seanceId);
    },

    deleteSeance(seanceId) {
        let seances = this.getSeances();
        seances = seances.filter(s => s.id !== seanceId);
        this.saveSeances(seances);
    },

    // --- GESTION DES EXERCICES (Avec Réutilisation Historique) ---

    addExercise(seanceId, name, muscleGroup = '') {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        
        if (seance) {
            // 1. Chercher si ce nom existe déjà (nettoyé des espaces et majuscules)
            const allEx = this.getAllExercisesFlat();
            const existing = allEx.find(e => e.name.trim().toLowerCase() === name.trim().toLowerCase());

            // 2. Si oui, on reprend SON id. Sinon, on en crée un nouveau.
            // C'est ça qui permet de lier l'historique entre différentes séances.
            const newId = existing ? existing.id : Date.now().toString();
            
            // 3. On garde le groupe musculaire existant s'il n'est pas précisé
            const finalMuscle = muscleGroup || (existing ? existing.muscleGroup : '');

            const newEx = {
                id: newId,
                name: name.trim(), // On garde le nom propre
                muscleGroup: finalMuscle
            };
            
            seance.exercises.push(newEx);
            this.saveSeances(seances);
            return newEx;
        }
        return null;
    },

    deleteExercise(seanceId, exerciseId) {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (seance && seance.exercises) {
            seance.exercises = seance.exercises.filter(e => e.id !== exerciseId);
            this.saveSeances(seances);
        }
    },

    reorderExercises(seanceId, newOrder) {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (seance) {
            seance.exercises = newOrder;
            this.saveSeances(seances);
        }
    },

    getAllExercisesFlat() {
        const seances = this.getSeances();
        const all = [];
        const seenIds = new Set();
        
        seances.forEach(seance => {
            if (seance.exercises) {
                seance.exercises.forEach(ex => {
                    if (!seenIds.has(ex.id)) {
                        seenIds.add(ex.id);
                        all.push(ex);
                    }
                });
            }
        });
        return all;
    },

    // --- GESTION DES SESSIONS (SÉANCES EFFECTUÉES) ---

    getSessions() {
        return JSON.parse(localStorage.getItem(this.KEYS.SESSIONS) || '[]');
    },

    saveSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

    // Créer ou récupérer une session pour une date donnée
    addSession(seanceId, date) {
        const sessions = this.getSessions();
        let session = sessions.find(s => s.seanceId === seanceId && s.date === date);
        
        if (!session) {
            session = {
                id: Date.now().toString(),
                seanceId: seanceId,
                date: date,
                exercises: {},
                completed: false
            };
            sessions.push(session);
            this.saveSessions(sessions);
        }
        
        return session;
    },

    // Récupérer la session du jour
    getTodaySession(seanceId) {
        const today = new Date().toISOString().split('T')[0];
        return this.addSession(seanceId, today);
    },

    // Valider une session (Fin de séance)
    completeSession(sessionId) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (session) {
            if (session.completed !== true) {
                const now = new Date();
                session.completed = true;
                session.completedAt = now.toISOString();
                session.date = now.toISOString().split('T')[0]; // La date devient celle de la validation
            }
            this.saveSessions(sessions);
            return session;
        }
        return null;
    },

    // --- GESTION DES DONNÉES D'EXERCICE (SÉRIES) ---

    saveExerciseData(sessionId, exerciseId, data) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (session) {
            if (!session.exercises) {
                session.exercises = {};
            }
            session.exercises[exerciseId] = data;
            this.saveSessions(sessions);
        }
    },

    getExerciseData(sessionId, exerciseId) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (session && session.exercises && session.exercises[exerciseId]) {
            return session.exercises[exerciseId];
        }
        
        return {
            comment: '',
            series: []
        };
    },

    // --- HISTORIQUE ET STATISTIQUES ---

    // Historique global (toutes séances confondues par ID d'exercice)
    getGlobalExerciseHistory(exerciseId) {
        const sessions = this.getSessions();
        const history = [];
        
        sessions.forEach(session => {
            // Ignorer les sessions brouillons non terminées
            if (session.completed === false) return;

            if (session.exercises && session.exercises[exerciseId]) {
                history.push({ date: session.date, data: session.exercises[exerciseId] });
            }
        });
        
        return history.filter(h => h.data.series && h.data.series.length > 0);
    },

    // Historique filtré pour l'affichage "dans la séance" (exclut aujourd'hui)
    getExerciseHistory(seanceId, exerciseId) {
        const today = new Date().toISOString().split('T')[0];
        
        return this.getGlobalExerciseHistory(exerciseId)
            .filter(h => h.date !== today)
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Plus récent d'abord
    },

    // Récupérer toutes les dates avec des sessions TERMINÉES
    getSessionDates() {
        const sessions = this.getSessions();
        return sessions
            .filter(s => s.completed === true || s.completed === undefined)
            .map(s => s.date);
    },

    // Compter le nombre total de sessions TERMINÉES
    getTotalSessionsCount() {
        return this.getSessions()
            .filter(s => s.completed === true || s.completed === undefined)
            .length;
    },

    // --- PREMIUM FEATURES (Export/Import/PR) ---

    exportData() {
        const data = {
            seances: this.getSeances(),
            sessions: this.getSessions(),
            version: '1.3',
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data);
    },

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.seances && data.sessions) {
                this.saveSeances(data.seances);
                this.saveSessions(data.sessions);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Erreur import", e);
            return false;
        }
    },

    checkIsPR(exerciseId, weight, reps) {
        if (!weight || weight <= 0) return false;
        
        // Récupérer tout l'historique
        const history = this.getGlobalExerciseHistory(exerciseId);
        
        if (history.length === 0) return true; // Premier set ever = PR !

        // Trouver le max weight historique
        let maxWeight = 0;
        history.forEach(h => {
            h.data.series.forEach(s => {
                if (s.kg && parseFloat(s.kg) > maxWeight) {
                    maxWeight = parseFloat(s.kg);
                }
            });
        });

        // Est-ce un nouveau record ?
        return parseFloat(weight) > maxWeight;
    }
};

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
