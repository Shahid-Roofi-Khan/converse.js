/**
 * @description
 * Converse.js plugin which adds support for XEP-0333 chat markers
 * @copyright 2021, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

import ChatMarker from './marker.js';
import { Collection } from '@converse/skeletor/src/collection';
import { _converse, api, converse } from '@converse/headless/core';
import {
    handleChatMarker,
    handleUnreadMessage,
    initChatMarkers,
    onMessageUpdated,
    onUnreadsCleared,
} from './utils.js';

converse.plugins.add('converse-markers', {
    initialize () {
        api.settings.extend({
            'muc_chat_markers_limit': 10,
            'muc_send_markers_for_own_messages': false,
            'send_chat_markers': ['received', 'displayed', 'acknowledged'],
        });

        _converse.ChatMarkers = Collection.extend({ 'model': ChatMarker });

        api.listen.on('chatBoxInitialized', initChatMarkers);
        api.listen.on('chatRoomInitialized', initChatMarkers);
        api.listen.on('clearUnreads', onUnreadsCleared);
        api.listen.on('handleNewMessage', handleChatMarker);
        api.listen.on('newUnreadMessage', handleUnreadMessage);
        api.listen.on('messageUpdated', onMessageUpdated);
    },
});
