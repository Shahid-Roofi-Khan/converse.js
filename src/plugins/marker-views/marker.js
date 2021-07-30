import tpl_marker from './templates/marker.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless/core';

export default class ChatMarker extends CustomElement {

    static get properties () {
        return {
            message: { type: Object }
        }
    }

    render () {
        return tpl_marker(this);
    }
}

api.elements.define('converse-chat-marker', ChatMarker);
