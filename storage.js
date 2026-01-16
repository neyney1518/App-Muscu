// Gestionnaire de stockage local pour l'application de musculation

const Storage = {
    
    // Clés de stockage
    KEYS: {
        SEANCES: 'musculation_seances',
        SESSIONS: 'musculation_sessions'
    },

    // Récupérer toutes les séances (modèles)
    getSeances() {
        const data = localStorage.getItem(this.KEYS.SEANCES);
        return data ? JSON.parse(data) : [];
    },

    // Sauvegarder toutes les séances
    saveSeances(seances) {
        localStorage.setItem(this.KEYS.SEANCES, JSON.stringify(seances));
    },

    // Ajouter une nouvelle séance
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
        
        // Créer une session pour cette nouvelle séance (jour de création)
        this.addSession(newSeance.id, new Date().toISOString().split('T')[0]);
        
        return newSeance;
    },

    // Récupérer une séance par ID
    getSeance(seanceId) {
        const seances = this.getSeances();
        return seances.find(s => s.id === seanceId);
    },

    // Supprimer une séance
    deleteSeance(seanceId) {
        let seances = this.getSeances();
        seances = seances.filter(s => s.id !== seanceId);
        this.saveSeances(seances);
        // Note: On garde les sessions (historique) même si le modèle est supprimé, ou on pourrait nettoyer.
        // Pour l'instant on laisse pour l'intégrité des données passées.
    },

    // Ajouter un exercice à une séance
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

    // Supprimer un exercice
    deleteExercise(seanceId, exerciseId) {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (seance && seance.exercises) {
            seance.exercises = seance.exercises.filter(e => e.id !== exerciseId);
            this.saveSeances(seances);
        }
    },

    // Récupérer une liste plate de tous les exercices uniques (par nom ou ID)
    getAllExercisesFlat() {
        const seances = this.getSeances();
        const all = [];
        const seenNames = new Set();
        
        seances.forEach(seance => {
            if (seance.exercises) {
                seance.exercises.forEach(ex => {
                    // On évite les doublons parfaits (Nom + Groupe)
                    const key = ex.name.toLowerCase() + '|' + (ex.muscleGroup || '');
                    if (!seenNames.has(key)) {
                        seenNames.add(key);
                        all.push(ex);
                    }
                });
            }
        });
        return all;
    },

    // Récupérer toutes les sessions (exécutions des séances)
    getSessions() {
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },

    // Sauvegarder toutes les sessions
    saveSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    },

    // Créer ou récupérer une session pour une date donnée
    addSession(seanceId, date) {
        const sessions = this.getSessions();
        
        // Vérifier si une session existe déjà pour cette séance à cette date
        let session = sessions.find(s => s.seanceId === seanceId && s.date === date);
        
        if (!session) {
            session = {
                id: Date.now().toString(),
                seanceId: seanceId,
                date: date,
                exercises: {}
            };
            sessions.push(session);
            this.saveSessions(sessions);
        }
        
        return session;
    },

    // Récupérer la session du jour pour une séance
    getTodaySession(seanceId) {
        const today = new Date().toISOString().split('T')[0];
        return this.addSession(seanceId, today);
    },

    // Sauvegarder les données d'un exercice pour une session
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

    // Récupérer les données d'un exercice pour une session
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

    // Récupérer l'historique d'un exercice dans le contexte d'une SÉANCE spécifique
    getExerciseHistory(seanceId, exerciseId) {
        const sessions = this.getSessions();
        const today = new Date().toISOString().split('T')[0];
        
        const history = sessions
            .filter(s => s.seanceId === seanceId && s.date !== today)
            .filter(s => s.exercises && s.exercises[exerciseId] && s.exercises[exerciseId].series && s.exercises[exerciseId].series.length > 0)
            .map(s => ({
                date: s.date,
                data: s.exercises[exerciseId]
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return history;
    },

    // Récupérer l'historique GLOBAL d'un exercice (toutes séances confondues) pour les stats
    getGlobalExerciseHistory(exerciseId) {
        const sessions = this.getSessions();
        
        // On cherche l'exercice par ID dans n'importe quelle session
        // Note: Cela suppose que l'ID de l'exercice est unique et constant.
        // Si l'utilisateur crée "Bench Press" dans Séance A et "Bench Press" dans Séance B, ils ont des IDs différents.
        // Pour ce cas simple, on va filtrer par ID. Une amélioration future serait de filtrer par NOM d'exercice.
        
        // Récupérons d'abord le nom de l'exercice pour chercher par nom (plus robuste pour les stats)
        // 1. Trouver l'exercice dans les modèles
        const seances = this.getSeances();
        let targetName = null;
        for (const s of seances) {
            const ex = s.exercises.find(e => e.id === exerciseId);
            if (ex) {
                targetName = ex.name;
                break;
            }
        }
        
        // Si on ne trouve pas par ID (ex supprimé), on renvoie vide
        if (!targetName) return [];

        // 2. Chercher dans toutes les sessions les exercices qui ont ce nom (approximativement) ou cet ID
        const history = [];
        
        sessions.forEach(session => {
            if (!session.exercises) return;
            
            // On regarde toutes les clés d'exos de cette session
            Object.keys(session.exercises).forEach(exKey => {
                const exData = session.exercises[exKey];
                
                // Si c'est le bon ID
                if (exKey === exerciseId) {
                    history.push({ date: session.date, data: exData });
                    return;
                }
                
                // Sinon, est-ce que c'est le même nom ? (Il faudrait stocker le nom dans la session pour être sûr, 
                // mais ici le modèle de données ne stocke que les IDs dans 'sessions'.
                // Pour l'instant, on se base strictement sur l'ID de l'exercice créé dans la séance.
                // Si l'utilisateur a créé deux fois "Bench" dans deux séances différentes, ce sont deux entités différentes.)
            });
        });
        
        return history.filter(h => h.data.series && h.data.series.length > 0);
    },

    // Récupérer toutes les dates avec des sessions
    getSessionDates() {
        const sessions = this.getSessions();
        return sessions.map(s => s.date);
    },

    // Compter le nombre total de sessions
    getTotalSessionsCount() {
        return this.getSessions().length;
    }
};

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}