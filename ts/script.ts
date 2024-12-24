import { Interval, Project, ProjectManager } from "./projectmanager.js";
import { $, $$, addClass, clear, create, onClick, removeClass, setText } from "./util.js"
import { initTheme } from "./theme.js"

const PROJECT_MANAGER = new ProjectManager();
(window as any).PROJECT_MANAGER = PROJECT_MANAGER;

const COLORS = [
    '#c63e3e',
    '#5db74b',
    '#e2a32c',
    '#1a7d8e',
    '#b96e37',
    '#3fabcc',
    '#a84f74',
    '#715a9b',
    '#3ca293',
    '#233239',
];

window.addEventListener("DOMContentLoaded", main);

var selectedDate = new Date();

function main() {
    // Load data
    PROJECT_MANAGER.load();

    // Hydrate page
    hydrate();

    // Initialize theme
    initTheme();

    // Re-render every 10 seconds
    setInterval(render, 10 * 1000);
    render();
}

function hydrate(): void {
    onClick($('button-prev-day')!, () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        render();
    });
    onClick($('button-next-day')!, () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        render();
    });
    window.onresize = renderTimeline;
}

function render(): void {
    renderProjects();
    renderTimetable();
    renderTimeline();
}

function renderProjects(): void {
    const projects = $('projects')!;
    clear(projects);
    for (const project of PROJECT_MANAGER.projects) {
        const div = renderProject(project);
        projects.append(div);
    }
    projects.append(create('div', {
        class: 'add-project', '@click': openDialogNewProject
    }, '+ add project'));
}

function renderProject(project: Project): HTMLElement {
    const is_active = PROJECT_MANAGER.isActive(project.name);
    return create('div', {
        class: `project ${is_active ? 'active' : ''}`,
        style: `--project-color: ${project.color};`,
        '@click': function () {
            // Start / stop project by clicking on it
            for (const elem of $$('.project'))
                removeClass(elem, 'active');
            if (is_active) {
                PROJECT_MANAGER.stopProject();
            } else {
                PROJECT_MANAGER.startProject(project.name);
                addClass(this as HTMLElement, 'active');
            }
            render();
        }
    }, [
        create('div', { class: 'color' }),
        create('div', { class: 'name' }, project.name),
        create('div', {
            class: 'settings',
            '@click': (event: MouseEvent) => {
                event.stopPropagation();
                openDialogEditProject(project);
            }
        }),
    ]);
}

function renderTimetable(): void {
    const table = $('timetable')!;
    const times: { [key: string]: number } = {};
    for (const interval of PROJECT_MANAGER.intervals) {
        if (isIntervalOnDate(interval, selectedDate)) {
            if (!(interval.project in times))
                times[interval.project] = 0;
            const start = interval.start;
            const stop = interval.stop || Date.now();
            const duration = (stop - start) / 3_600_000;
            times[interval.project] += duration;
        }
    }
    clear(table);
    table.append(create('b', { style: 'text-align: center; font-variant: small-caps;' }, 'project'));
    table.append(create('b', { style: 'text-align: center; font-variant: small-caps;' }, 'time spent'));
    for (const name in times) {
        const project = PROJECT_MANAGER.getProject(name);
        if (project == null) continue; // skip all deleted project
        table.append(create('div', {}, [
            create('div', { class: 'color', style: `--project-color: ${project.color};` }),
            name
        ]));

        table.append(create('div', {}, formatDuration(times[name])));
    }
    (Object.keys(times).length == 0 ? addClass : removeClass)(table, 'hidden');
}

