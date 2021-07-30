import log from '../log';
import { api, converse } from '@converse/headless/core';

const { $msg } = converse.env;

export function rejectMessage (stanza, text) {
    // Reject an incoming message by replying with an error message of type "cancel".
    api.send(
        $msg({
            'to': stanza.getAttribute('from'),
            'type': 'error',
            'id': stanza.getAttribute('id')
        })
            .c('error', { 'type': 'cancel' })
            .c('not-allowed', { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' })
            .up()
            .c('text', { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' })
            .t(text)
    );
    log.warn(`Rejecting message stanza with the following reason: ${text}`);
    log.warn(stanza);
}
