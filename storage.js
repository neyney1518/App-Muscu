const Storage = {
    KEYS: { SEANCES: 'musculation_seances', SESSIONS: 'musculation_sessions' },

    getSeances() { return JSON.parse(localStorage.getItem(this.KEYS.SEANCES) || '[]'); },
    saveSeances(s) { localStorage.setItem(this.KEYS.SEANCES, JSON.stringify(s)); },
    getSessions() { return JSON.parse(localStorage.getItem(this.KEYS.SESSIONS) || '[]'); },
    saveSessions(s) { localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(s)); },

    addSeance(name) {
        const s = this.getSeances();
        s.push({ id: Date.now().toString(), name, exercises: [], createdAt: new Date().toISOString() });
        this.saveSeances(s);
    },
    getSeance(id) { return this.getSeances().find(s => s.id === id); },
    deleteSeance(id) { this.saveSeances(this.getSeances().filter(s => s.id !== id)); },

    // NOUVEAU : Prise en compte du paramètre isBackup
    addExercise(seanceId, name, muscleGroup = '', isBackup = false) {
        const seances = this.getSeances();
        const seance = seances.find(s => s.id === seanceId);
        if (!seance) return null;

        const cleanInputName = name.trim().toLowerCase();
        const allExercises = this.getAllExercisesFlat();
        const existingExercise = allExercises.find(e => e.name.trim().toLowerCase() === cleanInputName);
        
        const newId = existingExercise ? existingExercise.id : Date.now().toString();
        const finalName = existingExercise ? existingExercise.name : name.trim();
        const finalMuscle = muscleGroup.trim() || (existingExercise ? existingExercise.muscleGroup : 'Autre');

        // On intègre le paramètre isBackup à la sauvegarde
        const newExercise = { id: newId, name: finalName, muscleGroup: finalMuscle, isBackup: isBackup };
        seance.exercises.push(newExercise);
        this.saveSeances(seances);
        return newExercise;
    },

    // NOUVEAU : Prise en compte du paramètre isBackup lors de la modification
    updateExercise(exerciseId, newName, newMuscleGroup, isBackup = false) {
        const seances = this.getSeances();
        let updated = false;
        
        seances.forEach(s => {
            if (s.exercises) {
                s.exercises.forEach(ex => {
                    if (ex.id === exerciseId) {
                        ex.name = newName.trim();
                        ex.muscleGroup = newMuscleGroup.trim() || 'Autre';
                        ex.isBackup = isBackup; // Mise à jour du statut "Rechange"
                        updated = true;
                    }
                });
            }
        });
        
        if (updated) this.saveSeances(seances);
        return updated;
    },

    getAllMuscleGroups() {
        const defaults = ["Pectoraux", "Dos", "Épaules", "Biceps", "Triceps", "Quadriceps", "Ischio-jambiers", "Mollets", "Abdos", "Fessiers", "Avant-bras"];
        const all = this.getAllExercisesFlat();
        const used = all.map(e => e.muscleGroup).filter(m => m && m.trim() !== '' && m !== 'Autre');
        
        return [...new Set([...defaults, ...used])].sort();
    },

    deleteExercise(sId, exerciseId) {
        const s = this.getSeances();
        const seance = s.find(x => x.id === sId);
        if (seance) { seance.exercises = seance.exercises.filter(e => e.id !== exerciseId); this.saveSeances(s); }
    },
    reorderExercises(sId, order) {
        const s = this.getSeances();
        const seance = s.find(x => x.id === sId);
        if (seance) { seance.exercises = order; this.saveSeances(s); }
    },
    getAllExercisesFlat() {
        const all = []; const ids = new Set();
        this.getSeances().forEach(s => s.exercises.forEach(e => {
            if (!ids.has(e.id)) { ids.add(e.id); all.push(e); }
        }));
        return all;
    },

    getTodaySession(sId) {
        const s = this.getSessions();
        const date = new Date().toISOString().split('T')[0];
        let sess = s.find(x => x.seanceId === sId && x.date === date);
        if (!sess) { sess = { id: Date.now().toString(), seanceId: sId, date, exercises: {}, completed: false }; s.push(sess); this.saveSessions(s); }
        return sess;
    },
    completeSession(id) {
        const s = this.getSessions();
        const sess = s.find(x => x.id === id);
        if (sess && !sess.completed) { sess.completed = true; sess.date = new Date().toISOString().split('T')[0]; this.saveSessions(s); return sess; }
        return null;
    },
    saveExerciseData(sId, exId, d) {
        const s = this.getSessions();
        const sess = s.find(x => x.id === sId);
        if (sess) { if(!sess.exercises) sess.exercises={}; sess.exercises[exId] = d; this.saveSessions(s); }
    },
    getExerciseData(sId, exId) {
        const sess = this.getSessions().find(x => x.id === sId);
        return (sess && sess.exercises && sess.exercises[exId]) ? sess.exercises[exId] : { comment: '', series: [] };
    },
    getGlobalExerciseHistory(exId) {
        const hist = [];
        this.getSessions().forEach(s => {
            if (s.completed !== false && s.exercises && s.exercises[exId]) {
                hist.push({ date: s.date, data: s.exercises[exId] });
            }
        });
        return hist.filter(h => h.data.series && h.data.series.length > 0);
    },
    getExerciseHistory(sId, exId) {
        const today = new Date().toISOString().split('T')[0];
        return this.getGlobalExerciseHistory(exId).filter(h => h.date !== today).sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    getTotalSessionsCount() { return this.getSessions().filter(s => s.completed !== false).length; },
    getSessionDates() { return this.getSessions().filter(s => s.completed !== false).map(s => s.date); },
    exportData() { return JSON.stringify({ seances: this.getSeances(), sessions: this.getSessions(), v: '1.8' }); },
    importData(json) { try { const d = JSON.parse(json); if (d.seances && d.sessions) { this.saveSeances(d.seances); this.saveSessions(d.sessions); return true; } } catch (e) {} return false; },
    checkIsPR(exId, kg) { if (!kg || kg <= 0) return false; const h = this.getGlobalExerciseHistory(exId); if (h.length === 0) return true; let max = 0; h.forEach(x => x.data.series.forEach(s => { if(s.kg > max) max = parseFloat(s.kg); })); return parseFloat(kg) > max; }
};
if (typeof module !== 'undefined') module.exports = Storage;