function renderTimeline(): void {
    const timeline = $('timeline')!;
    const width = timeline.clientWidth;

    // Render selected date
    const date = $('date')!;
    setText(date, formatDate(selectedDate));
    (isToday(selectedDate) ? addClass : removeClass)(date, 'today');

    // Render intervals
    const intervals = $('intervals')!;
    clear(intervals);

    const visibleIntervals = PROJECT_MANAGER.intervals.filter(interval => isIntervalOnDate(interval, selectedDate));
    // TODO: come up with some nice bounds, maybe X minutes margin
    // Note that minHour and maxHour do not need to be integral
    const [minHour, maxHour] = computeRange(visibleIntervals);

    for (const interval of visibleIntervals) {
        const start = new Date(interval.start);
        const stop = (() => {
            if (interval.stop !== null)
                return new Date(interval.stop);
            else if (isToday(selectedDate)) {
                return new Date();
            } else {
                // Oops, fix unfinished interval by ending it at 23:59:59 PM
                const stop = new Date(start.getTime());
                stop.setHours(23);
                stop.setMinutes(59);
                stop.setSeconds(59);
                interval.stop = stop.getTime();
                return stop;
            }
        })();

        const startHour = dateToFracHours(start);
        const stopHour = dateToFracHours(stop);

        const div = renderInterval(interval);
        const divStyleLeft = Math.floor(interpolate(minHour, maxHour, startHour) * width);
        div.style.left = `${divStyleLeft}px`;

        // Popup should not go out of screen
        const popup = div.querySelector('.popup')! as HTMLDivElement;
        const popupStyleLeft = Math.min(0, width - divStyleLeft - 192 - 6); // TODO: dynamically get width of popup ?
        if (popupStyleLeft < 0) popup.style.left = `${popupStyleLeft}px`;

        // NOTE: Weird math to ensure pixel perfect width!
        const divWidth = Math.max(1, Math.floor(interpolate(minHour, maxHour, stopHour) * width) - Math.floor(interpolate(minHour, maxHour, startHour) * width));
        div.style.width = `${divWidth}px`;
        if (interval.stop === null) {
            addClass(div, 'active');
        }

        intervals.append(div);
    }

    // Render time markers
    const times = $('times')!;
    clear(times);
    for (let hour = Math.ceil(minHour); hour <= Math.floor(maxHour); hour += 1) {
        const marker = create('div', { class: 'marker' }, create('span', { class: 'time' }, `${hour}:00`));
        marker.style.left = `${Math.floor(interpolate(minHour, maxHour, hour) * width)}px`;
        times.append(marker);
    }

    if (isToday(selectedDate)) {
        const now = create('div', { class: 'now' });
        const nowDate = new Date();
        const nowHour = dateToFracHours(nowDate);
        now.style.left = `${Math.floor(interpolate(minHour, maxHour, nowHour) * width)}px`;
        times.append(now);
    }
}

function renderInterval(interval: Interval): HTMLElement {
    const project = PROJECT_MANAGER.getProject(interval.project);
    const color = (project !== null) ? project.color : 'rgb(202, 198, 190)';
    return create('div', {
        class: 'interval',
        style: `--project-color: ${color};`,
        '@click': () => {
            openDialogEditInterval(interval);
        }
    }, [
        create('div', { class: 'popup' }, [
            create('div', { class: 'header' }, [
                create('div', { class: 'color' }),
                create('div', {}, interval.project),
                create('div', { class: 'time' }, `(${formatHourMin(interval.start)} - ${formatHourMin(interval.stop)})`)
            ]),
            interval.note
        ])
    ]);
}

// --------

function openDialogNewProject(): void {
    const dialog = create('dialog', {}, [
        create('div', {}, [
            create('span', { class: 'header' }, 'new project'),
            create('input', { type: 'text', placeholder: 'project name', autofocus: true }),
            create('span', { class: 'error' }),
            renderColorSelection(''),
            create('button', {
                '@click': () => {
                    // Try to create a new project with given name and color
                    const name = dialog.querySelector('input')!.value;
                    const color = (dialog.querySelector('.colors .active')! as HTMLElement).dataset.color!;
                    if (name.length == 0) {
                        const error = dialog.querySelector('.error')! as HTMLElement;
                        setText(error, 'missing project name');
                        return;
                    }
                    const project = PROJECT_MANAGER.createProject(name);
                    if (project == null) {
                        const error = dialog.querySelector('.error')! as HTMLElement;
                        setText(error, 'project name already used');
                        return;
                    }
                    project.color = color;
                    PROJECT_MANAGER.save();
                    dialog.remove();
                    render();
                }
            }, '+ add')
        ])
    ]) as HTMLDialogElement;
    document.body.append(dialog);
    dialog.showModal();

    onClick(dialog, (event) => {
        if (event.target == dialog)
            dialog.remove();
    });
}

function openDialogEditProject(project: Project): void {
    const dialog = create('dialog', {}, [
        create('div', {}, [
            create('span', { class: 'header' }, 'edit project'),
            create('input', {
                type: 'text',
                placeholder: 'project name',
                value: project.name,
                autofocus: true,
                '@focus': function () {
                    this.setSelectionRange(0, project.name.length);
                }
            }),
            create('span', { class: 'error' }),
            renderColorSelection(project.color),
            create('button', {
                '@click': () => {
                    // Update project with given name and color
                    const name = dialog.querySelector('input')!.value;
                    const color = (dialog.querySelector('.colors .active')! as HTMLElement).dataset.color!;
                    if (name.length == 0) {
                        const error = dialog.querySelector('.error')! as HTMLElement;
                        setText(error, 'missing project name');
                        return;
                    }
                    if (name != project.name && PROJECT_MANAGER.getProject(name) !== null) {
                        const error = dialog.querySelector('.error')! as HTMLElement;
                        setText(error, 'project name already used');
                        return;
                    }
                    project.name = name;
                    project.color = color;
                    PROJECT_MANAGER.save();
                    dialog.remove();
                    render();
                }
            }, 'save'),
            create('button', {
                class: 'dangerous',
                '@click': function () {
                    PROJECT_MANAGER.deleteProject(project.name);
                    dialog.remove();
                    render();
                }
            }, 'delete')
        ])
    ]) as HTMLDialogElement;
    document.body.append(dialog);
    dialog.showModal();

    onClick(dialog, (event) => {
        if (event.target == dialog)
            dialog.remove();
    });
}

