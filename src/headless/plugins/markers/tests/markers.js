/*global mock, converse */

const { Strophe, dayjs, u } = converse.env;

describe("A XEP-0333 Chat Marker", function () {

    it("may be sent along with a sent groupchat message",
            mock.initConverse([], {'muc_send_markers_for_own_messages': true}, async function (_converse) {

        const base_time = new Date();
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const model = _converse.chatboxes.get(muc_jid);
        const message = await model.sendMessage({'body': 'Hello world'});
        const reflection_stanza = u.toStanza(`
            <message xmlns="jabber:client"
                    from="${message.get('from')}"
                    to="${_converse.connection.jid}"
                    id="${_converse.connection.getUniqueId()}"
                    type="groupchat">
                <body>${message.get('message')}</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                        id="reflected-message"
                        by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${message.get('origin_id')}"/>
            </message>`);

        await model.handleMessageStanza(reflection_stanza);

        const sent_stanzas = _converse.connection.sent_stanzas;
        await u.waitUntil(() => sent_stanzas.filter(iq => iq.matches('message')).length === 2);

        const messages = sent_stanzas.filter(iq => iq.matches('message'));
        expect(Strophe.serialize(messages[0])).toBe(
            `<message from="${_converse.jid}" id="${message.get('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                `<body>Hello world</body>`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<origin-id id="${message.get('id')}" xmlns="urn:xmpp:sid:0"/>`+
            `</message>`
        );
        expect(Strophe.serialize(messages[1])).toBe(
            `<message from="${_converse.jid}" id="${messages[1].getAttribute('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                `<displayed id="reflected-message" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`);

        expect(model.markers.length).toBe(1);

        const o = {};
        o[_converse.bare_jid] = 'displayed';
        expect(model.markers.at(0).get('marked_by')).toEqual(o);


        // Check that a marker isn't sent out twice
        model.save({'hidden': true});

        // Receive a delayed older message, which sets the unread counters.
        // When 'hidden' is set to false on the chat, the counters get
        // cleared and normally a chat marker gets sent out, but this
        // time it shouldn't because the latest message is already
        // read.

        const id = _converse.connection.getUniqueId();
        const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                    from="${muc_jid}/juliet"
                    to="${_converse.jid}"
                    id="${id}"
                    type="groupchat">
                <body>Hello</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                        id="new-message"
                        by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${id}"/>
                <delay xmlns="urn:xmpp:delay" stamp="${dayjs(base_time).subtract(5, 'minutes').toISOString()}"/>
            </message>`);
        await model.handleMessageStanza(stanza);
        await u.waitUntil(() => model.get('num_unread_general'));

        model.save({'hidden': false});

        const p = u.getOpenPromise();
        setTimeout(() => {
            expect(sent_stanzas.filter(iq => iq.matches('message')).length).toBe(2);
            p.resolve();
        }, 500);
        return p;
    }));

    it("will not be sent along with a sent 1:1 message",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)

        const model = _converse.chatboxes.get(contact_jid);
        const message = 'This message is sent from this chatbox';
        await model.sendMessage({'body': message});

        const sent_stanzas = _converse.connection.sent_stanzas;
        const p = u.getOpenPromise();
        setTimeout(() => {
            expect(sent_stanzas.filter(m => m.matches('message')).length).toBe(2);
            p.resolve();
        }, 500);
        return p;

    }));
});
