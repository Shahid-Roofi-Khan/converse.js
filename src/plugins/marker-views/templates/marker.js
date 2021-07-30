import { getMessageIdToMark } from '@converse/headless/plugins/markers/utils.js';
import { html } from 'lit';

export default (el) => {
    const message = el.message;
    const markers = message.collection.chatbox.markers;
    const id = getMessageIdToMark(message);
    if (markers.get(id)) {
        return html`<span>hello world</span>`;
    }
    return '';
}
