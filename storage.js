// Gestionnaire de stockage local pour l'application de musculation

const Storage = {
    
    // Clés de stockage
    KEYS: {
        SEANCES: 'musculation_seances',
        SESSIONS: 'musculation_sessions'
    },

    // --- GESTION DES MODÈLES DE SÉANCES ---

    // Récupérer toutes les séances
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
        return newSeance;
    },

    // Récupérer une séance par ID
    getSeance(seanceId) {
        const seances = this.getSeances();
        return seances.find(s => s.id === seanceId);
    },

    // Mettre à jour une séance (générique)
    updateSeance(seanceId, updates) {
        const seances = this.getSeances();
        const index = seances.findIndex(s => s.id === seanceId);
        if (index !== -1) {
            seances[index] = { ...seances[index], ...updates };
            this.saveSeances(seances);
        }
    },

    // Supprimer une séance (et ses exercices associés du modèle)
    deleteSeance(seanceId) {
        let seances = this.getSeances();
        seances = seances.filter(s => s.id !== seanceId);
        this.saveSeances(seances);
    },

    // --- GESTION DES EXERCICES DANS LES SÉANCES ---

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

    // NOUVEAU : Réorganiser les exercices (Drag & Drop)
    reorderExercises(seanceId, newExercisesOrder) {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (seance) {
            seance.exercises = newExercisesOrder;
            this.saveSeances(seances);
        }
    },

    // Récupérer une liste plate de tous les exercices (pour les stats)
    getAllExercisesFlat() {
        const seances = this.getSeances();
        const all = [];
        const seenNames = new Set();
        
        seances.forEach(seance => {
            if (seance.exercises) {
                seance.exercises.forEach(ex => {
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

    // --- GESTION DES SESSIONS (SÉANCES EFFECTUÉES) ---

    // Récupérer toutes les sessions
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
                exercises: {},
                completed: false // NOUVEAU : Par défaut une séance n'est pas terminée
            };
            sessions.push(session);
            this.saveSessions(sessions);
        }
        
        return session;
    },

    // Récupérer la session du jour (crée un brouillon si n'existe pas)
    getTodaySession(seanceId) {
        const today = new Date().toISOString().split('T')[0];
        return this.addSession(seanceId, today);
    },

    // NOUVEAU : Valider une session (Fin de séance)
    completeSession(sessionId) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (session) {
            // On ne met à jour la date que si c'est la première validation
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

    // --- HISTORIQUE ET STATISTIQUES ---

    // Récupérer l'historique d'un exercice (dans le contexte d'une séance précise)
    getExerciseHistory(seanceId, exerciseId) {
        const sessions = this.getSessions();
        const today = new Date().toISOString().split('T')[0];
        
        // Filtrer les sessions :
        // 1. De cette séance
        // 2. Pas celle d'aujourd'hui (en cours)
        // 3. Qui sont TERMINÉES (completed === true) OU ANCIENNES (completed === undefined)
        // 4. Qui ont des données pour cet exercice
        const history = sessions
            .filter(s => s.seanceId === seanceId && s.date !== today)
            .filter(s => s.completed === true || s.completed === undefined) // Rétrocompatibilité
            .filter(s => s.exercises && s.exercises[exerciseId] && s.exercises[exerciseId].series && s.exercises[exerciseId].series.length > 0)
            .map(s => ({
                date: s.date,
                data: s.exercises[exerciseId]
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Plus récent d'abord
        
        return history;
    },

    // Récupérer l'historique GLOBAL d'un exercice (toutes séances confondues) pour les graphiques
    getGlobalExerciseHistory(exerciseId) {
        const sessions = this.getSessions();
        const history = [];
        
        // On récupère le nom de l'exercice ciblé pour le retrouver partout
        // (Car l'ID peut être unique par séance, mais on veut grouper par "Mouvement")
        const seances = this.getSeances();
        let targetName = null;
        for (const s of seances) {
            const ex = s.exercises.find(e => e.id === exerciseId);
            if (ex) {
                targetName = ex.name;
                break;
            }
        }
        
        // Si l'exercice a été supprimé des modèles, on ne peut pas faire le lien par nom, on renvoie vide
        if (!targetName) return [];

        sessions.forEach(session => {
            // Ignorer les sessions brouillons non terminées (sauf si anciennes sans flag)
            if (session.completed === false) return;

            if (!session.exercises) return;
            
            // Chercher l'exercice dans cette session
            Object.keys(session.exercises).forEach(exKey => {
                // Si c'est le même ID (cas simple)
                if (exKey === exerciseId) {
                    history.push({ date: session.date, data: session.exercises[exKey] });
                }
                // (Optionnel : Ici on pourrait ajouter une logique pour chercher par "Nom" si tu as le même exo dans plusieurs séances)
            });
        });
        
        return history.filter(h => h.data.series && h.data.series.length > 0);
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
    }
};

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
