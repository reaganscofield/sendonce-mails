"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const utils_1 = require("@electron-toolkit/utils");
const node_path_1 = __importDefault(require("node:path"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const APP_NAME = 'SendOnce Mails';
const APP_ID = 'com.sendoncemails.desktop';
electron_1.app.setName(APP_NAME);
electron_1.app.setAppUserModelId(APP_ID);
function createWindow() {
    const appIcon = node_path_1.default.join(__dirname, '../renderer/assets/icon.png');
    const mainWindow = new electron_1.BrowserWindow({
        width: 1100,
        height: 760,
        minWidth: 900,
        minHeight: 640,
        title: APP_NAME,
        icon: appIcon,
        backgroundColor: '#f6f7f9',
        webPreferences: {
            preload: node_path_1.default.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile(node_path_1.default.join(__dirname, '../renderer/index.html'));
    if (utils_1.is.dev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}
electron_1.app.whenReady().then(() => {
    const appIcon = node_path_1.default.join(__dirname, '../renderer/assets/icon.png');
    electron_1.app.setAboutPanelOptions({
        applicationName: APP_NAME,
        applicationVersion: electron_1.app.getVersion(),
        iconPath: appIcon
    });
    if (process.platform === 'darwin') {
        electron_1.app.dock.setIcon(appIcon);
    }
    electron_1.ipcMain.handle('dialog:select-attachments', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            title: 'Select attachments',
            properties: ['openFile', 'multiSelections']
        });
        return result.canceled ? [] : result.filePaths;
    });
    electron_1.ipcMain.handle('mail:sendBulk', async (event, payload) => {
        const transporter = nodemailer_1.default.createTransport({
            host: payload.smtpHost,
            port: payload.smtpPort,
            secure: payload.secure,
            auth: {
                user: payload.username,
                pass: payload.password
            }
        });
        const messageParts = [payload.message];
        const htmlParts = [payload.messageHtml];
        if (payload.signature) {
            messageParts.push(payload.signature);
            htmlParts.push(`<footer>${payload.signature.replace(/\n/g, '<br>')}</footer>`);
        }
        const text = messageParts.filter(Boolean).join('\n\n');
        const html = htmlParts.filter(Boolean).join('<br><br>');
        const from = payload.fromName ? `"${payload.fromName}" <${payload.fromEmail}>` : payload.fromEmail;
        const results = [];
        for (const receiver of payload.receivers) {
            try {
                const info = await transporter.sendMail({
                    from,
                    to: receiver,
                    subject: payload.subject,
                    text,
                    html,
                    attachments: payload.attachments
                });
                const accepted = info.accepted.map(String);
                const rejected = info.rejected.map(String);
                if (rejected.includes(receiver) || accepted.length === 0) {
                    const result = {
                        email: receiver,
                        status: 'rejected',
                        messageId: info.messageId
                    };
                    results.push(result);
                    event.sender.send('mail:progress', { completed: results.length, total: payload.receivers.length, result });
                }
                else {
                    const result = {
                        email: receiver,
                        status: 'succeeded',
                        messageId: info.messageId
                    };
                    results.push(result);
                    event.sender.send('mail:progress', { completed: results.length, total: payload.receivers.length, result });
                }
            }
            catch (error) {
                const result = {
                    email: receiver,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unable to send email.'
                };
                results.push(result);
                event.sender.send('mail:progress', { completed: results.length, total: payload.receivers.length, result });
            }
        }
        return results;
    });
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
