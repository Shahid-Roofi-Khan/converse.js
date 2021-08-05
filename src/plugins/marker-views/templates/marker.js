import { _converse } from '@converse/headless/core.js';
import { getMessageIdToMark } from '@converse/headless/plugins/markers/utils.js';
import { html } from 'lit';

export default (el) => {
    const message = el.message;
    const markers = message.collection.chatbox.markers;
    const marker = markers?.get(getMessageIdToMark(message));
    const marked_by = Object.entries(marker?.get('marked_by') || {}).filter(k  => k === _converse.bare_jid);
    if (marked_by.length) {
        return html`<div class="message chat-marker"><hr class="separator"/></div>`;
    }
    return '';
}
