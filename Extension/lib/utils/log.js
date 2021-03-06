/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global console */

/**
 * Simple logger with log levels
 */
var Log = (function () {

    'use strict';

    var LogLevels = {
        'ERROR': 1,
        'WARN': 2,
        'INFO': 3,
        'DEBUG': 4
    };

    return {

        currentLevel: "INFO",

        debug: function () {
            this._print("DEBUG", "log", arguments);
        },

        info: function () {
            this._print("INFO", "info", arguments);
        },

        warn: function(){
            this._print("WARN", "info", arguments);
        },

        error: function () {
            this._print("ERROR", "error", arguments);
        },

        _print: function (level, method, args) {
            //check log level
            if (LogLevels[this.currentLevel] < LogLevels[level]) {
                return;
            }
            if (!args || args.length === 0 || !args[0]) {
                return;
            }
            var str = args[0] + "";
            args = Array.prototype.slice.call(args, 1);
            var formatted = str.replace(/{(\d+)}/g, function (match, number) {
                return typeof  args[number] !== "undefined" ? args[number] : match;
            });
            if (LogLevels[level] >= LogLevels.INFO) {
                var now = new Date();
                formatted = now.toISOString() + ": " + formatted;
            }
            console[method](formatted);
        }
    };
})();