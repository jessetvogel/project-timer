import { ProjectManager } from "./projectmanager.js";
import { $, $$, addClass, clear, create, onClick, onDragOver, onDrop, removeClass, setText } from "./util.js";
import { initTheme } from "./theme.js";
const PROJECT_MANAGER = new ProjectManager();
window.PROJECT_MANAGER = PROJECT_MANAGER;
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
var dragData = null;
function main() {
    PROJECT_MANAGER.load();
    hydrate();
    initTheme();
    setInterval(render, 10 * 1000);
    render();
    onDragOver(document.body, (event) => {
        event.preventDefault();
        dragMove(event.clientX, event.clientY);
    });
    onDrop($('timeline'), (event) => {
        event.preventDefault();
        dragStop(event.clientX, event.clientY);
    });
}
function dragStart(project) {
    var _a;
    const timelineInfo = renderTimeline();
    const previewWidth = timelineInfo.timelineWidth / (timelineInfo.maxHour - timelineInfo.minHour) * 0.25;
    const preview = create('div', { class: 'drop-preview' });
    preview.style.backgroundColor = project.color;
    preview.style.opacity = '0.0';
    preview.style.width = `${previewWidth}px`;
    (_a = $("intervals")) === null || _a === void 0 ? void 0 : _a.append(preview);
    dragData = {
        project: project,
        preview: preview,
        touchIdentifier: -1,
    };
}
function hovers(elem, clientX, clientY) {
    const box = elem.getBoundingClientRect();
    return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
}
function dragMove(clientX, clientY) {
    if (dragData != null) {
        const h = hovers($('timeline'), clientX, clientY);
        dragData.preview.style.opacity = (h ? '0.5' : '0.0');
        dragData.preview.style.left = `${clientX - 24}px`;
    }
}
function dragStop(clientX, clientY) {
    if (dragData != null) {
        const timeline = $('timeline');
        const hoverTimeline = (clientX >= timeline.offsetLeft
            && clientX <= timeline.offsetLeft + timeline.offsetWidth
            && clientY >= timeline.offsetTop
            && clientY <= timeline.offsetTop + timeline.offsetHeight);
        if (hoverTimeline) {
            dropOnTimeline(clientX);
        }
        dragData.preview.remove();
        dragData = null;
    }
}
function dropOnTimeline(clientX) {
    if (dragData != null) {
        const timelineInfo = renderTimeline();
        const f = (clientX - timelineInfo.timelineLeft) / timelineInfo.timelineWidth;
        const startHour = timelineInfo.minHour + f * (timelineInfo.maxHour - timelineInfo.minHour);
        const start = new Date(selectedDate);
        start.setHours(Math.floor(startHour));
        start.setMinutes(Math.floor(startHour * 60) % 60);
        const stopHour = startHour + 0.25;
        const stop = new Date(start);
        stop.setHours(Math.floor(stopHour));
        stop.setMinutes(Math.floor(stopHour * 60) % 60);
        PROJECT_MANAGER.intervals.push({
            project: dragData.project.name,
            start: start.getTime(),
            stop: stop.getTime(),
            note: "",
        });
        PROJECT_MANAGER.save();
        setTimeout(render, 10);
    }
}
function hydrate() {
    onClick($('button-prev-day'), () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        render();
    });
    onClick($('button-next-day'), () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        render();
    });
    window.onresize = renderTimeline;
}
function render() {
    if (dragData == null) {
        renderProjects();
        renderTimetable();
        renderTimeline();
    }
}
function renderProjects() {
    const projects = $('projects');
    clear(projects);
    for (const project of PROJECT_MANAGER.projects) {
        const div = renderProject(project);
        projects.append(div);
    }
    projects.append(create('div', {
        class: 'add-project',
        '@click': openDialogNewProject
    }, '+ add project'));
}
function renderProject(project) {
    const is_active = PROJECT_MANAGER.isActive(project.name);
    const clickHandler = function () {
        for (const elem of $$('.project'))
            removeClass(elem, 'active');
        if (is_active) {
            PROJECT_MANAGER.stopProject();
        }
        else {
            PROJECT_MANAGER.startProject(project.name);
            addClass(div, 'active');
        }
        render();
    };
    const div = create('div', {
        class: `project ${is_active ? 'active' : ''}`,
        style: `--project-color: ${project.color};`,
        '@click': clickHandler,
        draggable: true,
        '@dragstart': function (event) {
            dragStart(project);
        }
    }, [
        create('div', {
            class: 'color',
            '@touchstart': function (event) {
                event.preventDefault();
                dragStart(project);
                dragData.touchIdentifier = event.changedTouches[0].identifier;
            },
            '@touchmove': function (event) {
                for (const touch of event.changedTouches) {
                    if (dragData != null && touch.identifier == dragData.touchIdentifier) {
                        event.preventDefault();
                        dragMove(touch.clientX, touch.clientY);
                        return;
                    }
                }
            },
            '@touchend': function (event) {
                for (const touch of event.changedTouches) {
                    if (dragData != null && touch.identifier == dragData.touchIdentifier) {
                        event.preventDefault();
                        if (dragData.project == project && hovers(this, touch.clientX, touch.clientY)) {
                            dragData.preview.remove();
                            dragData = null;
                            clickHandler();
                        }
                        else {
                            dragStop(touch.clientX, touch.clientY);
                        }
                        return;
                    }
                }
            }
        }),
        create('div', { class: 'name' }, project.name),
        create('div', {
            class: 'settings',
            '@click': (event) => {
                event.stopPropagation();
                openDialogEditProject(project);
            }
        }),
    ]);
    return div;
}
function renderTimetable() {
    const table = $('timetable');
    const times = {};
    for (const interval of PROJECT_MANAGER.intervals) {
        if (isIntervalOnDate(interval, selectedDate)) {
            if (!(interval.project in times))
                times[interval.project] = 0;
            const start = interval.start;
            const stop = interval.stop || Date.now();
            const duration = (stop - start) / 3600000;
            times[interval.project] += duration;
        }
    }
    clear(table);
    table.append(create('b', { style: 'text-align: center; font-variant: small-caps;' }, 'project'));
    table.append(create('b', { style: 'text-align: center; font-variant: small-caps;' }, 'time spent'));
    for (const name in times) {
        const project = PROJECT_MANAGER.getProject(name);
        if (project == null)
            continue;
        table.append(create('div', {}, [
            create('div', { class: 'color', style: `--project-color: ${project.color};` }),
            name
        ]));
        table.append(create('div', {}, formatDuration(times[name])));
    }
    (Object.keys(times).length == 0 ? addClass : removeClass)(table, 'hidden');
}
function renderTimeline() {
    const timeline = $('timeline');
    const width = timeline.clientWidth;
    const date = $('date');
    setText(date, formatDate(selectedDate));
    (isToday(selectedDate) ? addClass : removeClass)(date, 'today');
    const intervals = $('intervals');
    clear(intervals);
    const visibleIntervals = PROJECT_MANAGER.intervals.filter(interval => isIntervalOnDate(interval, selectedDate));
    const [minHour, maxHour] = computeRange(visibleIntervals);
    for (const interval of visibleIntervals) {
        const start = new Date(interval.start);
        const stop = (() => {
            if (interval.stop !== null)
                return new Date(interval.stop);
            else if (isToday(selectedDate)) {
                return new Date();
            }
            else {
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
        const popup = div.querySelector('.popup');
        const popupStyleLeft = Math.min(0, width - divStyleLeft - 192 - 6);
        if (popupStyleLeft < 0)
            popup.style.left = `${popupStyleLeft}px`;
        const minWidth = (interval.stop == null) ? 8 : 1;
        const divWidth = Math.max(minWidth, Math.floor(interpolate(minHour, maxHour, stopHour) * width) - Math.floor(interpolate(minHour, maxHour, startHour) * width));
        div.style.width = `${divWidth}px`;
        if (interval.stop === null) {
            addClass(div, 'active');
        }
        intervals.append(div);
    }
    const times = $('times');
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
    return {
        minHour,
        maxHour,
        timelineWidth: width,
        timelineLeft: timeline.offsetLeft,
    };
}
function renderInterval(interval) {
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
function openDialogNewProject() {
    const dialog = create('dialog', {}, [
        create('div', {}, [
            create('span', { class: 'header' }, 'new project'),
            create('input', { type: 'text', placeholder: 'project name', autofocus: true }),
            create('span', { class: 'error' }),
            renderColorSelection(''),
            create('button', {
                '@click': () => {
                    const name = dialog.querySelector('input').value;
                    const color = dialog.querySelector('.colors .active').dataset.color;
                    if (name.length == 0) {
                        const error = dialog.querySelector('.error');
                        setText(error, 'missing project name');
                        return;
                    }
                    const project = PROJECT_MANAGER.createProject(name);
                    if (project == null) {
                        const error = dialog.querySelector('.error');
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
    ]);
    document.body.append(dialog);
    dialog.showModal();
    onClick(dialog, (event) => {
        if (event.target == dialog)
            dialog.remove();
    });
}
function openDialogEditProject(project) {
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
                    const name = dialog.querySelector('input').value;
                    const color = dialog.querySelector('.colors .active').dataset.color;
                    if (name.length == 0) {
                        const error = dialog.querySelector('.error');
                        setText(error, 'missing project name');
                        return;
                    }
                    if (name != project.name && PROJECT_MANAGER.getProject(name) !== null) {
                        const error = dialog.querySelector('.error');
                        setText(error, 'project name already used');
                        return;
                    }
                    for (const interval of PROJECT_MANAGER.intervals) {
                        if (interval.project == project.name) {
                            interval.project = name;
                        }
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
    ]);
    document.body.append(dialog);
    dialog.showModal();
    onClick(dialog, (event) => {
        if (event.target == dialog)
            dialog.remove();
    });
}
function openDialogEditInterval(interval) {
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
                cols: 20,
                rows: 3,
                placeholder: 'What did you do?'
            }, interval.note),
            create('button', {
                autofocus: true,
                '@click': () => {
                    const note = dialog.querySelector('textarea').value;
                    const startHourMin = startRow.querySelector('input').value.split(':').map(x => parseInt(x));
                    start.setHours(startHourMin[0]);
                    start.setMinutes(startHourMin[1]);
                    if (stop !== null) {
                        const stopHourMin = stopRow.querySelector('input').value.split(':').map(x => parseInt(x));
                        stop.setHours(stopHourMin[0]);
                        stop.setMinutes(stopHourMin[1]);
                    }
                    if (start.getTime() >= ((stop === null || stop === void 0 ? void 0 : stop.getTime()) || Date.now())) {
                        const error = dialog.querySelector('.error');
                        setText(error, 'stop time must be after start time');
                        return;
                    }
                    interval.note = note;
                    interval.start = start.getTime();
                    interval.stop = (stop === null || stop === void 0 ? void 0 : stop.getTime()) || null;
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
    ]);
    document.body.append(dialog);
    dialog.showModal();
    onClick(dialog, (event) => {
        if (event.target == dialog)
            dialog.remove();
    });
}
function renderColorSelection(selected) {
    if (!COLORS.includes(selected)) {
        selected = COLORS[0];
    }
    return create('div', { class: 'colors' }, COLORS.map(color => {
        const div = create('div', {
            style: `background-color: ${color};`,
            'data-color': color,
            '@click': function () {
                for (const sibling of this.parentElement.children)
                    removeClass(sibling, 'active');
                addClass(this, 'active');
            }
        });
        if (color == selected) {
            addClass(div, 'active');
        }
        return div;
    }));
}
function isIntervalOnDate(interval, date) {
    const intervalDate = new Date(interval.start);
    return intervalDate.getFullYear() == date.getFullYear() && intervalDate.getMonth() == date.getMonth() && intervalDate.getDate() == date.getDate();
}
function isToday(date) {
    const today = new Date();
    return today.getFullYear() == date.getFullYear() && today.getMonth() == date.getMonth() && today.getDate() == date.getDate();
}
function computeRange(intervals) {
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
        }
        {
            const stop = (interval.stop !== null) ? new Date(interval.stop) : new Date();
            const h = dateToFracHours(stop);
            if (h > max)
                max = h;
        }
    }
    return [Math.floor(min), Math.ceil(max)];
}
function interpolate(min, max, value) {
    return (value - min) / (max - min);
}
function dateToFracHours(date) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}
function formatHourMin(timestamp) {
    if (timestamp == null)
        return 'now';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
function formatDuration(hours) {
    const minutes = Math.round(hours * 60);
    if (minutes < 60)
        return `${minutes}min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
function formatDate(date) {
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
