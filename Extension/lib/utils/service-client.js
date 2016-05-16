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

/* global Log, Prefs, FilterRule, AdguardFilterVersion, SubscriptionGroup, SubscriptionFilter */

var ServiceClient = (function () {

    'use strict';

    /**
     * Class for working with our backend server
     */
    var ServiceClient = function () {

        // Base url of our backend server
        this.backendUrl = "https://chrome.adtidy.org";

        this.checkFilterVersionsUrl = this.backendUrl + "/checkfilterversions.html";
        this.getFilterRulesUrl = this.backendUrl + "/getfilter.html";
        this.reportUrl = this.backendUrl + "/url-report.html";
        this.apiKey = "4DDBE80A3DA94D819A00523252FB6380";
    };

    ServiceClient.prototype = {

        APP_PARAM: '&app=stealth&v=' + Prefs.version,

        /**
         * Checks versions of the specified filters
         *
         * @param filterIds         Filters identifiers
         * @param successCallback   Called on success
         * @param errorCallback     Called on error
         */
        checkFilterVersions: function (filterIds, successCallback, errorCallback) {

            if (!filterIds || filterIds.length === 0) {
                successCallback([]);
                return;
            }

            var success = function (response) {
                var xml = response.responseXML;
                if (xml && xml.getElementsByTagName) {
                    var filterVersionsList = xml.getElementsByTagName("filter-version-list")[0];
                    filterVersionsList = filterVersionsList.getElementsByTagName("versions")[0];
                    var filterVersions = [];
                    var childNodes = filterVersionsList.childNodes;
                    for (var i = 0; i < childNodes.length; i++) {
                        var filterVersionXml = childNodes[i];
                        if (filterVersionXml.tagName === "filter-version") {
                            filterVersions.push(AdguardFilterVersion.fromXml(filterVersionXml));
                        }
                    }
                    successCallback(filterVersions);
                } else {
                    errorCallback(response, "empty response");
                }
            };
            var url = this.checkFilterVersionsUrl;
            for (var i = 0; i < filterIds.length; i++) {
                url += (i === 0 ? "?filterid=" : "&filterid=") + filterIds[i];
            }
            url += this.APP_PARAM;
            url = this._addKeyParameter(url);
            this._executeRequestAsync(url, "application/xml", success, errorCallback);
        },

        /**
         * Downloads filter rules by filter ID
         *
         * @param filterId          Filter identifier
         * @param successCallback   Called on success
         * @param errorCallback     Called on error
         */
        loadFilterRules: function (filterId, successCallback, errorCallback) {

            var success = function (response) {

                var responseText = response.responseText;
                if (!responseText) {
                    errorCallback(response, "filter rules missing");
                    return;
                }
                var lines = responseText.split(/[\r\n]+/);

                var version = null;
                var timeUpdated = null;
                for (var i = 0; i < 7; i++) {
                    var line = lines[i];
                    if (/!\s+Version:\s+([0-9.]+)/.test(line)) {
                        version = version || RegExp.$1;
                    } else if (/!\s+TimeUpdated:\s+(.+)$/.test(line)) {
                        timeUpdated = timeUpdated || new Date(RegExp.$1);
                    }
                }
                if (!version || !timeUpdated) {
                    errorCallback(response, "wrong filter metadata");
                    return;
                }
                var rules = [];
                for (i = 0; i < lines.length; i++) {
                    var rule = FilterRuleBuilder.createRule(lines[i]);
                    if (rule) {
                        rules.push(rule);
                    }
                }
                var filterVersion = new AdguardFilterVersion(timeUpdated.getTime(), version, filterId);
                successCallback(filterVersion, rules);
            };
            var url = this.getFilterRulesUrl + "?filterid=" + filterId;
            url += this.APP_PARAM;
            url = this._addKeyParameter(url);
            this._executeRequestAsync(url, "text/plain", success, errorCallback);
        },

        /**
         * Loads filter rules from local file
         *
         * @param filterId          Filter identifier
         * @param successCallback   Called on success
         * @param errorCallback     Called on error
         */
        loadLocalFilter: function (filterId, successCallback, errorCallback) {

            var success = function (response) {
                var responseText = response.responseText;
                var lines = responseText.split(/[\r\n]+/);
                var rules = [];
                var version = null;
                var timeUpdated = null;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (/!\s+Version:\s+([0-9.]+)/.test(line)) {
                        version = version || RegExp.$1;
                    } else if (/!\s+TimeUpdated:\s+(.+)$/.test(line)) {
                        timeUpdated = timeUpdated || new Date(RegExp.$1);
                    }
                    var rule = FilterRuleBuilder.createRule(line);
                    if (rule) {
                        rules.push(rule);
                    }
                }
                var filterVersion = new AdguardFilterVersion(timeUpdated.getTime(), version, filterId);
                successCallback(filterVersion, rules);
            };
            var url = Prefs.getLocalFilterPath(filterId);
            this._executeRequestAsync(url, "text/plain", success, errorCallback);
        },

        /**
         * Loads filter groups metadata
         *
         * @param successCallback   Called on success
         * @param errorCallback     Called on error
         */
        loadLocalGroupsMetadata: function (successCallback, errorCallback) {

            var success = function (response) {
                var xml = response.responseXML;
                if (xml && xml.getElementsByTagName) {
                    var groups = [];
                    var groupsElements = xml.getElementsByTagName('group');
                    for (var i = 0; i < groupsElements.length; i++) {
                        var group = SubscriptionGroup.fromXml(groupsElements[i]);
                        groups.push(group);
                    }
                    successCallback(groups);
                } else {
                    errorCallback(response, 'empty response');
                }
            };

            var url = Prefs.localGroupsMetadataPath;
            this._executeRequestAsync(url, 'text/xml', success, errorCallback);
        },

        /**
         * Loads filter groups metadata from local file
         *
         * @param successCallback   Called on success
         * @param errorCallback     Called on error
         */
        loadLocalFiltersMetadata: function (successCallback, errorCallback) {

            var success = function (response) {
                var xml = response.responseXML;
                if (xml && xml.getElementsByTagName) {
                    var filters = [];
                    var filtersElements = xml.getElementsByTagName('filter');
                    for (var i = 0; i < filtersElements.length; i++) {
                        var filter = SubscriptionFilter.fromXml(filtersElements[i]);
                        filters.push(filter);
                    }
                    successCallback(filters);
                } else {
                    errorCallback(response, 'empty response');
                }
            };

            var url = Prefs.localFiltersMetadataPath;
            this._executeRequestAsync(url, 'text/xml', success, errorCallback);
        },

        /**
         * Sends feedback from the user to our server
         *
         * @param url           URL
         * @param messageType   Message type
         * @param comment       Message text
         */
        sendUrlReport: function (url, messageType, comment) {

            var params = "url=" + encodeURIComponent(url);
            params += "&messageType=" + encodeURIComponent(messageType);
            if (comment) {
                params += "&comment=" + encodeURIComponent(comment);
            }
            params = this._addKeyParameter(params);

            var request = new XMLHttpRequest();
            request.open('POST', this.reportUrl);
            request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            request.send(params);
        },

        _executeRequestAsync: function (url, contentType, successCallback, errorCallback) {
            var request = new XMLHttpRequest();
            request.open('GET', url);
            request.setRequestHeader('Content-type', contentType);
            request.overrideMimeType(contentType);
            if (successCallback) {
                request.onload = function () {
                    successCallback(request);
                };
            }

            if (errorCallback) {
                var errorCallbackWrapper = function () {
                    errorCallback(request);
                };
                request.onerror = errorCallbackWrapper;
                request.onabort = errorCallbackWrapper;
                request.ontimeout = errorCallbackWrapper;
            }

            request.send(null);
        },

        _addKeyParameter: function (url) {
            return url + "&key=" + this.apiKey;
        }
    };

    return ServiceClient;

})();
