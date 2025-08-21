/* global $, localStorage, Shell */

// ---------- Errors ----------
const errors = {
    invalidDirectory: "Error: not a valid directory",
    noWriteAccess: "Error: you do not have write access to this directory",
    fileNotFound: "Error: file not found in current directory",
    fileNotSpecified: "Error: you did not specify a file",
    invalidFile: "Error: not a valid file",
    noSuchFileOrDirectory: "Error: no such file or directory",
};

// ---------- Virtual structure (directories & groupings) ----------
const struct = {
    root: ["about", "resume", "contact", "talks", "skills"],
    skills: ["proficient", "familiar"],
};

// ---------- Commands registry ----------
const commands = {};
let systemData = {};
const rootPath = "users/cfeng/root"; // adjust as you like

// ---------- Directory helpers ----------
const getDirectory = () => localStorage.directory;
const setDirectory = (dir) => {
    localStorage.directory = dir;
};

// ---------- Window buttons ----------
const registerFullscreenToggle = () => {
    // Toggle fullscreen on green button
    $(".button.green").on("click", () => {
        $(".terminal-window").toggleClass("fullscreen");
    });
};
const registerMinimizedToggle = () => {
    // Toggle minimized on yellow button
    $(".button.yellow").on("click", () => {
        $(".terminal-window").toggleClass("minimized");
    });
};

// ---------- Mutating commands (disabled) ----------
commands.mkdir = () => errors.noWriteAccess;
commands.touch = () => errors.noWriteAccess;
commands.rm = () => errors.noWriteAccess;

// ---------- Read-only commands ----------

// List directory contents
commands.ls = (directory) => {
    // Return contents of requested or current directory
    const dirArg = (directory || "").trim();

    if (!dirArg || dirArg === ".") {
        return systemData[getDirectory()];
    }
    if (dirArg === ".." || dirArg === "~") {
        return systemData["root"];
    }
    if (dirArg in struct) {
        return systemData[dirArg];
    }
    return systemData[getDirectory()];
};

// Help / supported commands
commands.help = () => systemData.help;

// Print current path
commands.pwd = () => {
    const dir = getDirectory();
    return dir === "root" ? rootPath : `${rootPath}/${dir}`;
};

// Show current user
commands.whoami = () => {
    const variants = ["guest (who actually knows how to use Linux 👀)", "guest - surprisingly good at Linux", "guest@cfeng-cli  # knows more Linux than expected"];

    // Randomly return a variant
    const i = Math.floor(Math.random() * variants.length);
    return variants[i];
};

// Show hostname
commands.hostname = () => {
    return "Chin-I-Feng"; // adjust as you like
};

// Show command history with padded line numbers
commands.history = () => {
    let history = localStorage.history;
    history = history ? JSON.parse(history) : [];
    const width = String(history.length).length;

    return `<pre>${history.map((h, i) => String(i + 1).padStart(width, " ") + "  " + h).join("\n")}</pre>`;
};

// Change directory
commands.cd = (newDirectory) => {
    const dirs = Object.keys(struct);
    const currDir = getDirectory();
    const nd = (newDirectory || "").trim();

    // Back to root or ignore neutral args
    if (!nd || nd === "." || nd === "~" || (nd === ".." && dirs.includes(currDir))) {
        setDirectory("root");
        return null;
    }
    // Into a known directory
    if (dirs.includes(nd) && currDir !== nd) {
        setDirectory(nd);
        return null;
    }
    return errors.invalidDirectory;
};

