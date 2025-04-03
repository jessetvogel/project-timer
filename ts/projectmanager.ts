export type Project = {
    name: string,
    color: string,
};

export type Interval = {
    project: string,
    start: number,
    stop: number | null,
    note: string,
};

export class ProjectManager {
    projects: Project[];
    intervals: Interval[];

    constructor() {
        this.projects = [];
        this.intervals = [];
    }

    getProject(name: string): Project | null {
        for (const project of this.projects) {
            if (project.name == name) {
                return project;
            }
        }
        return null;
    }

    createProject(name: string): Project | null {
        if (this.getProject(name) != null || name.length == 0) {
            return null;
        }
        const project: Project = {
            name,
            color: '#000000'
        };
        this.projects.push(project);

        this.save();

        return project;
    }

    deleteProject(name: string): void {
        this.projects = this.projects.filter(project => project.name != name);
        // this.intervals = this.intervals.filter(interval => interval.project != name);
        this.save();
    }

    startProject(name: string): void {
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

    stopProject(): void {
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

        // discard intervals < 1 min when stopped
        if (interval.stop - interval.start < 60_000) {
            this.intervals.pop();
        }

        this.save();
    }

    deleteInterval(interval: Interval): void {
        this.intervals = this.intervals.filter(i => i != interval);

        this.save();
    }

    serialize(): string {
        return JSON.stringify({
            projects: this.projects,
            intervals: this.intervals
        });
    }

    deserialize(str: string) {
        const data: {
            projects: Project[],
            intervals: Interval[]
        } = JSON.parse(str);

        // overwrite all projects and events
        this.projects = data.projects;
        this.intervals = data.intervals;
    }

    save() {
        localStorage.setItem("project_manager_data", this.serialize());
    }

    load(): boolean {
        const data = localStorage.getItem("project_manager_data");
        if (data == null) return false;
        this.deserialize(data);
        this.validate();
        return true;
    }

    forget() {
        localStorage.removeItem("project_manager_data");
    }

    isActive(name: string): boolean {
        const n = this.intervals.length;
        if (n == 0) return false;
        return this.intervals[n - 1].project == name && this.intervals[n - 1].stop == null;
    }

    validate(): void {
        // Intervals may not last past midnight, if so, stop it at 23:59:59 of the start date
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
