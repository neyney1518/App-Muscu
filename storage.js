const Storage = {
    KEYS: {
        SEANCES: 'musculation_seances',
        SESSIONS: 'musculation_sessions'
    },

    // --- SÉANCES ---
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
        const seances = this.getSeances().filter(s => s.id !== seanceId);
        this.saveSeances(seances);
    },

    // --- EXERCICES (Avec Réutilisation d'Historique) ---
    addExercise(seanceId, name, muscleGroup = '') {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        
        if (seance) {
            // Vérifier si l'exercice existe déjà (pour reprendre son ID et lier l'historique)
            const allExercises = this.getAllExercisesFlat();
            const existing = allExercises.find(e => e.name.toLowerCase().trim() === name.toLowerCase().trim());
            
            const newExercise = {
                id: existing ? existing.id : Date.now().toString(),
                name: name,
                muscleGroup: muscleGroup || (existing ? existing.muscleGroup : '')
            };
            
            seance.exercises.push(newExercise);
            this.saveSeances(seances);
            return newExercise;
        }
        return null;
    },

    deleteExercise(seanceId, exerciseId) {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (seance) {
            seance.exercises = seance.exercises.filter(e => e.id !== exerciseId);
            this.saveSeances(seances);
        }
    },

    reorderExercises(seanceId, newOrder) {
        const seances = this.getSeances();
        const s = seances.find(s => s.id === seanceId);
        if (s) {
            s.exercises = newOrder;
            this.saveSeances(seances);
        }
    },

    getAllExercisesFlat() {
        const seances = this.getSeances();
        const all = [];
        const seenIds = new Set();
        seances.forEach(s => {
            if (s.exercises) {
                s.exercises.forEach(ex => {
                    if (!seenIds.has(ex.id)) {
                        seenIds.add(ex.id);
                        all.push(ex);
                    }
                });
            }
        });
        return all;
    },

    // --- SESSIONS (Historique) ---
    getSessions() {
        return JSON.parse(localStorage.getItem(this.KEYS.SESSIONS) || '[]');
    },

    saveSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

    getTodaySession(seanceId) {
        const sessions = this.getSessions();
        const today = new Date().toISOString().split('T')[0];
        let session = sessions.find(s => s.seanceId === seanceId && s.date === today);
        
        if (!session) {
            session = {
                id: Date.now().toString(),
                seanceId: seanceId,
                date: today,
                exercises: {},
                completed: false
            };
            sessions.push(session);
            this.saveSessions(sessions);
        }
        return session;
    },

    completeSession(sessionId) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            if (session.completed !== true) {
                session.completed = true;
                session.completedAt = new Date().toISOString();
                // La date devient celle de la validation
                session.date = new Date().toISOString().split('T')[0];
            }
            this.saveSessions(sessions);
            return session;
        }
        return null;
    },

    // --- DONNÉES SÉRIES ---
    saveExerciseData(sessionId, exerciseId, data) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            if (!session.exercises) session.exercises = {};
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
        return { comment: '', series: [] };
    },

    // --- HISTORIQUE & STATS ---
    getExerciseHistory(seanceId, exerciseId) {
        const sessions = this.getSessions();
        const today = new Date().toISOString().split('T')[0];
        
        // On récupère tout historique lié à cet ID d'exercice, peu importe la séance
        return sessions
            .filter(s => s.date !== today)
            .filter(s => s.completed === true || s.completed === undefined)
            .filter(s => s.exercises && s.exercises[exerciseId] && s.exercises[exerciseId].series && s.exercises[exerciseId].series.length > 0)
            .map(s => ({ date: s.date, data: s.exercises[exerciseId] }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getGlobalExerciseHistory(exerciseId) {
        // Pour les graphs
        const sessions = this.getSessions();
        const history = [];
        sessions.forEach(session => {
            if (session.completed === false) return;
            if (session.exercises && session.exercises[exerciseId]) {
                history.push({ date: session.date, data: session.exercises[exerciseId] });
            }
        });
        return history.filter(h => h.data.series && h.data.series.length > 0);
    },

    getTotalSessionsCount() {
        return this.getSessions().filter(s => s.completed === true || s.completed === undefined).length;
    },

    getSessionDates() {
        return this.getSessions()
            .filter(s => s.completed === true || s.completed === undefined)
            .map(s => s.date);
    },

    // --- PREMIUM (Export/Import/PR) ---
    exportData() {
        const data = {
            seances: this.getSeances(),
            sessions: this.getSessions(),
            version: '1.2',
            date: new Date().toISOString()
        };
        return JSON.stringify(data);
    },

    importData(json) {
        try {
            const data = JSON.parse(json);
            if (data.seances && data.sessions) {
                this.saveSeances(data.seances);
                this.saveSessions(data.sessions);
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    checkIsPR(exerciseId, weight) {
        if (!weight || weight <= 0) return false;
        const history = this.getGlobalExerciseHistory(exerciseId);
        if (history.length === 0) return true;
        
        let max = 0;
        history.forEach(h => {
            h.data.series.forEach(s => {
                if (s.kg && parseFloat(s.kg) > max) max = parseFloat(s.kg);
            });
        });
        return parseFloat(weight) > max;
    }
};
