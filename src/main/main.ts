import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { is } from '@electron-toolkit/utils';
import path from 'node:path';
import nodemailer from 'nodemailer';

const APP_NAME = 'SendOnce Mails';
const APP_ID = 'com.sendoncemails.desktop';

type ServerConfiguration = {
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  password: string;
};

type Attachment = {
  path: string;
};

type SendMailRequest = ServerConfiguration & {
  receivers: string[];
  fromName: string;
  fromEmail: string;
  subject: string;
  message: string;
  messageHtml: string;
  signature: string;
  attachments: Attachment[];
};

type DeliveryResult = {
  email: string;
  status: 'succeeded' | 'failed' | 'rejected';
  messageId?: string;
  error?: string;
};

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

function createWindow(): void {
  const appIcon = path.join(__dirname, '../renderer/assets/icon.png');
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: APP_NAME,
    icon: appIcon,
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  const appIcon = path.join(__dirname, '../renderer/assets/icon.png');

  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    iconPath: appIcon
  });

  if (process.platform === 'darwin') {
    app.dock.setIcon(appIcon);
  }

  ipcMain.handle('dialog:select-attachments', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select attachments',
      properties: ['openFile', 'multiSelections']
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('mail:sendBulk', async (event, payload: SendMailRequest) => {
    const transporter = nodemailer.createTransport({
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
    const results: DeliveryResult[] = [];

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
          const result: DeliveryResult = {
            email: receiver,
            status: 'rejected',
            messageId: info.messageId
          };
          results.push(result);
          event.sender.send('mail:progress', { completed: results.length, total: payload.receivers.length, result });
        } else {
          const result: DeliveryResult = {
            email: receiver,
            status: 'succeeded',
            messageId: info.messageId
          };
          results.push(result);
          event.sender.send('mail:progress', { completed: results.length, total: payload.receivers.length, result });
        }
      } catch (error) {
        const result: DeliveryResult = {
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
