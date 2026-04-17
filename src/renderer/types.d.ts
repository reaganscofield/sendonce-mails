import type { MailSenderApi } from '../preload/preload';

declare global {
  interface Window {
    mailSender: MailSenderApi;
  }
}

export {};
