import ChatMarker from './marker.js';
import log from '@converse/headless/log';
import { MARKER_TYPES } from './constants.js';
import { _converse, api, converse } from '@converse/headless/core.js';
import { getOpenPromise } from '@converse/openpromise';
import { initStorage } from '@converse/headless/utils/storage.js';

const { $msg, Strophe, u } = converse.env;

export function getMessageIdToMark (message) {
    if (message.get('type') === 'groupchat') {
        const muc_jid = Strophe.getBareJidFromJid(message.get('from'));
        return message.get(`stanza_id ${muc_jid}`) || message.get('msgid');
    }
    return message.get('msgid');
}

/**
 * Given a message being marked by a particular JID, add (or update) a
 * ChatMarker message.
 *
 * See [XEP-0333](https://xmpp.org/extensions/xep-0333.html)
 *
 * @param { _converse.ChatBox | _converse.ChatRoom } chat
 * @param { _converse.Message } message - The message being marked
 * @param { String } by_jid - The JID of the user who sent a marker
 * @param { ('received'|'displayed'|'acknowledged') } type - The type of chat marker being added
 * @returns { ChatMarker }
 */
export function addChatMarker (chat, message, by_jid, type='displayed') {
    if (chat.get('type') === _converse.CHATROOMS_TYPE) {
        if (
            by_jid !== _converse.bare_jid &&
            chat.occupants.length > api.settings.get('muc_chat_markers_limit')
        ) {
            // XXX: this might cause orphaned ChatMarker instances in the chat.
            // For example if muc_chat_markers_limit is 10, then as the MUC
            // grows to 11 users, we will no longer create new ChatMarkers and
            // the older ones won't be removed.
            return;
        }
    }

    if (!Object.keys(MARKER_TYPES).includes(type)) {
        throw new TypeError('Invalid XEP-0333 chat marker type');
    }

    const marked_message_id = getMessageIdToMark(message);
    const marked = chat.markers.get(marked_message_id);
    const marked_entry = {};
    marked_entry[by_jid] = type;

    if (marked) {
        const marked_by = Object.assign(marked.get('marked_by') || {}, marked_entry);
        marked.save({ marked_by });
        return marked;
    } else {
        // Update (and potentially remove) existing markers to remove `by_jid`
        const predicate = m => m instanceof ChatMarker && m.get('marked_by')?.[by_jid];
        chat.markers.findWhere(predicate)?.removeMarkerJID(by_jid);

        const marker_data = {
            'id': marked_message_id,
            'marked_by': marked_entry,
            'time': (new Date()).setMilliseconds((new Date(message.get('time'))).getMilliseconds()+1)
        }
        return chat.markers.add(new ChatMarker(marker_data));
    }
}


/**
 * Send out a XEP-0333 chat marker
 * @param { String } to_jid
 * @param { String } id - The id of the message being marked
 * @param { String } type - The marker type
 * @param { String } msg_type
 */
export function sendChatMarker (to_jid, id, type, msg_type) {
    const stanza = $msg({
        'from': _converse.connection.jid,
        'id': u.getUniqueId(),
        'to': to_jid,
        'type': msg_type ? msg_type : 'chat'
    }).c(type, {'xmlns': Strophe.NS.MARKERS, 'id': id});
    api.send(stanza);
}


/**
 * Finds the last eligible message and then sends a XEP-0333 chat marker for it.
 * @param { (_converse.ChatBox|_converse.ChatRoom) } chat
 * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
 * @param { Boolean } [force=false] - Whether a marker should be sent for the
 *  message, even if it didn't include a `markable` element.
 */
export function sendMarkerForLastMessage (chat, type='displayed', force=false) {
    const msgs = Array.from(chat.messages.models);
    msgs.reverse();
    const msg = msgs.find(m => force || m.get('is_markable'));
    msg && sendMarkerForMessage(msg, type, force) && addChatMarker(chat, msg, _converse.bare_jid);
}


/**
 * Given the passed in message object, send a XEP-0333 chat marker if appropriate.
 * @param { _converse.Message } msg
 * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
 * @param { Boolean } [force=false] - Whether a marker should be sent for the
 *  message, even if it didn't include a `markable` element.
 * @returns { Boolean } Returns `true` or `false` depending on whether the
 *  marker was actually sent out.
 */
