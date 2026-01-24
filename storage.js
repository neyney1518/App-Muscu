// Gestionnaire de stockage local - Version Premium V1
const Storage = {
    
    KEYS: {
        SEANCES: 'musculation_seances',
        SESSIONS: 'musculation_sessions'
    },

    // --- GESTION DES MODÈLES DE SÉANCES ---

    getSeances() {
        const data = localStorage.getItem(this.KEYS.SEANCES);
        return data ? JSON.parse(data) : [];
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
        const seances = this.getSeances();
        return seances.find(s => s.id === seanceId);
    },

    deleteSeance(seanceId) {
        let seances = this.getSeances();
        seances = seances.filter(s => s.id !== seanceId);
        this.saveSeances(seances);
    },

    // --- GESTION DES EXERCICES ---

    addExercise(seanceId, name, muscleGroup = '') {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (seance) {
            const newExercise = {
                id: Date.now().toString(),
                name: name,
                muscleGroup: muscleGroup
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
        if (seance && seance.exercises) {
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
        const seenNames = new Set();
        
        seances.forEach(seance => {
            if (seance.exercises) {
                seance.exercises.forEach(ex => {
                    const key = ex.name.trim(); // Normalisation pour éviter doublons
                    if (!seenNames.has(key)) {
                        seenNames.add(key);
                        all.push(ex);
                    }
                });
            }
        });
        return all;
    },

    // --- GESTION DES SESSIONS (SÉANCES EFFECTUÉES) ---

    getSessions() {
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },

    saveSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

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

    getTodaySession(seanceId) {
        const today = new Date().toISOString().split('T')[0];
        return this.addSession(seanceId, today);
    },

    completeSession(sessionId) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (session) {
            if (session.completed !== true) {
                const now = new Date();
                session.completed = true;
                session.completedAt = now.toISOString();
                session.date = now.toISOString().split('T')[0];
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

    // --- HISTORIQUE & STATS ---

    getExerciseHistory(seanceId, exerciseId) {
        const sessions = this.getSessions();
        const today = new Date().toISOString().split('T')[0];
        
        return sessions
            .filter(s => s.seanceId === seanceId && s.date !== today)
            .filter(s => s.completed === true || s.completed === undefined)
            .filter(s => s.exercises && s.exercises[exerciseId] && s.exercises[exerciseId].series && s.exercises[exerciseId].series.length > 0)
            .map(s => ({
                date: s.date,
                data: s.exercises[exerciseId]
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getGlobalExerciseHistory(exerciseId) {
        const sessions = this.getSessions();
        const history = [];
        
        const seances = this.getSeances();
        let targetName = null;
        for (const s of seances) {
            const ex = s.exercises.find(e => e.id === exerciseId);
            if (ex) {
                targetName = ex.name;
                break;
            }
        }
        
        if (!targetName) return [];

        sessions.forEach(session => {
            if (session.completed === false) return;
            if (!session.exercises) return;
            
            Object.keys(session.exercises).forEach(exKey => {
                if (exKey === exerciseId) {
                    history.push({ date: session.date, data: session.exercises[exKey] });
                }
            });
        });
        
        return history.filter(h => h.data.series && h.data.series.length > 0);
    },

    getSessionDates() {
        const sessions = this.getSessions();
        return sessions
            .filter(s => s.completed === true || s.completed === undefined)
            .map(s => s.date);
    },

    getTotalSessionsCount() {
        return this.getSessions()
            .filter(s => s.completed === true || s.completed === undefined)
            .length;
    },

    // --- PREMIUM FEATURES (NOUVEAU) ---

    // 1. Sauvegarde et Restauration
    exportData() {
        const data = {
            seances: this.getSeances(),
            sessions: this.getSessions(),
            version: '1.0',
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

    // 2. Gamification : Vérifier si c'est un PR (Personal Record)
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
