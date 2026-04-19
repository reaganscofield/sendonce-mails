type ScreenName = 'server' | 'receivers' | 'send';
type StatusTone = 'neutral' | 'success' | 'error';
type ModalTone = 'neutral' | 'success' | 'error';

type ServerConfiguration = {
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  password: string;
};

type DeliveryResult = {
  email: string;
  status: 'succeeded' | 'failed' | 'rejected';
  messageId?: string;
  error?: string;
};

const STORAGE_KEYS = {
  server: 'mailSender.serverConfiguration',
  receivers: 'mailSender.receivers'
};

const menuButtons = document.querySelectorAll<HTMLButtonElement>('.menu-button');
const screens = document.querySelectorAll<HTMLElement>('.screen');
const serverForm = document.querySelector<HTMLFormElement>('#server-form');
const receiversForm = document.querySelector<HTMLFormElement>('#receivers-form');
const sendForm = document.querySelector<HTMLFormElement>('#send-form');
const sendButton = document.querySelector<HTMLButtonElement>('#send-button');
const attachButton = document.querySelector<HTMLButtonElement>('#attach-button');
const attachmentSummary = document.querySelector<HTMLSpanElement>('#attachment-summary');
const receiverCount = document.querySelector<HTMLSpanElement>('#receiver-count');
const sendReadyCount = document.querySelector<HTMLSpanElement>('#send-ready-count');
const configReady = document.querySelector<HTMLSpanElement>('#config-ready');
const progressArea = document.querySelector<HTMLElement>('#progress-area');
const progressBar = document.querySelector<HTMLDivElement>('#progress-bar');
const progressCount = document.querySelector<HTMLSpanElement>('#progress-count');
const progressLabel = document.querySelector<HTMLSpanElement>('#progress-label');
const report = document.querySelector<HTMLElement>('#report');
const reportChart = document.querySelector<HTMLCanvasElement>('#report-chart');
const messageEditor = document.querySelector<HTMLDivElement>('#message-editor');
const editorCommands = document.querySelectorAll<HTMLButtonElement>('.editor-command');
const messageModal = document.querySelector<HTMLDivElement>('#message-modal');
const modalDialog = document.querySelector<HTMLElement>('.modal-dialog');
const modalEyebrow = document.querySelector<HTMLParagraphElement>('#modal-eyebrow');
const modalTitle = document.querySelector<HTMLHeadingElement>('#modal-title');
const modalMessage = document.querySelector<HTMLParagraphElement>('#modal-message');
const modalClose = document.querySelector<HTMLButtonElement>('#modal-close');
const sendErrorDetails = document.querySelector<HTMLDivElement>('#send-error-details');

let selectedAttachments: string[] = [];
let removeProgressListener: (() => void) | undefined;
let isSending = false;

function getInputValue(id: string): string {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
  return input?.value.trim() ?? '';
}

function getMessageText(): string {
  return messageEditor?.innerText.trim() ?? '';
}

function getMessageHtml(): string {
  return messageEditor?.innerHTML.trim() ?? '';
}

function focusMessageEditor(): void {
  messageEditor?.focus();
}

function setInputValue(id: string, value: string): void {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);

  if (input) {
    input.value = value;
  }
}

