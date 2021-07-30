import './marker.js';
import { converse } from '@converse/headless/core';

converse.plugins.add('converse-marker-views', {

    dependencies: ['converse-markers'],
});