export function sendMarkerForMessage (msg, type='displayed', force=false) {
    if (!msg || !api.settings.get('send_chat_markers').includes(type)) {
        return false;
    }
    if (msg?.get('is_markable') || force) {
        const from_jid = Strophe.getBareJidFromJid(msg.get('from'));
        sendChatMarker(from_jid, msg.get('msgid'), type, msg.get('type'));
        const field_name = `marked_${type}`;
        const marked = msg.get(field_name) || [];
        msg.save({field_name: [...marked, _converse.bare_jid]});
        return true;
    }
    return false;
}

/**
 * Given the passed in MUC message, send a XEP-0333 chat marker if appropriate.
 * @param { _converse.MUCMessage } msg
 * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
 * @returns { Boolean } Returns `true` or `false` depending on whether the
 *  marker was actually sent out.
 */
export function sendMarkerForMUCMessage (chat, msg, type='displayed') {
    if (!Object.keys(MARKER_TYPES).includes(type)) {
        throw new TypeError('Invalid XEP-0333 chat marker type');
    }

    if (!msg || !api.settings.get('send_chat_markers').includes(type)) {
        return false;
    }
    if (msg?.get('is_markable')) {
        const mid = getMessageIdToMark(msg);
        if (chat.markers.get(mid)?.get('marked_by')?.[_converse.bare_jid] ?? -1 > MARKER_TYPES[type]) {
            // Already marked, either by the same marker value or by a higher ranked one.
            // https://xmpp.org/extensions/xep-0333.html#format
            return false;
        }
        const key = `stanza_id ${chat.get('jid')}`;
        const id = msg.get(key);
        if (!id) {
            log.error(`Can't send marker for message without stanza ID: ${key}`);
            return false;
        }
        const from_jid = Strophe.getBareJidFromJid(msg.get('from'));
        sendChatMarker(from_jid, id, type, msg.get('type'));
        return true;
    }
    return false;
}


/**
 * Given a new unread message in a chat, see whether we should send out a chat
 * marker for it.
 * @param { (_converse.ChatBox|_converse.ChatRoom) } chat
 * @param { _converse.Message } message
 */
export function handleUnreadMessage (chat, message) {
    if (!message?.get('body') || !u.isNewMessage(message) || chat.isHidden()) {
        return
    }
    sendMarkerForMessage(message) && addChatMarker(chat, message, _converse.bare_jid);
}


/**
 * Given an incoming message's attributes, check whether its a chat marker, and
 * if so, create a {@link _converse.ChatMarker}.
 * @param { MessageAttributes } attrs
 * @returns { Boolean } Returns `true` if the attributes are from a marker, and `false` otherwise.
 */
export function handleChatMarker (data, handled) {
    const { attrs, model } = data;
    const to_bare_jid = Strophe.getBareJidFromJid(attrs.to);
    if (to_bare_jid !== _converse.bare_jid) {
        return handled;
    }
    if (attrs.marker_id) {
        const message = model.messages.findWhere({'msgid': attrs.marker_id});
        message && addChatMarker(model, message, message.get('from'), message.get('marker'))
        return true;
    }
    return handled;
}

export function onMessageUpdated (chat, message) {
    if (chat.isHidden() || chat.get('type') !== _converse.CHATROOMS_TYPE) {
        return;
    }
    sendMarkerForMUCMessage(chat, message) && addChatMarker(chat, message, _converse.bare_jid);
}

export function onMessageSent ({ chatbox, message }) {
    if (chatbox.isHidden() || chatbox.get('type') === _converse.CHATROOMS_TYPE) {
        return;
    }
    sendMarkerForMessage(message, 'displayed', true) && addChatMarker(chatbox, message, _converse.bare_jid);
}

export function onUnreadsCleared (chat) {
    if (chat.get('type') === _converse.CHATROOMS_TYPE) {
        if (chat.get('num_unread_general') > 0 || chat.get('num_unread') > 0 || chat.get('has_activity')) {
            const message = chat.messages.last();
            sendMarkerForMUCMessage(chat, message) && addChatMarker(chat, message, _converse.bare_jid);
        }
    } else {
        if (chat.get('num_unread') > 0) {
            const message = chat.messages.last();
            sendMarkerForMessage(message) && addChatMarker(chat, message, _converse.bare_jid);
        }
    }
}

/**
 * Creates a ChatMarkers collection, set it on the chat and fetch any cached markers
 * @param { (_converse.ChatBox|_converse.ChatRoom) }
 */
export function initChatMarkers (model) {
    model.markers = new _converse.ChatMarkers();
    const id = `converse.markers-${model.get('jid')}`;
    initStorage(model.markers, id);
    model.markers.fetched = getOpenPromise();
    const resolve = model.markers.fetched.resolve;
    model.markers.fetch({
        'add': true,
        'success':  resolve,
        'error': resolve
    });
}
