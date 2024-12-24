import { $, getCookie, onClick, setCookie } from "./util.js";
export function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = getCookie('theme');
    if (theme !== undefined)
        setTheme(theme === 'dark' ? 'dark' : 'light');
    else
        setTheme(prefersDark ? 'dark' : 'light');
    onClick($('button-theme'), () => {
        setCookie('theme', setTheme('toggle') ? 'dark' : 'light', 365);
    });
    setTimeout(function () {
        const sheet = window.document.styleSheets[0];
        sheet.insertRule('body, input { transition: background-color 0.5s, color 0.5s; }', sheet.cssRules.length);
    }, 100);
}
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        return true;
    }
    if (theme === 'light') {
        document.body.classList.remove('dark');
        return false;
    }
    return setTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
}
