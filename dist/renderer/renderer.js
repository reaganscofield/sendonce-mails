"use strict";
const STORAGE_KEYS = {
    server: 'mailSender.serverConfiguration',
    receivers: 'mailSender.receivers'
};
const menuButtons = document.querySelectorAll('.menu-button');
const screens = document.querySelectorAll('.screen');
const serverForm = document.querySelector('#server-form');
const receiversForm = document.querySelector('#receivers-form');
const sendForm = document.querySelector('#send-form');
const sendButton = document.querySelector('#send-button');
const attachButton = document.querySelector('#attach-button');
const attachmentSummary = document.querySelector('#attachment-summary');
const receiverCount = document.querySelector('#receiver-count');
const sendReadyCount = document.querySelector('#send-ready-count');
const configReady = document.querySelector('#config-ready');
const progressArea = document.querySelector('#progress-area');
const progressBar = document.querySelector('#progress-bar');
const progressCount = document.querySelector('#progress-count');
const progressLabel = document.querySelector('#progress-label');
const report = document.querySelector('#report');
const reportChart = document.querySelector('#report-chart');
const messageEditor = document.querySelector('#message-editor');
const editorCommands = document.querySelectorAll('.editor-command');
let selectedAttachments = [];
let removeProgressListener;
function getInputValue(id) {
    const input = document.querySelector(`#${id}`);
    return input?.value.trim() ?? '';
}
function getMessageText() {
    return messageEditor?.innerText.trim() ?? '';
}
function getMessageHtml() {
    return messageEditor?.innerHTML.trim() ?? '';
}
function focusMessageEditor() {
    messageEditor?.focus();
}
function setInputValue(id, value) {
    const input = document.querySelector(`#${id}`);
    if (input) {
        input.value = value;
    }
}
function setStatus(id, message, tone = 'neutral') {
    const statusText = document.querySelector(`#${id}`);
    if (!statusText) {
        return;
    }
    statusText.textContent = message;
    statusText.dataset.tone = tone;
}
function showScreen(screenName) {
    screens.forEach((screen) => {
        const isSelected = screen.dataset.screen === screenName;
        screen.hidden = !isSelected;
        screen.classList.toggle('is-active', isSelected);
    });
    menuButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.screenTarget === screenName);
    });
}
function parseReceivers(value) {
    return value
        .split(/\r?\n/)
        .map((email) => email.trim())
        .filter(Boolean);
}
function getSavedServerConfiguration() {
    const saved = localStorage.getItem(STORAGE_KEYS.server);
    if (!saved) {
        return null;
    }
    try {
        const parsed = JSON.parse(saved);
        if (!parsed.smtpHost || !parsed.smtpPort || !parsed.username || !parsed.password) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function getSavedReceivers() {
    const saved = localStorage.getItem(STORAGE_KEYS.receivers);
    if (!saved) {
        return [];
    }
    try {
        const parsed = JSON.parse(saved);
        return parsed.filter(Boolean);
    }
    catch {
        return [];
    }
}
function loadSavedData() {
    const server = getSavedServerConfiguration();
    const receivers = getSavedReceivers();
    if (server) {
        setInputValue('smtpHost', server.smtpHost);
        setInputValue('smtpPort', String(server.smtpPort));
        setInputValue('username', server.username);
        setInputValue('password', server.password);
        const secureInput = document.querySelector('#secure');
        if (secureInput) {
            secureInput.checked = server.secure;
        }
    }
    setInputValue('receivers', receivers.join('\n'));
    updateReceiverSummaries();
}
function updateReceiverSummaries() {
    const receivers = parseReceivers(getInputValue('receivers'));
    const label = `${receivers.length} receiver${receivers.length === 1 ? '' : 's'}`;
    if (receiverCount) {
        receiverCount.textContent = label;
    }
    if (sendReadyCount) {
        sendReadyCount.textContent = `${label} ready`;
    }
    const server = getSavedServerConfiguration();
    if (configReady) {
        configReady.textContent = server ? 'Server configuration ready' : 'Server configuration needed';
        configReady.dataset.ready = server ? 'true' : 'false';
    }
}
function getDeliveryCounts(results) {
    return {
        succeeded: results.filter((result) => result.status === 'succeeded').length,
        failed: results.filter((result) => result.status === 'failed').length,
        rejected: results.filter((result) => result.status === 'rejected').length
    };
}
function drawReportChart(results) {
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
    document.querySelector('#success-count').textContent = String(counts.succeeded);
    document.querySelector('#failed-count').textContent = String(counts.failed);
    document.querySelector('#rejected-count').textContent = String(counts.rejected);
}
function updateProgress(completed, total) {
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
        showScreen(button.dataset.screenTarget ?? 'send');
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
serverForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const configuration = {
        smtpHost: getInputValue('smtpHost'),
        smtpPort: Number(getInputValue('smtpPort')),
        secure: document.querySelector('#secure')?.checked ?? false,
        username: getInputValue('username'),
        password: getInputValue('password')
    };
    localStorage.setItem(STORAGE_KEYS.server, JSON.stringify(configuration));
    setStatus('server-status', 'Configuration saved.', 'success');
    updateReceiverSummaries();
});
receiversForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const receivers = parseReceivers(getInputValue('receivers'));
    localStorage.setItem(STORAGE_KEYS.receivers, JSON.stringify(receivers));
    setInputValue('receivers', receivers.join('\n'));
    setStatus('receivers-status', `${receivers.length} receiver${receivers.length === 1 ? '' : 's'} Saved.`, 'success');
    updateReceiverSummaries();
});
document.querySelector('#receivers')?.addEventListener('input', updateReceiverSummaries);
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
    updateProgress(0, receivers.length);
    if (report) {
        report.hidden = true;
    }
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
        if (report) {
            report.hidden = false;
        }
        const counts = getDeliveryCounts(results);
        setStatus('send-status', `Complete. ${counts.succeeded} Succeeded, ${counts.failed} Failed, ${counts.rejected} Rejected.`, counts.failed > 0 || counts.rejected > 0 ? 'error' : 'success');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to send emails.';
        setStatus('send-status', message, 'error');
    }
    finally {
        removeProgressListener?.();
        removeProgressListener = undefined;
        sendButton.disabled = false;
    }
});
loadSavedData();
showScreen('send');
