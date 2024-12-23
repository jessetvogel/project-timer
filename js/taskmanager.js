export class TaskManager {
    constructor() {
        this.tasks = [];
        this.events = [];
    }
    getTask(name) {
        for (const task of this.tasks) {
            if (task.name == name) {
                return task;
            }
        }
        return null;
    }
    createTask(name) {
        if (this.getTask(name) != null) {
            return null;
        }
        const task = {
            name,
            color: randomColor()
        };
        this.tasks.push(task);
        return task;
    }
    serialize() {
        return JSON.stringify({
            tasks: this.tasks,
            events: this.events
        });
    }
    deserialize(str) {
        const data = JSON.parse(str);
        this.tasks = data.tasks;
        this.events = data.events;
    }
    store() {
        localStorage.setItem("task_manager_data", this.serialize());
    }
    load() {
        const data = localStorage.getItem("task_manager_data");
        if (data == null)
            return;
        this.deserialize(data);
    }
}
function randomColor() {
    return hexFromHSL(Math.random() * 360, 90, 30);
}
function hexFromHSL(h, s, l) {
    l /= 100.0;
    const a = s * Math.min(l, 1 - l) / 100.0;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
