import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

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

type SendMailResult = {
  email: string;
  status: 'succeeded' | 'failed' | 'rejected';
  messageId?: string;
  error?: string;
};

type SendProgress = {
  completed: number;
  total: number;
  result: SendMailResult;
};

type TestConnectionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

const api = {
  selectAttachments: (): Promise<string[]> => ipcRenderer.invoke('dialog:select-attachments'),
  testConnection: (payload: ServerConfiguration): Promise<TestConnectionResult> =>
    ipcRenderer.invoke('mail:testConnection', payload),
  sendBulkMail: (payload: SendMailRequest): Promise<SendMailResult[]> => ipcRenderer.invoke('mail:sendBulk', payload),
  onSendProgress: (callback: (progress: SendProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, progress: SendProgress): void => callback(progress);
    ipcRenderer.on('mail:progress', listener);
    return () => ipcRenderer.removeListener('mail:progress', listener);
  }
};

contextBridge.exposeInMainWorld('mailSender', api);

export type MailSenderApi = typeof api;
