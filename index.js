// We need to declare underscore as global, since typescript currently
// does not allow us to generate a single file CommonJS module with imports.
_ = require('underscore');
module.exports = require('./dist/gnd-server');

var path = require('path');
module.exports.src = path.join(__dirname, 'lib/');
module.exports.lib = path.join(__dirname, 'dist/gnd.min.js');
module.exports.map = path.join(__dirname, 'dist/gnd.js.map');
module.exports.debug = path.join(__dirname, 'dist/gnd.js');
module.exports.amd = path.join(__dirname, 'dist/gnd.min');
module.exports.debugBase = path.join(__dirname, 'dist/gnd');
module.exports.docs = path.join(__dirname, 'docs/');
module.exports.readme = path.join(__dirname, 'Readme.md');

module.exports.third = {
  curl: path.join(__dirname, 'third/curl.js'),
  underscore: path.join(__dirname, 'third/lodash.js')
}
