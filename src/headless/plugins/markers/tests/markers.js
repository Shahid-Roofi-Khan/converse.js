/*global mock, converse */

const { Strophe, u } = converse.env;

describe("A XEP-0333 Chat Marker", function () {

    fit("will be sent along with a sent message",
            mock.initConverse([], {}, async function (_converse) {
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
    }));

});
