import { Model } from '@converse/skeletor/src/model.js';


/**
 * Model which is used to store XEP-0333 chat marker data
 * Instead of saving on each message whether we've received XEP-0333 markers
 * for it, we create `ChatMarker` instances where we save this data.
 */
export default class ChatMarker extends Model {

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'is_ephemeral': false,
            'marked_by': []
        };
    }

    /**
     * Given a JID, remove it from the `marked_by` array, and remove the
     * ChatMarker itself if `marked_by` is empty
     */
    removeMarkerJID (jid) {
        const marked_by = this.get('marked_by');
        if (marked_by[jid] && Object.keys(marked_by).length === 1) {
            this.destroy();
        } else {
            this.save({'marked_by': [...marked_by.splice(marked_by.indexOf(jid))]});
        }
    }
}