function setStatus(id: string, message: string, tone: StatusTone = 'neutral'): void {
  const statusText = document.querySelector<HTMLParagraphElement>(`#${id}`);

  if (!statusText) {
    return;
  }

  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function showModal(tone: ModalTone, eyebrow: string, title: string, message: string): void {
  if (!messageModal || !modalDialog || !modalEyebrow || !modalTitle || !modalMessage) {
    return;
  }

  modalDialog.dataset.tone = tone;
  modalEyebrow.textContent = eyebrow;
  modalTitle.textContent = title;
  modalMessage.textContent = message;

  if (progressArea) {
    progressArea.hidden = true;
  }

  if (report) {
    report.hidden = true;
  }

  if (modalClose) {
    modalClose.hidden = false;
  }

  if (sendErrorDetails) {
    sendErrorDetails.hidden = true;
    sendErrorDetails.replaceChildren();
  }

  messageModal.hidden = false;
  modalClose?.focus();
}

function hideModal(): void {
  if (isSending) {
    return;
  }

  if (messageModal) {
    messageModal.hidden = true;
  }
}

function showSendModal(total: number): void {
  if (!messageModal || !modalDialog || !modalEyebrow || !modalTitle || !modalMessage) {
    return;
  }

  modalDialog.dataset.tone = 'neutral';
  modalEyebrow.textContent = 'Send Progress';
  modalTitle.textContent = 'Sending emails.';
  modalMessage.textContent = 'Your emails are being sent now.';

  if (report) {
    report.hidden = true;
  }

  if (sendErrorDetails) {
    sendErrorDetails.hidden = true;
    sendErrorDetails.replaceChildren();
  }

  if (modalClose) {
    modalClose.hidden = true;
  }

  messageModal.hidden = false;
  updateProgress(0, total);
}

function showSendFailureDetails(results: DeliveryResult[]): void {
  if (!sendErrorDetails) {
    return;
  }

  const failedResults = results.filter((result) => result.status !== 'succeeded');

  if (failedResults.length === 0 || failedResults.length !== results.length) {
    sendErrorDetails.hidden = true;
    sendErrorDetails.replaceChildren();
    return;
  }

  const heading = document.createElement('strong');
  heading.textContent = 'Why the emails could not be sent';

  const list = document.createElement('ul');

  failedResults.forEach((result) => {
    const item = document.createElement('li');
    const reason =
      result.error ??
      (result.status === 'rejected' ? 'The mail server rejected this recipient.' : 'No error reason was returned.');
    item.textContent = `${result.email}: ${reason}`;
    list.append(item);
  });

  sendErrorDetails.replaceChildren(heading, list);
  sendErrorDetails.hidden = false;
}

function finishSendModal(results: DeliveryResult[]): void {
  if (!modalDialog || !modalEyebrow || !modalTitle || !modalMessage) {
    return;
  }

  const counts = getDeliveryCounts(results);
  const hasErrors = counts.failed > 0 || counts.rejected > 0;

  modalDialog.dataset.tone = hasErrors ? 'error' : 'success';
  modalEyebrow.textContent = 'Send Report';
  modalTitle.textContent =
    hasErrors && counts.succeeded === 0 ? 'All emails failed to send.' : hasErrors ? 'Some emails need attention.' : 'Emails sent successfully.';
  modalMessage.textContent =
    hasErrors && counts.succeeded === 0
      ? `${results.length} email${results.length === 1 ? '' : 's'} failed. Review the reason${results.length === 1 ? '' : 's'} below.`
      : `${counts.succeeded} succeeded, ${counts.failed} failed, ${counts.rejected} rejected.`;

  if (report) {
    report.hidden = false;
  }

  showSendFailureDetails(results);

  if (modalClose) {
    modalClose.hidden = false;
    modalClose.focus();
  }
}

function showScreen(screenName: ScreenName): void {
  screens.forEach((screen) => {
    const isSelected = screen.dataset.screen === screenName;
    screen.hidden = !isSelected;
    screen.classList.toggle('is-active', isSelected);
  });

  menuButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.screenTarget === screenName);
  });
}

