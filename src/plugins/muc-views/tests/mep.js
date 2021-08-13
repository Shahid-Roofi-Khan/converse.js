/*global mock, converse */

const { u } = converse.env;

describe("A XEP-0316 MEP notification", function () {

    fit("is rendered as an info message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        const msg = 'An anonymous user has saluted romeo';
        const reason = 'Thank you for helping me yesterday';
        const message = u.toStanza(`
            <message from='${muc_jid}'
                    to='${_converse.jid}'
                    type='headline'
                    id='zns61f38'>
                <event xmlns='http://jabber.org/protocol/pubsub#event'>
                    <items node='urn:ietf:params:xml:ns:conference-info'>
                        <item id='ehs51f40'>
                            <conference-info xmlns='urn:ietf:params:xml:ns:conference-info'>
                                <activity xmlns='http://jabber.org/protocol/activity'>
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="31" end="36" type="mention" uri="xmpp:z3r0@montague.lit"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`);

        _converse.connection._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);
        expect(view.querySelector('.chat-info__message').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason').textContent.trim()).toBe(reason);

        // Check that duplicates aren't created
        _converse.connection._dataRecv(mock.createRequest(message));
        const promise = u.getOpenPromise();
        setTimeout(() => {
            expect(view.querySelectorAll('.chat-info').length).toBe(1);
            promise.resolve();
        }, 250);
        return promise;
    }));
});