// Read file contents
commands.cat = (filename) => {
    // Display text file contents by logical key
    if (!filename) return errors.fileNotSpecified;

    const isDirectory = (name) => Object.prototype.hasOwnProperty.call(struct, name);
    const hasExt = (name, ext) => name.toLowerCase().endsWith(ext);
    const isPathLike = (name) => name.includes("/");

    if (isDirectory(filename)) return errors.invalidFile;

    // Case 1: file in current/root by logical key (e.g., "about.txt")
    if (!isPathLike(filename)) {
        if (!hasExt(filename, ".txt")) return errors.invalidFile;
        const key = filename.split(".")[0]; // "about"
        if (Object.prototype.hasOwnProperty.call(systemData, key)) {
            return systemData[key];
        }
        return errors.fileNotFound;
    }

    // Case 2: file in subdirectory (e.g., "skills/proficient.txt")
    if (isPathLike(filename)) {
        if (!hasExt(filename, ".txt")) return errors.noSuchFileOrDirectory;

        const parts = filename.split("/");
        const directory = parts[0];
        const fileKey = parts.slice(1).join("/").split(".")[0]; // supports nested, though we use 1-level

        if (directory === "root" || !Object.prototype.hasOwnProperty.call(struct, directory)) {
            return errors.noSuchFileOrDirectory;
        }
        // Ensure file is declared in struct mapping
        if (!struct[directory].includes(fileKey)) {
            return errors.noSuchFileOrDirectory;
        }
        // Return content if present
        if (Object.prototype.hasOwnProperty.call(systemData, fileKey)) {
            return systemData[fileKey];
        }
        return errors.fileNotFound;
    }

    return errors.fileNotFound;
};

// show the current date and time
commands.date = () => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    });
};

// ---------- last reboot command (deploy timestamp) ----------

// // Simple date formatter (kept in case you need it elsewhere)
// function formatDate(d) {
//     const pad = (n) => String(n).padStart(2, "0");
//     return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
// }

// Format a Date in the user's local timezone
function formatLocal(dt) {
    const opts = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
    };
    return new Intl.DateTimeFormat(undefined, opts).format(dt);
}

// Parse "YYYY-MM-DD HH:mm:ss UTC" reliably and return a Date in local tz
function parseDeployUtcString(s) {
    // Strict regex for the expected format
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(s);
    if (!m) return null;
    const [, y, mo, d, h, mi, se] = m.map(Number);
    // Construct as UTC then return a local Date
    return new Date(Date.UTC(y, mo - 1, d, h, mi, se));
}

// show the date of the last site deployment
commands.last = (arg) => {
    // Supports "last reboot"
    if (arg && arg.toLowerCase() === "reboot") {
        if (window.lastDeploy) {
            const commit = (window.lastCommit || "").slice(0, 7) || "unknown";

            // Robust parse of "YYYY-MM-DD HH:mm:ss UTC"
            const dt = parseDeployUtcString(window.lastDeploy);

            if (dt && !isNaN(dt)) {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                return `Last site deploy: ${formatLocal(dt)} (${tz}) [commit ${commit}]`;
            }
            // Fallback: show raw value if parsing failed
            return `Last site deploy: ${window.lastDeploy} [commit ${commit}]`;
        }
        return "Last site deploy: not configured (missing deploy-info.js)";
    }
    return "Usage: last reboot";
};

// ---------- Bootstrap / Init ----------
$(() => {
    registerFullscreenToggle();
    registerMinimizedToggle();

    const cmd = document.getElementById("terminal");

    // Disable AJAX cache to always fetch fresh pages
    $.ajaxSetup({ cache: false });

    // Fetch page fragments concurrently
    const pages = [
        $.get("pages/about.html"),
        $.get("pages/contact.html"),
        $.get("pages/familiar.html"),
        $.get("pages/help.html"),
        $.get("pages/proficient.html"),
        $.get("pages/resume.html"),
        $.get("pages/root.html"),
        $.get("pages/skills.html"),
        $.get("pages/talks.html"),
    ];

    $.when.apply($, pages).done((aboutData, contactData, familiarData, helpData, proficientData, resumeData, rootData, skillsData, talksData) => {
        // Map loaded fragments into systemData
        systemData["about"] = aboutData[0];
        systemData["contact"] = contactData[0];
        systemData["familiar"] = familiarData[0];
        systemData["help"] = helpData[0];
        systemData["proficient"] = proficientData[0];
        systemData["resume"] = resumeData[0];
        systemData["root"] = rootData[0];
        systemData["skills"] = skillsData[0];
        systemData["talks"] = talksData[0];
    });

    // Initialize terminal shell
    const terminal = new Shell(cmd, commands);
});