function parseReceivers(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function getSavedServerConfiguration(): ServerConfiguration | null {
  const saved = localStorage.getItem(STORAGE_KEYS.server);

  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved) as ServerConfiguration;

    if (!parsed.smtpHost || !parsed.smtpPort || !parsed.username || !parsed.password) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getSavedReceivers(): string[] {
  const saved = localStorage.getItem(STORAGE_KEYS.receivers);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved) as string[];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function loadSavedData(): void {
  const server = getSavedServerConfiguration();
  const receivers = getSavedReceivers();

  if (server) {
    setInputValue('smtpHost', server.smtpHost);
    setInputValue('smtpPort', String(server.smtpPort));
    setInputValue('username', server.username);
    setInputValue('password', server.password);

    const secureInput = document.querySelector<HTMLInputElement>('#secure');

    if (secureInput) {
      secureInput.checked = server.secure;
    }
  }

  setInputValue('receivers', receivers.join('\n'));
  updateReceiverSummaries();
}

function updateReceiverSummaries(): void {
  const receivers = parseReceivers(getInputValue('receivers'));
  const savedReceivers = getSavedReceivers();
  const label = `${receivers.length} receiver${receivers.length === 1 ? '' : 's'}`;

  if (receiverCount) {
    receiverCount.textContent = label;
  }

  if (sendReadyCount) {
    sendReadyCount.textContent =
      savedReceivers.length === 0
        ? 'No saved receivers'
        : `${savedReceivers.length} saved receiver${savedReceivers.length === 1 ? '' : 's'} ready`;
  }

  const server = getSavedServerConfiguration();

  if (configReady) {
    configReady.textContent = server ? 'Server configuration ready' : 'Server configuration needed';
    configReady.dataset.ready = server ? 'true' : 'false';
  }

  if (sendButton) {
    const hasSavedReceivers = savedReceivers.length > 0;
    sendButton.disabled = !hasSavedReceivers;
    sendButton.title = hasSavedReceivers ? '' : 'Save at least one receiver before sending.';
  }
}

function getDeliveryCounts(results: DeliveryResult[]): Record<DeliveryResult['status'], number> {
  return {
    succeeded: results.filter((result) => result.status === 'succeeded').length,
    failed: results.filter((result) => result.status === 'failed').length,
    rejected: results.filter((result) => result.status === 'rejected').length
  };
}

function drawReportChart(results: DeliveryResult[]): void {
  if (!reportChart) {
    return;
  }

  const context = reportChart.getContext('2d');

  if (!context) {
    return;
  }

  const counts = getDeliveryCounts(results);
  const total = Math.max(results.length, 1);
  const slices = [
    { value: counts.succeeded, color: '#168a5b' },
    { value: counts.failed, color: '#d14343' },
    { value: counts.rejected, color: '#d99a1b' }
  ];

  context.clearRect(0, 0, reportChart.width, reportChart.height);

  let startAngle = -Math.PI / 2;

  slices.forEach((slice) => {
    const angle = (slice.value / total) * Math.PI * 2;
    context.beginPath();
    context.moveTo(110, 110);
    context.arc(110, 110, 92, startAngle, startAngle + angle);
    context.closePath();
    context.fillStyle = slice.color;
    context.fill();
    startAngle += angle;
  });

  context.beginPath();
  context.arc(110, 110, 54, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();

  context.fillStyle = '#20242a';
  context.font = '700 24px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(results.length), 110, 103);
  context.font = '600 12px system-ui';
  context.fillStyle = '#596773';
  context.fillText('total', 110, 128);

  document.querySelector<HTMLElement>('#success-count')!.textContent = String(counts.succeeded);
  document.querySelector<HTMLElement>('#failed-count')!.textContent = String(counts.failed);
  document.querySelector<HTMLElement>('#rejected-count')!.textContent = String(counts.rejected);
}

function updateProgress(completed: number, total: number): void {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (progressArea) {
    progressArea.hidden = false;
  }

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  if (progressCount) {
    progressCount.textContent = `${completed} / ${total}`;
  }

  if (progressLabel) {
    progressLabel.textContent = completed === total ? 'Finished sending emails.' : 'Sending emails...';
  }
}

menuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showScreen((button.dataset.screenTarget as ScreenName | undefined) ?? 'send');
  });
});

editorCommands.forEach((button) => {
  button.addEventListener('click', () => {
    const command = button.dataset.command;
    const value = button.dataset.value ?? undefined;

    if (!command) {
      return;
    }

    focusMessageEditor();

    if (command === 'createLink') {
      const link = window.prompt('Enter the link URL')?.trim();

      if (link) {
        document.execCommand('createLink', false, link);
      }

      return;
    }

    document.execCommand(command, false, value);
  });
});

messageEditor?.addEventListener('paste', (event) => {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') ?? '';
  document.execCommand('insertText', false, text);
});

modalClose?.addEventListener('click', hideModal);

messageModal?.addEventListener('click', (event) => {
  if (event.target === messageModal) {
    hideModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideModal();
  }
});

serverForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const configuration: ServerConfiguration = {
    smtpHost: getInputValue('smtpHost'),
    smtpPort: Number(getInputValue('smtpPort')),
    secure: document.querySelector<HTMLInputElement>('#secure')?.checked ?? false,
    username: getInputValue('username'),
    password: getInputValue('password')
  };
  const submitButton = serverForm.querySelector<HTMLButtonElement>('button[type="submit"]');

  submitButton?.setAttribute('disabled', 'true');
  setStatus('server-status', 'Testing connection...');

  try {
    const result = await window.mailSender.testConnection(configuration);

    if (!result.ok) {
      setStatus('server-status', 'Connection failed. Configuration was not saved.', 'error');
      showModal('error', 'Connection Failed', 'Server connection failed.', result.error);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.server, JSON.stringify(configuration));
    setStatus('server-status', 'Configuration saved.', 'success');
    showModal(
      'success',
      'Connection Successful',
      'Server configured successfully.',
      'The server has been added and configured successfully.'
    );
    updateReceiverSummaries();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to test the server connection.';
    setStatus('server-status', 'Connection failed. Configuration was not saved.', 'error');
    showModal('error', 'Connection Failed', 'Server connection failed.', message);
  } finally {
    submitButton?.removeAttribute('disabled');
  }
});

receiversForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const receivers = parseReceivers(getInputValue('receivers'));
  localStorage.setItem(STORAGE_KEYS.receivers, JSON.stringify(receivers));
  setInputValue('receivers', receivers.join('\n'));
  setStatus('receivers-status', `${receivers.length} receiver${receivers.length === 1 ? '' : 's'} Saved.`, 'success');
  updateReceiverSummaries();
});

document.querySelector<HTMLTextAreaElement>('#receivers')?.addEventListener('input', updateReceiverSummaries);

attachButton?.addEventListener('click', async () => {
  selectedAttachments = await window.mailSender.selectAttachments();

  if (attachmentSummary) {
    attachmentSummary.textContent =
      selectedAttachments.length === 0
        ? 'No attachments selected'
        : `${selectedAttachments.length} Attachment${selectedAttachments.length === 1 ? '' : 's'} Selected`;
  }
});

sendForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const server = getSavedServerConfiguration();
  const receivers = getSavedReceivers();

  if (!server) {
    setStatus('send-status', 'Save the server configuration before sending.', 'error');
    showScreen('server');
    return;
  }

  if (receivers.length === 0) {
    setStatus('send-status', 'Save at least one receiver before sending.', 'error');
    showScreen('receivers');
    return;
  }

  if (!getMessageText()) {
    setStatus('send-status', 'Write a message before sending.', 'error');
    focusMessageEditor();
    return;
  }

  if (!sendButton) {
    return;
  }

  sendButton.disabled = true;
  setStatus('send-status', 'Sending emails...');
  isSending = true;
  showSendModal(receivers.length);

  removeProgressListener?.();
  removeProgressListener = window.mailSender.onSendProgress((progress) => {
    updateProgress(progress.completed, progress.total);
  });

  try {
    const results = await window.mailSender.sendBulkMail({
      ...server,
      receivers,
      fromName: getInputValue('fromName'),
      fromEmail: getInputValue('fromEmail'),
      subject: getInputValue('subject'),
      message: getMessageText(),
      messageHtml: getMessageHtml(),
      signature: getInputValue('signature'),
      attachments: selectedAttachments.map((filePath) => ({ path: filePath }))
    });

    updateProgress(results.length, receivers.length);
    drawReportChart(results);

    const counts = getDeliveryCounts(results);
    finishSendModal(results);
    setStatus(
      'send-status',
      `Complete. ${counts.succeeded} Succeeded, ${counts.failed} Failed, ${counts.rejected} Rejected.`,
      counts.failed > 0 || counts.rejected > 0 ? 'error' : 'success'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send emails.';
    setStatus('send-status', message, 'error');
    showModal('error', 'Send Failed', 'Unable to send emails.', message);
  } finally {
    isSending = false;
    removeProgressListener?.();
    removeProgressListener = undefined;
    sendButton.disabled = false;
  }
});

loadSavedData();
showScreen('send');