function openDialogEditInterval(interval: Interval): void {
    const start = new Date(interval.start);
    const startValue = formatHourMin(interval.start);
    const startRow = create('div', { class: 'row' }, [
        create('div', { class: 'label' }, 'start time'),
        create('input', {
            type: 'time',
            value: startValue,
            required: true,
        }),
    ]);

    const stop = (interval.stop !== null) ? new Date(interval.stop) : null;
    const stopValue = (stop !== null) ? formatHourMin(interval.stop) : null;
    const stopRow = create('div', { class: 'row' }, [
        create('div', { class: 'label' }, 'stop time'),
        create('input', {
            type: 'time',
            value: stopValue,
            required: true,
            [((stopValue !== null) ? 'value' : 'disabled')]: stopValue,
        }),
    ]);

    const dialog = create('dialog', {}, [
        create('div', {}, [
            create('span', { class: 'header' }, 'edit interval'),
            startRow,
            stopRow,
            create('span', { class: 'error' }),
            create('textarea', {
                autofocus: true,
                cols: 20,
                rows: 3,
                placeholder: 'What did you do?'
            }, interval.note),
            create('button', {
                '@click': () => {
                    const note = dialog.querySelector('textarea')!.value;

                    // Update start and, if applicable,  stop time
                    const startHourMin = startRow.querySelector('input')!.value.split(':').map(x => parseInt(x));
                    start.setHours(startHourMin[0]);
                    start.setMinutes(startHourMin[1]);
                    if (stop !== null) {
                        const stopHourMin = stopRow.querySelector('input')!.value.split(':').map(x => parseInt(x));
                        stop.setHours(stopHourMin[0]);
                        stop.setMinutes(stopHourMin[1]);
                    }

                    // Validate times
                    if (start.getTime() >= (stop?.getTime() || Date.now())) {
                        const error = dialog.querySelector('.error')! as HTMLElement;
                        setText(error, 'stop time must be after start time');
                        return;
                    }

                    // Update interval fields
                    interval.note = note;
                    interval.start = start.getTime();
                    interval.stop = stop?.getTime() || null;

                    PROJECT_MANAGER.save();
                    dialog.remove();
                    render();
                }
            }, 'save'),
            create('button', {
                class: 'dangerous',
                '@click': function () {
                    PROJECT_MANAGER.deleteInterval(interval);
                    dialog.remove();
                    render();
                }
            }, 'delete')
        ])
    ]) as HTMLDialogElement;
    document.body.append(dialog);
    dialog.showModal();

    onClick(dialog, (event) => {
        if (event.target == dialog)
            dialog.remove();
    });
}

function renderColorSelection(selected: string): HTMLElement {
    if (!COLORS.includes(selected)) {
        selected = COLORS[0];
    }

    return create('div', { class: 'colors' }, COLORS.map(color => {
        const div = create('div', {
            style: `background-color: ${color};`,
            'data-color': color,
            '@click': function () {
                for (const sibling of (this as HTMLElement).parentElement!.children)
                    removeClass(sibling as HTMLElement, 'active');
                addClass(this as HTMLElement, 'active');
            }
        });
        if (color == selected) {
            addClass(div, 'active');
        }
        return div;
    }));
}

// --------

function isIntervalOnDate(interval: Interval, date: Date): boolean {
    const intervalDate = new Date(interval.start);
    return intervalDate.getFullYear() == date.getFullYear() && intervalDate.getMonth() == date.getMonth() && intervalDate.getDate() == date.getDate();
}

function isToday(date: Date): boolean {
    const today = new Date();
    return today.getFullYear() == date.getFullYear() && today.getMonth() == date.getMonth() && today.getDate() == date.getDate();
}

function computeRange(intervals: Interval[]): [number, number] {
    if (intervals.length == 0) {
        return [9, 17];
    }

    let min = 24;
    let max = 0;

    for (const interval of intervals) {
        {
            const start = new Date(interval.start);
            const h = dateToFracHours(start);
            if (h < min)
                min = h;
        } {
            const stop = (interval.stop !== null) ? new Date(interval.stop) : new Date();
            const h = dateToFracHours(stop);
            if (h > max)
                max = h;
        }
    }

    return [Math.floor(min), Math.ceil(max)];
}

function interpolate(min: number, max: number, value: number): number { // TODO: rename ?
    return (value - min) / (max - min);
}

function dateToFracHours(date: Date): number { // TODO: rename ?
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function formatHourMin(timestamp: number | null): string {
    if (timestamp == null) return 'now';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatDuration(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    return `${Math.floor(hours)}h ${Math.round((hours * 60) % 60)}min`;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
