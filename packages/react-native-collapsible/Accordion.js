'use strict';

const accordionModule = require('./lib/commonjs/Accordion');
const Accordion = accordionModule.default || accordionModule.Accordion;

module.exports = Accordion;
module.exports.default = Accordion;
module.exports.Accordion = Accordion;
