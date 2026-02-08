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
        let seances = this.getSeances();
        seances = seances.filter(s => s.id !== seanceId);
        this.saveSeances(seances);
    },

    // --- EXERCICES (LOGIQUE DE RÉUTILISATION CORRIGÉE) ---
    addExercise(seanceId, name, muscleGroup = '') {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        
        if (seance) {
            // 1. Nettoyage de la saisie (minuscules + sans espaces autour)
            const cleanInputName = name.trim().toLowerCase();
            
            // 2. Récupérer tous les exercices existants
            const allExercises = this.getAllExercisesFlat();
            
            // 3. Chercher une correspondance exacte (insensible à la casse)
            const existingExercise = allExercises.find(e => e.name.trim().toLowerCase() === cleanInputName);
            
            // 4. DÉCISION :
            // - Si trouvé : On reprend son ID (Liaison historique)
            // - Sinon : On crée un nouvel ID
            const newId = existingExercise ? existingExercise.id : Date.now().toString();
            
            // - Si trouvé : On reprend son nom "propre" (ex: "Dips" au lieu de "dips")
            // - Sinon : On prend ce que l'utilisateur a tapé
            const finalName = existingExercise ? existingExercise.name : name.trim();
            
            // - Si trouvé : On reprend son groupe musculaire s'il n'est pas précisé
            const finalMuscle = muscleGroup || (existingExercise ? existingExercise.muscleGroup : '');

            const newExercise = {
                id: newId,
                name: finalName,
                muscleGroup: finalMuscle
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

    // --- SESSIONS ---
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
                session.date = new Date().toISOString().split('T')[0]; // Date figée à la validation
            }
            this.saveSessions(sessions);
            return session;
        }
        return null;
    },

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
        const session = this.getSessions().find(s => s.id === sessionId);
        if (session && session.exercises && session.exercises[exerciseId]) {
            return session.exercises[exerciseId];
        }
        return { comment: '', series: [] };
    },

    // --- HISTORIQUE & STATS ---
    
    // Récupère tout l'historique global d'un exercice (par ID)
    getGlobalExerciseHistory(exerciseId) {
        const sessions = this.getSessions();
        const history = [];
        
        sessions.forEach(session => {
            if (session.completed === false) return; // Ignore les séances non finies
            if (session.exercises && session.exercises[exerciseId]) {
                history.push({ date: session.date, data: session.exercises[exerciseId] });
            }
        });
        
        return history.filter(h => h.data.series && h.data.series.length > 0);
    },

    // Récupère l'historique pour l'affichage dans la séance (exclut aujourd'hui)
    getExerciseHistory(seanceId, exerciseId) {
        const today = new Date().toISOString().split('T')[0];
        return this.getGlobalExerciseHistory(exerciseId)
            .filter(h => h.date !== today)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
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
            version: '1.4',
            date: new Date().toISOString()
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

    checkIsPR(exerciseId, weight) {
        if (!weight || weight <= 0) return false;
        const history = this.getGlobalExerciseHistory(exerciseId);
        if (history.length === 0) return true;
        
        let max = 0;
        history.forEach(h => {
            h.data.series.forEach(s => {
                if (s.kg && parseFloat(s.kg) > max) {
                    max = parseFloat(s.kg);
                }
            });
        });
        return parseFloat(weight) > max;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
