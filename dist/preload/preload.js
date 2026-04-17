"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    selectAttachments: () => electron_1.ipcRenderer.invoke('dialog:select-attachments'),
    sendBulkMail: (payload) => electron_1.ipcRenderer.invoke('mail:sendBulk', payload),
    onSendProgress: (callback) => {
        const listener = (_event, progress) => callback(progress);
        electron_1.ipcRenderer.on('mail:progress', listener);
        return () => electron_1.ipcRenderer.removeListener('mail:progress', listener);
    }
};
electron_1.contextBridge.exposeInMainWorld('mailSender', api);
