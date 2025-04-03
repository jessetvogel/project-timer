export class ProjectManager {
    constructor() {
        this.projects = [];
        this.intervals = [];
    }
    getProject(name) {
        for (const project of this.projects) {
            if (project.name == name) {
                return project;
            }
        }
        return null;
    }
    createProject(name) {
        if (this.getProject(name) != null || name.length == 0) {
            return null;
        }
        const project = {
            name,
            color: '#000000'
        };
        this.projects.push(project);
        this.save();
        return project;
    }
    deleteProject(name) {
        this.projects = this.projects.filter(project => project.name != name);
        this.save();
    }
    startProject(name) {
        const project = this.getProject(name);
        if (project == null) {
            console.warn(`unknown project '${name}'`);
            return;
        }
        this.stopProject();
        this.intervals.push({
            project: name,
            start: Date.now(),
            stop: null,
            note: '',
        });
        this.save();
    }
    stopProject() {
        if (this.intervals.length == 0) {
            console.warn('no project to be stopped');
            return;
        }
        const interval = this.intervals[this.intervals.length - 1];
        if (interval.stop !== null) {
            console.warn('project already stopped');
            return;
        }
        interval.stop = Date.now();
        if (interval.stop - interval.start < 60000) {
            this.intervals.pop();
        }
        this.save();
    }
    deleteInterval(interval) {
        this.intervals = this.intervals.filter(i => i != interval);
        this.save();
    }
    serialize() {
        return JSON.stringify({
            projects: this.projects,
            intervals: this.intervals
        });
    }
    deserialize(str) {
        const data = JSON.parse(str);
        this.projects = data.projects;
        this.intervals = data.intervals;
    }
    save() {
        localStorage.setItem("project_manager_data", this.serialize());
    }
    load() {
        const data = localStorage.getItem("project_manager_data");
        if (data == null)
            return false;
        this.deserialize(data);
        this.validate();
        return true;
    }
    forget() {
        localStorage.removeItem("project_manager_data");
    }
    isActive(name) {
        const n = this.intervals.length;
        if (n == 0)
            return false;
        return this.intervals[n - 1].project == name && this.intervals[n - 1].stop == null;
    }
    validate() {
        for (const interval of this.intervals) {
            const start = new Date(interval.start);
            const stop = new Date(interval.stop || new Date());
            if (stop.getFullYear() != start.getFullYear() || stop.getMonth() != start.getMonth() || stop.getDate() != start.getDate()) {
                stop.setFullYear(start.getFullYear());
                stop.setMonth(start.getMonth());
                stop.setDate(start.getDate());
                stop.setHours(23);
                stop.setMinutes(59);
                stop.setSeconds(59);
                interval.stop = stop.getTime();
            }
        }
    }
}
